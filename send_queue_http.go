// send_queue_http.go — Cola de envío pausado: puerta de entrada y endpoints HTTP.
//
// Qué hace: (1) sendQueueGate envuelve cada POST /chat/send/*; si el usuario
// tiene la cola activada guarda la petición y responde 202 en vez de enviar.
// (2) Endpoints para configurar la política, listar y cancelar mensajes.
// Qué expone: s.sendQueueGate, s.GetSendQueueConfig, s.SetSendQueueConfig,
// s.ListSendQueue, s.CancelSendQueueItem.
// Depende de: send_queue.go (BD), send_queue_worker.go (wakeSendQueue), authalice
// (el usuario viaja en el contexto bajo "userinfo").
// Documentación: static/guia/send-queue.md.
//
// Limitación: los medios viajan en base64 dentro del cuerpo, así que se limita
// el tamaño de lo que se encola (sendQueueMaxBody).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// sendQueueMaxBody: tope del cuerpo que se guarda en la cola (25 MiB).
const sendQueueMaxBody = 25 << 20

// sqReplayKey marca en el contexto las peticiones que reproduce el worker, para
// que la puerta no las vuelva a encolar. Un cliente externo no puede ponerla.
type sqReplayKey struct{}

// sendQueueGate decide si la petición de envío sale ya o se encola.
func (s *server) sendQueueGate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Context().Value(sqReplayKey{}) != nil {
			next.ServeHTTP(w, r)
			return
		}
		userID := r.Context().Value("userinfo").(Values).Get("Id")
		cfg, err := s.sqGetConfig(userID)
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, err)
			return
		}
		if !cfg.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, sendQueueMaxBody))
		if err != nil {
			s.Respond(w, r, http.StatusRequestEntityTooLarge, errors.New("request too large to queue"))
			return
		}
		if !json.Valid(body) {
			s.Respond(w, r, http.StatusBadRequest, errors.New("could not decode Payload"))
			return
		}
		id, pos, err := s.sqEnqueue(userID, r.URL.Path, string(body))
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, err)
			return
		}
		wakeSendQueue()
		resp, _ := json.Marshal(map[string]interface{}{"Details": "Queued", "QueueId": id, "Position": pos})
		s.Respond(w, r, http.StatusAccepted, string(resp))
	})
}

func userIDFromContext(ctx context.Context) string {
	return ctx.Value("userinfo").(Values).Get("Id")
}

// GetSendQueueConfig devuelve la política de ritmo del usuario.
func (s *server) GetSendQueueConfig() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := s.sqGetConfig(userIDFromContext(r.Context()))
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, err)
			return
		}
		resp, _ := json.Marshal(cfg)
		s.Respond(w, r, http.StatusOK, string(resp))
	}
}

// SetSendQueueConfig reemplaza la política. Los campos omitidos toman el valor por defecto.
func (s *server) SetSendQueueConfig() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg := defaultSendQueueConfig()
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			s.Respond(w, r, http.StatusBadRequest, errors.New("could not decode Payload"))
			return
		}
		if err := cfg.validate(); err != nil {
			s.Respond(w, r, http.StatusBadRequest, err)
			return
		}
		if err := s.sqSaveConfig(userIDFromContext(r.Context()), cfg); err != nil {
			s.Respond(w, r, http.StatusInternalServerError, err)
			return
		}
		wakeSendQueue()
		resp, _ := json.Marshal(cfg)
		s.Respond(w, r, http.StatusOK, string(resp))
	}
}

// ListSendQueue lista los mensajes en cola. Query: ?status=pending|sent|failed|cancelled&limit=50
func (s *server) ListSendQueue() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if limit < 1 || limit > 500 {
			limit = 50
		}
		items, err := s.sqList(userIDFromContext(r.Context()), r.URL.Query().Get("status"), limit)
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, err)
			return
		}
		resp, _ := json.Marshal(items)
		s.Respond(w, r, http.StatusOK, string(resp))
	}
}

// CancelSendQueueItem cancela un mensaje pendiente (DELETE /chat/queue/{id}).
func (s *server) CancelSendQueueItem() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ok, err := s.sqCancel(userIDFromContext(r.Context()), mux.Vars(r)["id"])
		if err != nil {
			s.Respond(w, r, http.StatusInternalServerError, err)
			return
		}
		if !ok {
			s.Respond(w, r, http.StatusNotFound, errors.New("queued message not found or no longer pending"))
			return
		}
		s.Respond(w, r, http.StatusOK, `{"Details":"Cancelled"}`)
	}
}
