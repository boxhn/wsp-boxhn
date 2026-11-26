// client_access.go — Acceso restringido del cliente web (/client).
//
// Qué hace: permite dar a otra persona (por ejemplo un asistente) un TOKEN DE CLIENTE
// distinto del token del usuario. Quien lo usa solo puede hacer lo que el dueño
// permitió: ver o no contactos, grupos e historial, configurar el historial y borrar
// conversaciones. Enviar mensajes a un número que ya conoce siempre está permitido.
// Qué expone: clientAccess, los middlewares clientAccessAuth / clientAccessGuard y los
// handlers GetClientAccess, SetClientAccess, DeleteClientAccess y DeleteClientHistory.
// Depende de: migración 19 (migrations.go), authalice (handlers.go), handlers_client.go
// (que filtra conversaciones y mensajes con clientVisibility).
// Documentación: docs/client-access.md.
//
// Cómo funciona: clientAccessAuth corre ANTES de authalice. Si el token recibido es un
// token de cliente, lo sustituye por el token real del usuario (así toda la autenticación
// y las cachés siguen igual) y deja la política en el contexto. clientAccessGuard corre
// DESPUÉS y solo deja pasar una lista cerrada de rutas. Lo que no está en la lista es 403.
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/patrickmn/go-cache"
	"github.com/rs/zerolog/log"
)

// clientAccess es la política de un token de cliente. Los permisos arrancan todos en
// falso: el dueño decide qué abre.
type clientAccess struct {
	UserID             string
	Token              string
	Enabled            bool
	AllowContacts      bool
	AllowGroups        bool
	AllowHistory       bool
	AllowHistoryConfig bool
	AllowDeleteHistory bool
	// HistorySince (segundos Unix) es la fecha de corte cuando AllowHistory es falso:
	// el cliente solo ve mensajes enviados a partir de ese momento.
	HistorySince int64
}

type clientAccessCtxKey struct{}

// clientAccessCache evita consultar la base en cada petición. Guarda también los
// "no es token de cliente" (clientAccessNone) para que los tokens normales no paguen
// una consulta extra. Se vacía entero al cambiar cualquier política.
var (
	clientAccessCache = cache.New(30*time.Second, time.Minute)
	clientAccessNone  = &clientAccess{}
)

// clientPolicyFrom devuelve la política de la petición, o nil si la hace el dueño
// (token normal) y por tanto no tiene restricciones.
func clientPolicyFrom(r *http.Request) *clientAccess {
	p, _ := r.Context().Value(clientAccessCtxKey{}).(*clientAccess)
	return p
}

func newClientToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "cl_" + hex.EncodeToString(b), nil
}

// ---- acceso a base de datos ----

const clientAccessColumns = `user_id, client_token, enabled, allow_contacts, allow_groups,
	allow_history, allow_history_config, allow_delete_history, history_since`

func scanClientAccess(row interface{ Scan(...any) error }) (*clientAccess, error) {
	var p clientAccess
	var enabled, contacts, groups, history, historyConfig, deleteHistory int
	err := row.Scan(&p.UserID, &p.Token, &enabled, &contacts, &groups, &history, &historyConfig, &deleteHistory, &p.HistorySince)
	if err != nil {
		return nil, err
	}
	p.Enabled, p.AllowContacts, p.AllowGroups = enabled != 0, contacts != 0, groups != 0
	p.AllowHistory, p.AllowHistoryConfig, p.AllowDeleteHistory = history != 0, historyConfig != 0, deleteHistory != 0
	return &p, nil
}

func (s *server) caLoad(where string, arg string) (*clientAccess, error) {
	row := s.db.QueryRow(s.db.Rebind(`SELECT `+clientAccessColumns+` FROM client_access WHERE `+where+` = ?`), arg)
	p, err := scanClientAccess(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

func b2i(v bool) int {
	if v {
		return 1
	}
	return 0
}

// caSave crea o actualiza la política (UPDATE y, si no existía, INSERT: sirve igual en
// SQLite y PostgreSQL) y vacía la caché.
func (s *server) caSave(p *clientAccess) error {
	res, err := s.db.Exec(s.db.Rebind(`UPDATE client_access SET client_token=?, enabled=?, allow_contacts=?, allow_groups=?,
		allow_history=?, allow_history_config=?, allow_delete_history=?, history_since=? WHERE user_id=?`),
		p.Token, b2i(p.Enabled), b2i(p.AllowContacts), b2i(p.AllowGroups), b2i(p.AllowHistory),
		b2i(p.AllowHistoryConfig), b2i(p.AllowDeleteHistory), p.HistorySince, p.UserID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		_, err = s.db.Exec(s.db.Rebind(`INSERT INTO client_access (`+clientAccessColumns+`) VALUES (?,?,?,?,?,?,?,?,?)`),
			p.UserID, p.Token, b2i(p.Enabled), b2i(p.AllowContacts), b2i(p.AllowGroups), b2i(p.AllowHistory),
			b2i(p.AllowHistoryConfig), b2i(p.AllowDeleteHistory), p.HistorySince)
		if err != nil {
			return err
		}
	}
	clientAccessCache.Flush()
	return nil
}

func (s *server) clientPolicyForToken(token string) *clientAccess {
	if v, ok := clientAccessCache.Get(token); ok {
		if p := v.(*clientAccess); p != clientAccessNone {
			return p
		}
		return nil
	}
	p, err := s.caLoad("client_token", token)
	if err != nil {
		log.Error().Err(err).Msg("client access lookup failed")
		return nil // sin caché: se reintenta en la siguiente petición
	}
	if p == nil {
		clientAccessCache.Set(token, clientAccessNone, cache.DefaultExpiration)
		return nil
	}
	clientAccessCache.Set(token, p, cache.DefaultExpiration)
	return p
}

// ---- middlewares ----

// clientAccessAuth traduce un token de cliente al token real del usuario y anota la
// política en el contexto. Los tokens normales pasan sin cambios.
func (s *server) clientAccessAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("token")
		if token == "" {
			token = strings.Join(r.URL.Query()["token"], "")
		}
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		p := s.clientPolicyForToken(token)
		if p == nil {
			next.ServeHTTP(w, r)
			return
		}
		if !p.Enabled {
			s.Respond(w, r, http.StatusUnauthorized, errors.New("unauthorized"))
			return
		}
		var userToken string
		if err := s.db.Get(&userToken, s.db.Rebind("SELECT token FROM users WHERE id = ?"), p.UserID); err != nil || userToken == "" {
			s.Respond(w, r, http.StatusUnauthorized, errors.New("unauthorized"))
			return
		}
		r2 := r.Clone(context.WithValue(r.Context(), clientAccessCtxKey{}, p))
		r2.Header.Set("token", userToken)
		q := r2.URL.Query()
		q.Del("token")
		r2.URL.RawQuery = q.Encode()
		next.ServeHTTP(w, r2)
	})
}

const clientDenied = "this action is not available with a client access token"

// allows decide si una petición con token de cliente puede continuar. Lista cerrada:
// solo lo que usa el cliente web. Todo lo demás (webhook, proxy, S3, HMAC, cerrar sesión,
// administrar el acceso, borrar chats en el teléfono...) queda reservado al dueño.
func (p *clientAccess) allows(method, path string) (bool, string) {
	get, post := method == http.MethodGet, method == http.MethodPost
	switch {
	case get && (path == "/session/status" || path == "/session/qr" || path == "/session/client-access" ||
		path == "/chat/conversations" || path == "/chat/messages"):
		return true, ""
	case post && (path == "/session/connect" || path == "/session/pairphone" || path == "/user/check" ||
		path == "/user/avatar" || path == "/chat/markread" || path == "/chat/markplayed" || path == "/chat/presence"):
		return true, ""
	case post && (strings.HasPrefix(path, "/chat/send/") || strings.HasPrefix(path, "/chat/download")):
		return true, ""
	case path == "/session/history" && (get || post):
		return p.AllowHistoryConfig, "history settings are disabled for this client access"
	case get && path == "/user/contacts":
		return p.AllowContacts, "contacts are disabled for this client access"
	case (get && path == "/group/list") || (post && path == "/group/create"):
		return p.AllowGroups, "groups are disabled for this client access"
	case post && path == "/chat/history/delete":
		return p.AllowDeleteHistory, "deleting history is disabled for this client access"
	}
	return false, clientDenied
}

// clientAccessGuard aplica allows y limpia de /session/status todo lo que no es del
// cliente (token del usuario, webhook, proxy, S3, HMAC, eventos).
func (s *server) clientAccessGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := clientPolicyFrom(r)
		if p == nil {
			next.ServeHTTP(w, r)
			return
		}
		if ok, reason := p.allows(r.Method, r.URL.Path); !ok {
			s.Respond(w, r, http.StatusForbidden, errors.New(reason))
			return
		}
		if r.URL.Path == "/session/status" {
			buf := &bufferedResponse{ResponseWriter: w, code: http.StatusOK}
			next.ServeHTTP(buf, r)
			buf.flushSanitized()
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Campos de /session/status que un token de cliente no debe ver.
var clientStatusHidden = []string{"token", "webhook", "events", "proxy_url", "proxy_config", "proxy_pool_id", "s3_config", "hmac_configured"}

type bufferedResponse struct {
	http.ResponseWriter
	code int
	body bytes.Buffer
}

func (b *bufferedResponse) WriteHeader(code int)        { b.code = code }
func (b *bufferedResponse) Write(p []byte) (int, error) { return b.body.Write(p) }

func (b *bufferedResponse) flushSanitized() {
	out := b.body.Bytes()
	var doc map[string]interface{}
	if json.Unmarshal(out, &doc) == nil {
		if data, ok := doc["data"].(map[string]interface{}); ok {
			for _, k := range clientStatusHidden {
				delete(data, k)
			}
			if clean, err := json.Marshal(doc); err == nil {
				out = append(clean, '\n')
			}
		}
	}
	b.ResponseWriter.Header().Del("Content-Length")
	b.ResponseWriter.WriteHeader(b.code)
	_, _ = b.ResponseWriter.Write(out)
}

// ---- filtro de lo que el cliente puede ver ----

// clientVisibility devuelve el trozo de SQL (empieza con " AND") y sus argumentos que
// limitan message_history a lo visible para el cliente. Para el dueño no filtra nada.
// Sin AllowHistory solo cuenta lo enviado desde HistorySince (sent_at es la hora real
// de WhatsApp; timestamp es cuando se guardó la fila y los mensajes viejos de una
// sincronización se guardan "hoy"). Sin AllowGroups se ocultan los chats de grupo.
func clientVisibility(p *clientAccess) (string, []interface{}) {
	if p == nil {
		return "", nil
	}
	clause := ""
	var args []interface{}
	if !p.AllowGroups {
		clause += " AND chat_jid NOT LIKE '%@g.us'"
	}
	if !p.AllowHistory {
		clause += " AND COALESCE(sent_at, timestamp) >= ?"
		args = append(args, time.Unix(p.HistorySince, 0).UTC())
	}
	return clause, args
}

func isGroupChat(jid string) bool { return strings.HasSuffix(jid, "@g.us") }

// ---- handlers ----

type clientAccessView struct {
	Restricted         bool   `json:"Restricted"`
	Configured         bool   `json:"Configured"`
	Enabled            bool   `json:"Enabled"`
	Token              string `json:"Token,omitempty"`
	AllowContacts      bool   `json:"AllowContacts"`
	AllowGroups        bool   `json:"AllowGroups"`
	AllowHistory       bool   `json:"AllowHistory"`
	AllowHistoryConfig bool   `json:"AllowHistoryConfig"`
	AllowDeleteHistory bool   `json:"AllowDeleteHistory"`
	HistorySince       int64  `json:"HistorySince"`
}

func viewOf(p *clientAccess, restricted bool) clientAccessView {
	if p == nil {
		return clientAccessView{}
	}
	v := clientAccessView{
		Restricted: restricted, Configured: true, Enabled: p.Enabled,
		AllowContacts: p.AllowContacts, AllowGroups: p.AllowGroups, AllowHistory: p.AllowHistory,
		AllowHistoryConfig: p.AllowHistoryConfig, AllowDeleteHistory: p.AllowDeleteHistory, HistorySince: p.HistorySince,
	}
	if !restricted {
		v.Token = p.Token // solo el dueño ve el token
	}
	return v
}

func (s *server) respondClientAccess(w http.ResponseWriter, r *http.Request, status int, v clientAccessView) {
	body, _ := json.Marshal(v)
	s.Respond(w, r, status, string(body))
}

// GetClientAccess: el dueño ve la configuración completa (con el token); quien usa el
// token de cliente solo ve sus permisos, para que el cliente web oculte lo que no puede.
func (s *server) GetClientAccess() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if p := clientPolicyFrom(r); p != nil {
			s.respondClientAccess(w, r, http.StatusOK, viewOf(p, true))
			return
		}
		userID := r.Context().Value("userinfo").(Values).Get("Id")
		p, err := s.caLoad("user_id", userID)
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, errors.New("could not read client access"))
			return
		}
		s.respondClientAccess(w, r, http.StatusOK, viewOf(p, false))
	}
}

// SetClientAccess crea o actualiza la configuración. Los campos ausentes no cambian.
// Al crearla se genera el token y todos los permisos quedan cerrados.
func (s *server) SetClientAccess() http.HandlerFunc {
	type request struct {
		Enabled            *bool
		AllowContacts      *bool
		AllowGroups        *bool
		AllowHistory       *bool
		AllowHistoryConfig *bool
		AllowDeleteHistory *bool
		ResetHistorySince  bool
		RegenerateToken    bool
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := decodeAPIRequest(r.Body, &req); err != nil {
			s.Respond(w, r, http.StatusBadRequest, err)
			return
		}
		userID := r.Context().Value("userinfo").(Values).Get("Id")
		p, err := s.caLoad("user_id", userID)
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, errors.New("could not read client access"))
			return
		}
		now := time.Now().Unix()
		if p == nil {
			token, err := newClientToken()
			if err != nil {
				s.Respond(w, r, http.StatusInternalServerError, errors.New("could not create token"))
				return
			}
			p = &clientAccess{UserID: userID, Token: token, Enabled: true, HistorySince: now}
		} else if req.RegenerateToken {
			if p.Token, err = newClientToken(); err != nil {
				s.Respond(w, r, http.StatusInternalServerError, errors.New("could not create token"))
				return
			}
		}
		wasHistory := p.AllowHistory
		set := func(dst *bool, v *bool) {
			if v != nil {
				*dst = *v
			}
		}
		set(&p.Enabled, req.Enabled)
		set(&p.AllowContacts, req.AllowContacts)
		set(&p.AllowGroups, req.AllowGroups)
		set(&p.AllowHistory, req.AllowHistory)
		set(&p.AllowHistoryConfig, req.AllowHistoryConfig)
		set(&p.AllowDeleteHistory, req.AllowDeleteHistory)
		// Al cerrar el historial, el corte arranca "ahora" (o se reinicia a petición).
		if (wasHistory && !p.AllowHistory) || req.ResetHistorySince || p.HistorySince == 0 {
			p.HistorySince = now
		}
		if err := s.caSave(p); err != nil {
			s.Respond(w, r, http.StatusInternalServerError, errors.New("could not save client access"))
			return
		}
		s.respondClientAccess(w, r, http.StatusOK, viewOf(p, false))
	}
}

// DeleteClientAccess revoca el token de cliente (la configuración se elimina).
func (s *server) DeleteClientAccess() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Context().Value("userinfo").(Values).Get("Id")
		if _, err := s.db.Exec(s.db.Rebind("DELETE FROM client_access WHERE user_id = ?"), userID); err != nil {
			s.Respond(w, r, http.StatusInternalServerError, errors.New("could not delete client access"))
			return
		}
		clientAccessCache.Flush()
		s.Respond(w, r, http.StatusOK, `{"Details":"Client access removed"}`)
	}
}

// DeleteClientHistory borra mensajes guardados en el historial LOCAL (no toca el
// teléfono ni WhatsApp). Con token de cliente solo borra lo que ese cliente puede ver.
func (s *server) DeleteClientHistory() http.HandlerFunc {
	type request struct {
		ChatJID string `json:"chat_jid"`
		All     bool   `json:"all"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := decodeAPIRequest(r.Body, &req); err != nil {
			s.Respond(w, r, http.StatusBadRequest, err)
			return
		}
		if !req.All && req.ChatJID == "" {
			s.Respond(w, r, http.StatusBadRequest, errors.New("chat_jid or all is required"))
			return
		}
		if req.All && req.ChatJID != "" {
			s.Respond(w, r, http.StatusBadRequest, errors.New("use chat_jid or all, not both"))
			return
		}
		userID := r.Context().Value("userinfo").(Values).Get("Id")
		p := clientPolicyFrom(r)
		if p != nil && !p.AllowGroups && isGroupChat(req.ChatJID) {
			s.Respond(w, r, http.StatusForbidden, errors.New("groups are disabled for this client access"))
			return
		}
		query := "DELETE FROM message_history WHERE user_id = ?"
		args := []interface{}{userID}
		if !req.All {
			query += " AND chat_jid = ?"
			args = append(args, req.ChatJID)
		}
		clause, extra := clientVisibility(p)
		query += clause
		args = append(args, extra...)
		res, err := s.db.ExecContext(r.Context(), s.db.Rebind(query), args...)
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, errors.New("could not delete history"))
			return
		}
		n, _ := res.RowsAffected()
		body, _ := json.Marshal(map[string]int64{"Deleted": n})
		s.Respond(w, r, http.StatusOK, string(body))
	}
}
