// send_queue_test.go — Pruebas de la cola de envío pausado (static/guia/send-queue.md).
//
// Usan makeTestServer (SQLite en memoria) y un reloj/sleep falsos: no esperan
// segundos reales ni necesitan una cuenta de WhatsApp. El envío real se
// sustituye por la ruta de prueba /chat/send/fake, que responde 200 con un Id.
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

// sqTestUser crea un usuario y devuelve su id y token.
func sqTestUser(t *testing.T, s *server, id string) (string, string) {
	t.Helper()
	token := "tok-" + id
	if _, err := s.db.Exec(`INSERT INTO users (id, name, token, connected) VALUES ($1,$2,$3,0)`, id, id, token); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return id, token
}

// sqFakeRoute registra /chat/send/fake: autentica y responde como un envío correcto.
// Se antepone un router nuevo porque routes() deja un comodín que taparía rutas añadidas después.
func sqFakeRoute(s *server) {
	front := mux.NewRouter()
	front.Handle("/chat/send/fake", s.authalice(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.Respond(w, r, http.StatusOK, `{"Details":"Sent","Id":"WA-ID-1"}`)
	}))).Methods("POST")
	front.PathPrefix("/").Handler(s.router)
	s.router = front
}

func sqPost(s *server, method, path, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("token", token)
	rec := httptest.NewRecorder()
	s.router.ServeHTTP(rec, req)
	return rec
}

func sqCount(t *testing.T, s *server, userID, status string) int {
	t.Helper()
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM send_queue WHERE user_id=$1 AND status=$2`, userID, status).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestSendQueueDisabledPassesThrough(t *testing.T) {
	s := makeTestServer(t)
	userID, token := sqTestUser(t, s, "u1")
	rec := sqPost(s, "POST", "/chat/send/text", token, `{"Phone":"1","Body":"hola"}`)
	if rec.Code == http.StatusAccepted {
		t.Fatalf("con la cola desactivada no debe responder 202")
	}
	if n := sqCount(t, s, userID, sqPending); n != 0 {
		t.Fatalf("no debe encolar, hay %d", n)
	}
}

func TestSendQueueEnabledQueues(t *testing.T) {
	s := makeTestServer(t)
	userID, token := sqTestUser(t, s, "u1")
	if rec := sqPost(s, "POST", "/session/sendqueue/config", token, `{"Enabled":true}`); rec.Code != http.StatusOK {
		t.Fatalf("config: %d %s", rec.Code, rec.Body)
	}
	rec := sqPost(s, "POST", "/chat/send/text", token, `{"Phone":"1","Body":"hola"}`)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("esperaba 202, got %d %s", rec.Code, rec.Body)
	}
	if n := sqCount(t, s, userID, sqPending); n != 1 {
		t.Fatalf("esperaba 1 pendiente, hay %d", n)
	}
	if rec := sqPost(s, "POST", "/chat/send/text", token, `no es json`); rec.Code != http.StatusBadRequest {
		t.Fatalf("JSON inválido debe dar 400, got %d", rec.Code)
	}
}

func TestSendQueueConfigValidation(t *testing.T) {
	s := makeTestServer(t)
	_, token := sqTestUser(t, s, "u1")
	for _, body := range []string{
		`{"BatchSize":0}`,
		`{"MsgDelayMin":10,"MsgDelayMax":5}`,
		`{"HourlyCap":0}`,
	} {
		if rec := sqPost(s, "POST", "/session/sendqueue/config", token, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: esperaba 400, got %d", body, rec.Code)
		}
	}
}

func TestSendQueueCancelIsolatedPerUser(t *testing.T) {
	s := makeTestServer(t)
	u1, tok1 := sqTestUser(t, s, "u1")
	_, tok2 := sqTestUser(t, s, "u2")
	id, _, err := s.sqEnqueue(u1, "/chat/send/fake", `{}`)
	if err != nil {
		t.Fatal(err)
	}
	if rec := sqPost(s, "DELETE", "/chat/queue/"+id, tok2, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("otro usuario no debe poder cancelar: %d", rec.Code)
	}
	if rec := sqPost(s, "DELETE", "/chat/queue/"+id, tok1, ""); rec.Code != http.StatusOK {
		t.Fatalf("el dueño debe poder cancelar: %d", rec.Code)
	}
	if n := sqCount(t, s, u1, sqCancelled); n != 1 {
		t.Fatalf("esperaba 1 cancelado, hay %d", n)
	}
}

// sqTestWorker devuelve un worker con reloj falso: sleep avanza el reloj y registra la espera.
func sqTestWorker(s *server, sleeps *[]time.Duration) *sendQueueWorker {
	w := newSendQueueWorker(s)
	clock := time.Now()
	w.now = func() time.Time { return clock }
	w.sleep = func(ctx context.Context, d time.Duration) bool {
		*sleeps = append(*sleeps, d)
		clock = clock.Add(d)
		return ctx.Err() == nil
	}
	return w
}

func TestSendQueueWorkerPacesBatches(t *testing.T) {
	s := makeTestServer(t)
	sqFakeRoute(s)
	userID, _ := sqTestUser(t, s, "u1")
	cfg := defaultSendQueueConfig()
	cfg.Enabled, cfg.BatchSize = true, 3
	cfg.MsgDelayMin, cfg.MsgDelayMax = 5, 5
	cfg.BatchPauseMin, cfg.BatchPauseMax = 100, 100
	if err := s.sqSaveConfig(userID, cfg); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 7; i++ {
		if _, _, err := s.sqEnqueue(userID, "/chat/send/fake", `{"Phone":"1","Body":"x"}`); err != nil {
			t.Fatal(err)
		}
	}

	var sleeps []time.Duration
	w := sqTestWorker(s, &sleeps)
	w.runUser(userID)

	if n := sqCount(t, s, userID, sqSent); n != 7 {
		it, _ := s.sqList(userID, "", 10)
		b, _ := json.Marshal(it)
		t.Fatalf("esperaba 7 enviados, hay %d: %s", n, b)
	}
	want := []time.Duration{5 * time.Second, 5 * time.Second, 100 * time.Second, 5 * time.Second, 5 * time.Second, 100 * time.Second}
	for i, d := range want {
		if i >= len(sleeps) || sleeps[i] != d {
			t.Fatalf("pausas esperadas %v, got %v", want, sleeps)
		}
	}
	items, _ := s.sqList(userID, sqSent, 10)
	if items[0].MessageID != "WA-ID-1" {
		t.Fatalf("debe guardar el Id del mensaje, got %q", items[0].MessageID)
	}
}

func TestSendQueueWorkerHourlyCap(t *testing.T) {
	s := makeTestServer(t)
	sqFakeRoute(s)
	userID, _ := sqTestUser(t, s, "u1")
	cfg := defaultSendQueueConfig()
	cfg.Enabled, cfg.HourlyCap = true, 2
	cfg.MsgDelayMin, cfg.MsgDelayMax, cfg.BatchPauseMin, cfg.BatchPauseMax = 0, 0, 0, 0
	if err := s.sqSaveConfig(userID, cfg); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		_, _, _ = s.sqEnqueue(userID, "/chat/send/fake", `{}`)
	}

	var sleeps []time.Duration
	w := sqTestWorker(s, &sleeps)
	w.sleep = func(ctx context.Context, d time.Duration) bool {
		sleeps = append(sleeps, d)
		w.cancel() // al llegar al tope el worker espera: cortamos ahí
		return false
	}
	w.runUser(userID)

	if n := sqCount(t, s, userID, sqSent); n != 2 {
		t.Fatalf("el tope es 2, se enviaron %d", n)
	}
	if n := sqCount(t, s, userID, sqPending); n != 1 {
		t.Fatalf("debe quedar 1 pendiente, hay %d", n)
	}
	if len(sleeps) != 1 || sleeps[0] != 30*time.Second {
		t.Fatalf("debía esperar 30s por el tope, pausas: %v", sleeps)
	}
}

func TestSendQueueWorkerRetriesThenFails(t *testing.T) {
	s := makeTestServer(t)
	userID, _ := sqTestUser(t, s, "u1")
	// Sin sesión de WhatsApp, /chat/send/text responde 500: debe reintentar y marcar failed.
	cfg := defaultSendQueueConfig()
	cfg.Enabled = true
	cfg.MsgDelayMin, cfg.MsgDelayMax, cfg.BatchPauseMin, cfg.BatchPauseMax = 0, 0, 0, 0
	if err := s.sqSaveConfig(userID, cfg); err != nil {
		t.Fatal(err)
	}
	id, _, _ := s.sqEnqueue(userID, "/chat/send/text", `{"Phone":"1","Body":"x"}`)

	var sleeps []time.Duration
	w := sqTestWorker(s, &sleeps)
	w.runUser(userID)

	items, _ := s.sqList(userID, sqFailed, 10)
	if len(items) != 1 || items[0].ID != id || items[0].Attempts != sqMaxAttempts {
		b, _ := json.Marshal(items)
		t.Fatalf("esperaba 1 fallido con %d intentos, got %s", sqMaxAttempts, b)
	}
	if n := sqCount(t, s, userID, sqPending); n != 0 {
		t.Fatalf("no debe quedar pendiente, hay %d", n)
	}
}
