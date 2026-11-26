// send_queue_worker.go — Cola de envío pausado: el worker que saca los mensajes.
//
// Qué hace: un planificador revisa cada pocos segundos qué usuarios tienen
// mensajes pendientes y lanza una goroutine por usuario. Esa goroutine respeta:
//   - el tope por hora (HourlyCap),
//   - una pausa aleatoria entre mensajes (MsgDelayMin..Max),
//   - una pausa aleatoria más larga al terminar cada lote (BatchPauseMin..Max).
//
// Para enviar "reproduce" la petición original contra el router en memoria (el
// mismo truco que stdio.go), así se reutilizan los 15 handlers /chat/send/* sin tocarlos.
// Qué expone: startSendQueueWorker, shutdownSendQueue, wakeSendQueue.
// Depende de: send_queue.go (BD), send_queue_http.go (sqReplayKey), s.router,
// sendEventWithWebHook (evento QueuedMessageStatus).
// Documentación: static/guia/send-queue.md (cómo depurar y extender).
//
// Limitaciones conocidas: el ritmo (nextAt/inBatch) vive en memoria; tras un
// reinicio el primer mensaje sale sin espera previa. Errores 4xx no se reintentan;
// 5xx y errores de red se reintentan hasta sqMaxAttempts veces.
package main

import (
	"context"
	"encoding/json"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	sqMaxAttempts   = 3
	sqSchedulerTick = 5 * time.Second
	sqRetentionDays = 30
)

// sqPace es el estado de ritmo de un usuario entre goroutines.
type sqPace struct {
	nextAt  time.Time // no enviar antes de esta hora
	inBatch int       // mensajes ya enviados en el lote actual
}

type sendQueueWorker struct {
	s       *server
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	wake    chan struct{}
	mu      sync.Mutex
	running map[string]bool
	pace    map[string]*sqPace

	// Inyectables para tests (sin esperar segundos reales).
	now    func() time.Time
	sleep  func(ctx context.Context, d time.Duration) bool // false si se canceló
	jitter func(min, max int) time.Duration
}

var sendQueueInstance *sendQueueWorker

// wakeSendQueue avisa al planificador de que hay trabajo nuevo (no bloquea).
func wakeSendQueue() {
	if w := sendQueueInstance; w != nil {
		select {
		case w.wake <- struct{}{}:
		default:
		}
	}
}

// startSendQueueWorker arranca el planificador. Llamar una vez, tras s.routes().
func startSendQueueWorker(s *server) *sendQueueWorker {
	w := newSendQueueWorker(s)
	if err := s.sqRecoverOrphans(); err != nil {
		log.Error().Err(err).Msg("send queue: could not recover orphaned messages")
	}
	sendQueueInstance = w
	w.wg.Add(1)
	safeGo("send-queue-scheduler", func() { defer w.wg.Done(); w.scheduler() })
	return w
}

func newSendQueueWorker(s *server) *sendQueueWorker {
	ctx, cancel := context.WithCancel(context.Background())
	return &sendQueueWorker{
		s: s, ctx: ctx, cancel: cancel,
		wake:    make(chan struct{}, 1),
		running: map[string]bool{},
		pace:    map[string]*sqPace{},
		now:     time.Now,
		sleep:   sqSleep,
		jitter:  sqJitter,
	}
}

// shutdownSendQueue detiene el worker y espera (hasta que venza ctx) a que termine el envío en curso.
func shutdownSendQueue(ctx context.Context) {
	w := sendQueueInstance
	if w == nil {
		return
	}
	w.cancel()
	done := make(chan struct{})
	go func() { w.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
		log.Warn().Msg("send queue: shutdown timed out")
	}
}

// scheduler lanza una goroutine por usuario con pendientes y limpia mensajes viejos una vez al día.
func (w *sendQueueWorker) scheduler() {
	ticker := time.NewTicker(sqSchedulerTick)
	defer ticker.Stop()
	lastPurge := time.Time{}
	for {
		w.dispatch()
		if w.now().Sub(lastPurge) > 24*time.Hour {
			lastPurge = w.now()
			if err := w.s.sqPurgeOld(sqRetentionDays); err != nil {
				log.Warn().Err(err).Msg("send queue: purge failed")
			}
		}
		select {
		case <-w.ctx.Done():
			return
		case <-w.wake:
		case <-ticker.C:
		}
	}
}

// dispatch arranca el procesamiento de cada usuario con pendientes que aún no tenga goroutine.
func (w *sendQueueWorker) dispatch() {
	users, err := w.s.sqUsersWithPending()
	if err != nil {
		log.Warn().Err(err).Msg("send queue: could not list users with pending messages")
		return
	}
	for _, userID := range users {
		w.mu.Lock()
		if w.running[userID] {
			w.mu.Unlock()
			continue
		}
		w.running[userID] = true
		w.mu.Unlock()

		uid := userID
		w.wg.Add(1)
		safeGo("send-queue-user", func() {
			defer w.wg.Done()
			defer func() { w.mu.Lock(); delete(w.running, uid); w.mu.Unlock() }()
			w.runUser(uid)
		})
	}
}

// runUser envía los mensajes pendientes de un usuario respetando el ritmo; termina cuando no quedan.
func (w *sendQueueWorker) runUser(userID string) {
	for w.ctx.Err() == nil {
		cfg, err := w.s.sqGetConfig(userID)
		if err != nil || cfg.Paused {
			return // en pausa (o BD caída): el planificador reintentará
		}

		// Tope por hora: si se alcanzó, esperar y volver a evaluar.
		sent, err := w.s.sqSentSince(userID, w.now().Add(-time.Hour))
		if err != nil {
			return
		}
		if sent >= cfg.HourlyCap {
			if !w.sleep(w.ctx, 30*time.Second) {
				return
			}
			continue
		}

		// Respetar la pausa calculada tras el envío anterior.
		p := w.paceFor(userID)
		if wait := p.nextAt.Sub(w.now()); wait > 0 {
			if !w.sleep(w.ctx, wait) {
				return
			}
			continue // la política pudo cambiar durante la espera
		}

		item, err := w.s.sqClaimNext(userID)
		if err != nil || item == nil {
			return
		}
		w.process(item)

		p.inBatch++
		if p.inBatch >= cfg.BatchSize {
			p.inBatch = 0
			p.nextAt = w.now().Add(w.jitter(cfg.BatchPauseMin, cfg.BatchPauseMax))
		} else {
			p.nextAt = w.now().Add(w.jitter(cfg.MsgDelayMin, cfg.MsgDelayMax))
		}
	}
}

func (w *sendQueueWorker) paceFor(userID string) *sqPace {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.pace[userID] == nil {
		w.pace[userID] = &sqPace{}
	}
	return w.pace[userID]
}

// process reproduce la petición guardada y registra el resultado.
func (w *sendQueueWorker) process(item *sendQueueItem) {
	var token string
	if err := w.s.db.Get(&token, `SELECT token FROM users WHERE id=$1`, item.UserID); err != nil {
		w.finish(item, sqFailed, "", "user not found")
		return
	}
	req := httptest.NewRequest(http.MethodPost, item.Path, strings.NewReader(item.Body))
	req = req.WithContext(context.WithValue(w.ctx, sqReplayKey{}, true))
	req.Header.Set("token", token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	w.s.router.ServeHTTP(rec, req)

	body := rec.Body.String()
	switch {
	case rec.Code >= 200 && rec.Code < 300:
		w.finish(item, sqSent, extractMessageID(body), "")
	case w.ctx.Err() != nil:
		_ = w.s.sqRelease(item.ID) // apagado a mitad de envío: se reintenta al arrancar
	case rec.Code >= 500 && item.Attempts < sqMaxAttempts:
		_ = w.s.sqFinish(item.ID, sqPending, "", body) // se reintenta tras la pausa de ritmo
	default:
		w.finish(item, sqFailed, "", body)
	}
}

// finish guarda el estado final y avisa por webhook/stdio con el evento QueuedMessageStatus.
func (w *sendQueueWorker) finish(item *sendQueueItem, status, messageID, errText string) {
	if err := w.s.sqFinish(item.ID, status, messageID, errText); err != nil {
		log.Error().Err(err).Str("queueId", item.ID).Msg("send queue: could not save result")
	}
	mycli := clientManager.GetMyClient(item.UserID)
	if mycli == nil {
		return
	}
	sendEventWithWebHook(mycli, map[string]interface{}{
		"type": "QueuedMessageStatus",
		"event": map[string]interface{}{
			"QueueId": item.ID, "Status": status, "MessageId": messageID, "Error": errText,
		},
	}, "")
}

// sqSleep espera d o hasta que se cancele ctx (devuelve false en ese caso).
func sqSleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

// sqJitter devuelve una duración aleatoria entre min y max segundos (ambos incluidos).
func sqJitter(min, max int) time.Duration {
	if max <= min {
		return time.Duration(min) * time.Second
	}
	return time.Duration(min+rand.Intn(max-min+1)) * time.Second
}

// extractMessageID lee data.Id de la respuesta estándar {"code":..,"data":{"Id":..}}.
func extractMessageID(body string) string {
	var env struct {
		Data struct {
			Id string `json:"Id"`
		} `json:"data"`
	}
	_ = json.Unmarshal([]byte(body), &env)
	return env.Data.Id
}
