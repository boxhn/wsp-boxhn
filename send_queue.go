// send_queue.go — Cola de envío pausado: modelo y acceso a base de datos.
//
// Qué hace: guarda por usuario la política de ritmo (send_queue_config) y los
// mensajes pendientes (send_queue), para que los envíos salgan en lotes pequeños
// con pausas aleatorias en vez de en ráfaga (reduce el riesgo de baneo).
// Qué expone: sendQueueConfig, sendQueueItem y los métodos (s *server) sq*.
// Depende de: migración 18 (migrations.go), s.db (SQLite o PostgreSQL).
// Documentación: docs/send-queue.md. Los handlers HTTP están en
// send_queue_http.go y el worker que envía en send_queue_worker.go.
//
// Convenciones: las fechas se guardan como segundos Unix (BIGINT) y los flags
// como INTEGER 0/1 para que el mismo SQL sirva en SQLite y PostgreSQL.
package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// Estados de un mensaje en cola.
const (
	sqPending   = "pending"
	sqSending   = "sending"
	sqSent      = "sent"
	sqFailed    = "failed"
	sqCancelled = "cancelled"
)

// sendQueueConfig es la política de ritmo de un usuario. Los tiempos van en segundos.
type sendQueueConfig struct {
	Enabled       bool `json:"Enabled"`
	Paused        bool `json:"Paused"`
	BatchSize     int  `json:"BatchSize"`
	MsgDelayMin   int  `json:"MsgDelayMin"`
	MsgDelayMax   int  `json:"MsgDelayMax"`
	BatchPauseMin int  `json:"BatchPauseMin"`
	BatchPauseMax int  `json:"BatchPauseMax"`
	HourlyCap     int  `json:"HourlyCap"`
}

// defaultSendQueueConfig: lotes de 3, 5-15 s entre mensajes, 1-3 min entre lotes, 60/hora.
func defaultSendQueueConfig() sendQueueConfig {
	return sendQueueConfig{
		BatchSize: 3, MsgDelayMin: 5, MsgDelayMax: 15,
		BatchPauseMin: 60, BatchPauseMax: 180, HourlyCap: 60,
	}
}

// validate rechaza valores que romperían el ritmo (negativos o rangos invertidos).
func (c sendQueueConfig) validate() error {
	switch {
	case c.BatchSize < 1 || c.BatchSize > 50:
		return errors.New("BatchSize must be between 1 and 50")
	case c.MsgDelayMin < 0 || c.MsgDelayMax < c.MsgDelayMin:
		return errors.New("MsgDelayMin/MsgDelayMax must be >= 0 and Max >= Min")
	case c.BatchPauseMin < 0 || c.BatchPauseMax < c.BatchPauseMin:
		return errors.New("BatchPauseMin/BatchPauseMax must be >= 0 and Max >= Min")
	case c.HourlyCap < 1 || c.HourlyCap > 10000:
		return errors.New("HourlyCap must be between 1 and 10000")
	}
	return nil
}

// sendQueueItem es una fila de send_queue (el cuerpo no se devuelve en los listados).
type sendQueueItem struct {
	ID        string `json:"QueueId" db:"id"`
	UserID    string `json:"-" db:"user_id"`
	Path      string `json:"Path" db:"path"`
	Body      string `json:"-" db:"body"`
	Status    string `json:"Status" db:"status"`
	Attempts  int    `json:"Attempts" db:"attempts"`
	MessageID string `json:"MessageId" db:"message_id"`
	Result    string `json:"Result" db:"result"`
	CreatedAt int64  `json:"CreatedAt" db:"created_at"`
	SentAt    int64  `json:"SentAt" db:"sent_at"`
}

// sqGetConfig devuelve la política del usuario, o los valores por defecto
// (desactivada) si nunca la configuró.
func (s *server) sqGetConfig(userID string) (sendQueueConfig, error) {
	cfg := defaultSendQueueConfig()
	var enabled, paused int
	err := s.db.QueryRow(`SELECT enabled, paused, batch_size, msg_delay_min, msg_delay_max,
		batch_pause_min, batch_pause_max, hourly_cap FROM send_queue_config WHERE user_id=$1`, userID).
		Scan(&enabled, &paused, &cfg.BatchSize, &cfg.MsgDelayMin, &cfg.MsgDelayMax,
			&cfg.BatchPauseMin, &cfg.BatchPauseMax, &cfg.HourlyCap)
	if errors.Is(err, sql.ErrNoRows) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	cfg.Enabled, cfg.Paused = enabled == 1, paused == 1
	return cfg, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// sqSaveConfig crea o reemplaza la política del usuario.
func (s *server) sqSaveConfig(userID string, c sendQueueConfig) error {
	_, err := s.db.Exec(`INSERT INTO send_queue_config
		(user_id, enabled, paused, batch_size, msg_delay_min, msg_delay_max, batch_pause_min, batch_pause_max, hourly_cap)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (user_id) DO UPDATE SET enabled=$2, paused=$3, batch_size=$4, msg_delay_min=$5,
		msg_delay_max=$6, batch_pause_min=$7, batch_pause_max=$8, hourly_cap=$9`,
		userID, boolToInt(c.Enabled), boolToInt(c.Paused), c.BatchSize, c.MsgDelayMin,
		c.MsgDelayMax, c.BatchPauseMin, c.BatchPauseMax, c.HourlyCap)
	return err
}

// sqNewID genera un id ordenable por tiempo (los más viejos salen primero al
// ordenar por id) con sufijo aleatorio para evitar colisiones.
func sqNewID() string {
	suffix := make([]byte, 4)
	_, _ = rand.Read(suffix)
	return fmt.Sprintf("%020d-%s", time.Now().UnixNano(), hex.EncodeToString(suffix))
}

// sqEnqueue guarda una petición de envío y devuelve su id y su posición (1 = la próxima).
func (s *server) sqEnqueue(userID, path, body string) (string, int, error) {
	id := sqNewID()
	if _, err := s.db.Exec(`INSERT INTO send_queue (id, user_id, path, body, status, created_at)
		VALUES ($1,$2,$3,$4,'pending',$5)`, id, userID, path, body, time.Now().Unix()); err != nil {
		return "", 0, err
	}
	var pos int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM send_queue WHERE user_id=$1 AND status='pending' AND id<=$2`,
		userID, id).Scan(&pos)
	return id, pos, err
}

// sqList lista los mensajes del usuario (más recientes primero); status vacío = todos.
func (s *server) sqList(userID, status string, limit int) ([]sendQueueItem, error) {
	items := []sendQueueItem{}
	q := `SELECT id, user_id, path, '' AS body, status, attempts, message_id, result, created_at, sent_at
		FROM send_queue WHERE user_id=$1`
	args := []interface{}{userID}
	if status != "" {
		q += ` AND status=$2`
		args = append(args, status)
	}
	q += fmt.Sprintf(` ORDER BY id DESC LIMIT %d`, limit)
	err := s.db.Select(&items, q, args...)
	return items, err
}

// sqCancel cancela un mensaje que aún está pendiente. Devuelve false si no existe
// o ya no se puede cancelar (enviándose, enviado, etc.).
func (s *server) sqCancel(userID, id string) (bool, error) {
	res, err := s.db.Exec(`UPDATE send_queue SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending'`, id, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// sqClaimNext toma el mensaje pendiente más antiguo y lo marca 'sending'.
// Devuelve nil si no hay ninguno. El UPDATE condicional evita que dos workers
// tomen el mismo mensaje.
func (s *server) sqClaimNext(userID string) (*sendQueueItem, error) {
	var item sendQueueItem
	err := s.db.Get(&item, `SELECT id, user_id, path, body, status, attempts, message_id, result, created_at, sent_at
		FROM send_queue WHERE user_id=$1 AND status='pending' ORDER BY id LIMIT 1`, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	res, err := s.db.Exec(`UPDATE send_queue SET status='sending', attempts=attempts+1 WHERE id=$1 AND status='pending'`, item.ID)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, nil
	}
	item.Attempts++
	return &item, nil
}

// sqFinish guarda el resultado de un intento (status: sent, failed o pending para reintentar).
func (s *server) sqFinish(id, status, messageID, result string) error {
	var sentAt int64
	if status == sqSent {
		sentAt = time.Now().Unix()
	}
	if len(result) > 1000 {
		result = result[:1000]
	}
	_, err := s.db.Exec(`UPDATE send_queue SET status=$1, message_id=$2, result=$3, sent_at=$4 WHERE id=$5`,
		status, messageID, result, sentAt, id)
	return err
}

// sqRelease devuelve un mensaje a 'pending' sin contar el intento (apagado a mitad de envío).
func (s *server) sqRelease(id string) error {
	_, err := s.db.Exec(`UPDATE send_queue SET status='pending', attempts=attempts-1 WHERE id=$1 AND status='sending'`, id)
	return err
}

// sqSentSince cuenta los mensajes enviados por el usuario desde el instante dado (tope por hora).
func (s *server) sqSentSince(userID string, since time.Time) (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM send_queue WHERE user_id=$1 AND status='sent' AND sent_at>=$2`,
		userID, since.Unix()).Scan(&n)
	return n, err
}

// sqUsersWithPending lista los usuarios con mensajes pendientes.
func (s *server) sqUsersWithPending() ([]string, error) {
	var users []string
	err := s.db.Select(&users, `SELECT DISTINCT user_id FROM send_queue WHERE status='pending'`)
	return users, err
}

// sqRecoverOrphans devuelve a 'pending' los mensajes que quedaron 'sending' por un
// apagado brusco. Se llama una vez al arrancar el worker.
func (s *server) sqRecoverOrphans() error {
	_, err := s.db.Exec(`UPDATE send_queue SET status='pending' WHERE status='sending'`)
	return err
}

// sqPurgeOld borra mensajes ya terminados con más de 'days' días (evita que la tabla crezca).
func (s *server) sqPurgeOld(days int) error {
	cutoff := time.Now().AddDate(0, 0, -days).Unix()
	_, err := s.db.Exec(`DELETE FROM send_queue WHERE status IN ('sent','failed','cancelled') AND created_at<$1`, cutoff)
	return err
}
