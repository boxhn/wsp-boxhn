package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
)

// caDo hace una petición contra el router real (con los middlewares) y devuelve la respuesta.
func caDo(t *testing.T, s *server, method, path, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.Header.Set("token", token)
	}
	rec := httptest.NewRecorder()
	s.router.ServeHTTP(rec, req)
	return rec
}

func caData(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var env map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("respuesta no es JSON: %s", rec.Body.String())
	}
	data, _ := env["data"].(map[string]interface{})
	return data
}

func caServer(t *testing.T, db *sqlx.DB) *server {
	t.Helper()
	if err := initializeSchema(db); err != nil {
		t.Fatal(err)
	}
	clientAccessCache.Flush()
	s := &server{db: db, router: mux.NewRouter()}
	s.routes()
	seedClientHistory(t, s, "owner", "owner-token", 100)
	return s
}

// caConfigure crea la configuración con el token del dueño y devuelve el token de cliente.
func caConfigure(t *testing.T, s *server, body string) string {
	t.Helper()
	rec := caDo(t, s, http.MethodPost, "/session/client-access", "owner-token", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("configurar: %d %s", rec.Code, rec.Body.String())
	}
	token, _ := caData(t, rec)["Token"].(string)
	if !strings.HasPrefix(token, "cl_") {
		t.Fatalf("token de cliente inesperado: %q", token)
	}
	return token
}

func TestClientAccessCreationAndSecrecy(t *testing.T) {
	historyDrivers(t, func(t *testing.T, db *sqlx.DB) {
		s := caServer(t, db)

		// Sin configurar: no hay token ni permisos.
		data := caData(t, caDo(t, s, http.MethodGet, "/session/client-access", "owner-token", ""))
		if data["Configured"] != false || data["Token"] != nil {
			t.Fatalf("debería estar sin configurar: %v", data)
		}

		token := caConfigure(t, s, `{}`)
		data = caData(t, caDo(t, s, http.MethodGet, "/session/client-access", "owner-token", ""))
		for _, k := range []string{"AllowContacts", "AllowGroups", "AllowHistory", "AllowHistoryConfig", "AllowDeleteHistory"} {
			if data[k] != false {
				t.Fatalf("%s debe arrancar cerrado: %v", k, data)
			}
		}
		if data["Token"] != token || data["Enabled"] != true {
			t.Fatalf("el dueño debe ver su token: %v", data)
		}

		// Con el token de cliente solo se ven los permisos: nunca el token.
		rec := caDo(t, s, http.MethodGet, "/session/client-access", token, "")
		cdata := caData(t, rec)
		if rec.Code != http.StatusOK || cdata["Restricted"] != true || cdata["Token"] != nil {
			t.Fatalf("vista del cliente: %d %v", rec.Code, cdata)
		}
		if strings.Contains(rec.Body.String(), "owner-token") || strings.Contains(rec.Body.String(), token) {
			t.Fatal("la vista del cliente no debe filtrar ningún token")
		}

		// Regenerar el token invalida el anterior.
		newToken := caConfigure(t, s, `{"RegenerateToken":true}`)
		if newToken == token {
			t.Fatal("el token debía cambiar")
		}
		if code := caDo(t, s, http.MethodGet, "/chat/conversations", token, "").Code; code != http.StatusUnauthorized {
			t.Fatalf("token anterior: %d, quiero 401", code)
		}
	})
}

func TestClientAccessAllowlist(t *testing.T) {
	historyDrivers(t, func(t *testing.T, db *sqlx.DB) {
		s := caServer(t, db)
		token := caConfigure(t, s, `{}`)

		// Reservado al dueño: configuración, webhook, S3, proxy, HMAC, cerrar sesión, cola, borrar chat en el teléfono.
		for _, c := range []struct{ method, path string }{
			{http.MethodPost, "/session/client-access"}, {http.MethodDelete, "/session/client-access"},
			{http.MethodGet, "/webhook"}, {http.MethodPost, "/webhook"}, {http.MethodDelete, "/webhook"},
			{http.MethodGet, "/session/s3/config"}, {http.MethodPost, "/session/proxy"},
			{http.MethodGet, "/session/hmac/config"}, {http.MethodPost, "/session/logout"},
			{http.MethodPost, "/session/disconnect"}, {http.MethodPost, "/session/sendqueue/config"},
			{http.MethodGet, "/chat/queue"}, {http.MethodPost, "/chat/deletechat"}, {http.MethodGet, "/user/blocklist"},
			{http.MethodPost, "/user/block"}, {http.MethodGet, "/user/privacy"},
		} {
			if code := caDo(t, s, c.method, c.path, token, `{}`).Code; code != http.StatusForbidden {
				t.Errorf("%s %s con token de cliente: %d, quiero 403", c.method, c.path, code)
			}
		}

		// Cerrado por defecto y abierto solo con el permiso correspondiente.
		gated := []struct{ method, path, perm string }{
			{http.MethodGet, "/user/contacts", "AllowContacts"},
			{http.MethodGet, "/group/list", "AllowGroups"},
			{http.MethodPost, "/group/create", "AllowGroups"},
			{http.MethodGet, "/session/history", "AllowHistoryConfig"},
			{http.MethodPost, "/session/history", "AllowHistoryConfig"},
			{http.MethodPost, "/chat/history/delete", "AllowDeleteHistory"},
		}
		for _, g := range gated {
			if code := caDo(t, s, g.method, g.path, token, `{"chat_jid":"1@lid"}`).Code; code != http.StatusForbidden {
				t.Errorf("%s %s cerrado: %d, quiero 403", g.method, g.path, code)
			}
			caConfigure(t, s, `{"`+g.perm+`":true}`)
			if code := caDo(t, s, g.method, g.path, token, `{"chat_jid":"1@lid"}`).Code; code == http.StatusForbidden || code == http.StatusUnauthorized {
				t.Errorf("%s %s con %s: %d, no debía bloquearse", g.method, g.path, g.perm, code)
			}
			caConfigure(t, s, `{"`+g.perm+`":false}`)
		}

		// Enviar mensajes nunca se bloquea por política (la cola o la sesión pueden responder otra cosa).
		if code := caDo(t, s, http.MethodPost, "/chat/send/text", token, `{"Phone":"1","Body":"hola"}`).Code; code == http.StatusForbidden {
			t.Errorf("enviar texto no debe estar bloqueado: %d", code)
		}

		// Deshabilitado: 401.
		caConfigure(t, s, `{"Enabled":false}`)
		if code := caDo(t, s, http.MethodGet, "/chat/conversations", token, "").Code; code != http.StatusUnauthorized {
			t.Errorf("token deshabilitado: %d, quiero 401", code)
		}
		// Revocado: el token ya no existe.
		caDo(t, s, http.MethodDelete, "/session/client-access", "owner-token", "")
		if code := caDo(t, s, http.MethodGet, "/chat/conversations", token, "").Code; code != http.StatusUnauthorized {
			t.Errorf("token revocado: %d, quiero 401", code)
		}
		// El dueño no se ve afectado.
		if code := caDo(t, s, http.MethodGet, "/user/contacts", "owner-token", "").Code; code == http.StatusForbidden || code == http.StatusUnauthorized {
			t.Errorf("el dueño no debe tener restricciones: %d", code)
		}
	})
}

func chatsOf(t *testing.T, rec *httptest.ResponseRecorder) []string {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("conversaciones: %d %s", rec.Code, rec.Body.String())
	}
	var out []string
	chats, _ := caData(t, rec)["chats"].([]interface{})
	for _, c := range chats {
		out = append(out, c.(map[string]interface{})["chat_jid"].(string))
	}
	return out
}

func TestClientAccessHistoryVisibility(t *testing.T) {
	historyDrivers(t, func(t *testing.T, db *sqlx.DB) {
		s := caServer(t, db)
		now := time.Now().UTC().Truncate(time.Second)
		// Mensajes anteriores al corte (viejos), uno posterior, y uno de grupo posterior.
		insertClientMessage(t, s, "owner", "111@lid", "old1", "antiguo", now.Add(-48*time.Hour))
		insertClientMessage(t, s, "owner", "222@lid", "old2", "antiguo 2", now.Add(-24*time.Hour))
		insertClientMessage(t, s, "owner", "999@g.us", "oldg", "grupo antiguo", now.Add(-24*time.Hour))

		token := caConfigure(t, s, `{}`) // el corte queda en "ahora"
		time.Sleep(1100 * time.Millisecond)
		later := time.Now().UTC()
		insertClientMessage(t, s, "owner", "333@lid", "new1", "nuevo", later)
		insertClientMessage(t, s, "owner", "999@g.us", "newg", "grupo nuevo", later)

		// El dueño ve todo.
		if got := chatsOf(t, caDo(t, s, http.MethodGet, "/chat/conversations", "owner-token", "")); len(got) != 4 {
			t.Fatalf("el dueño debe ver 4 chats: %v", got)
		}
		// Cliente sin historial y sin grupos: solo el chat nuevo individual.
		got := chatsOf(t, caDo(t, s, http.MethodGet, "/chat/conversations", token, ""))
		if len(got) != 1 || got[0] != "333@lid" {
			t.Fatalf("cliente restringido debe ver solo 333@lid: %v", got)
		}
		// Los mensajes antiguos de un chat visible tampoco aparecen.
		insertClientMessage(t, s, "owner", "333@lid", "old3", "viejo del mismo chat", now.Add(-72*time.Hour))
		msgs := caData(t, caDo(t, s, http.MethodGet, "/chat/messages?chat_jid=333@lid", token, ""))["messages"].([]interface{})
		if len(msgs) != 1 {
			t.Fatalf("solo el mensaje nuevo: %d mensajes", len(msgs))
		}
		// Un chat anterior al corte queda vacío para el cliente.
		msgs = caData(t, caDo(t, s, http.MethodGet, "/chat/messages?chat_jid=111@lid", token, ""))["messages"].([]interface{})
		if len(msgs) != 0 {
			t.Fatalf("el chat antiguo debe verse vacío: %d", len(msgs))
		}
		// Grupo: 403 mientras no se permitan los grupos.
		if code := caDo(t, s, http.MethodGet, "/chat/messages?chat_jid=999@g.us", token, "").Code; code != http.StatusForbidden {
			t.Fatalf("mensajes de grupo: %d, quiero 403", code)
		}

		// Con grupos permitidos: aparece solo el grupo nuevo (sigue sin historial).
		caConfigure(t, s, `{"AllowGroups":true}`)
		got = chatsOf(t, caDo(t, s, http.MethodGet, "/chat/conversations", token, ""))
		if len(got) != 2 {
			t.Fatalf("con grupos debe ver 2 chats nuevos: %v", got)
		}
		// Con historial permitido: ve todo.
		caConfigure(t, s, `{"AllowHistory":true}`)
		if got = chatsOf(t, caDo(t, s, http.MethodGet, "/chat/conversations", token, "")); len(got) != 4 {
			t.Fatalf("con historial debe ver los 4 chats: %v", got)
		}
		// Cerrar otra vez el historial reinicia el corte a "ahora": lo anterior se oculta de nuevo.
		time.Sleep(1100 * time.Millisecond)
		caConfigure(t, s, `{"AllowHistory":false}`)
		if got = chatsOf(t, caDo(t, s, http.MethodGet, "/chat/conversations", token, "")); len(got) != 0 {
			t.Fatalf("al cerrar el historial, el corte se mueve a ahora: %v", got)
		}
	})
}

func TestClientAccessDeleteHistory(t *testing.T) {
	historyDrivers(t, func(t *testing.T, db *sqlx.DB) {
		s := caServer(t, db)
		now := time.Now().UTC().Truncate(time.Second)
		insertClientMessage(t, s, "owner", "111@lid", "old", "antiguo", now.Add(-48*time.Hour))
		token := caConfigure(t, s, `{"AllowDeleteHistory":true}`)
		time.Sleep(1100 * time.Millisecond)
		insertClientMessage(t, s, "owner", "111@lid", "new", "nuevo", time.Now().UTC())
		insertClientMessage(t, s, "owner", "777@g.us", "g", "grupo", time.Now().UTC())

		count := func() int {
			var n int
			if err := s.db.Get(&n, "SELECT COUNT(*) FROM message_history WHERE user_id='owner'"); err != nil {
				t.Fatal(err)
			}
			return n
		}
		// Faltan datos / datos contradictorios.
		if code := caDo(t, s, http.MethodPost, "/chat/history/delete", token, `{}`).Code; code != http.StatusBadRequest {
			t.Fatalf("sin datos: %d", code)
		}
		if code := caDo(t, s, http.MethodPost, "/chat/history/delete", token, `{"chat_jid":"1@lid","all":true}`).Code; code != http.StatusBadRequest {
			t.Fatalf("chat_jid y all juntos: %d", code)
		}
		// Grupos cerrados: no puede borrar un grupo.
		if code := caDo(t, s, http.MethodPost, "/chat/history/delete", token, `{"chat_jid":"777@g.us"}`).Code; code != http.StatusForbidden {
			t.Fatalf("borrar grupo cerrado: %d", code)
		}
		// El cliente solo borra lo que ve: el mensaje antiguo se conserva.
		rec := caDo(t, s, http.MethodPost, "/chat/history/delete", token, `{"chat_jid":"111@lid"}`)
		if rec.Code != http.StatusOK || caData(t, rec)["Deleted"].(float64) != 1 {
			t.Fatalf("borrar chat visible: %d %s", rec.Code, rec.Body.String())
		}
		if n := count(); n != 2 {
			t.Fatalf("debían quedar 2 filas (la antigua y el grupo): %d", n)
		}
		// El dueño borra todo.
		rec = caDo(t, s, http.MethodPost, "/chat/history/delete", "owner-token", `{"all":true}`)
		if rec.Code != http.StatusOK || count() != 0 {
			t.Fatalf("el dueño borra todo: %d, quedan %d", rec.Code, count())
		}
	})
}

func TestClientStatusSanitized(t *testing.T) {
	rec := httptest.NewRecorder()
	buf := &bufferedResponse{ResponseWriter: rec, code: http.StatusOK}
	buf.Header().Set("Content-Type", "application/json")
	buf.WriteHeader(http.StatusOK)
	_, _ = buf.Write([]byte(`{"code":200,"success":true,"data":{"connected":true,"loggedIn":true,"jid":"1@s.whatsapp.net","token":"SECRETO","webhook":"https://x","events":"All","proxy_url":"p","proxy_config":{},"s3_config":{"access_key":"***"},"hmac_configured":true,"qrcode":"data:x"}}`))
	buf.flushSanitized()
	body := rec.Body.String()
	for _, hidden := range []string{"SECRETO", "webhook", "proxy_url", "s3_config", "hmac_configured", "\"events\""} {
		if strings.Contains(body, hidden) {
			t.Errorf("la respuesta de estado no debe incluir %q: %s", hidden, body)
		}
	}
	for _, kept := range []string{"connected", "loggedIn", "jid", "qrcode"} {
		if !strings.Contains(body, kept) {
			t.Errorf("la respuesta de estado debe conservar %q: %s", kept, body)
		}
	}
}
