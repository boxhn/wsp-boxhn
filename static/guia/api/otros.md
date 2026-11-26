# API · Llamadas, estado y salud

Rechazar llamadas, publicar un estado de texto y comprobar que el servicio responde.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/call/reject`

**Reject an incoming call**

Rejects an incoming WhatsApp call from a specific user. Requires the caller's JID and the call ID.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `call_from` | string | **sí** | The JID (WhatsApp ID) of the caller to reject |
| `call_id` | string | **sí** | The unique identifier of the call to reject |

### POST `/status/set/text`

**Set status message**

Updates the current user's status text, which is shown in the "About" section in the user profile.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `body` | string | **sí** | ej. `Hi` |

### GET `/health`

**Health check**

Endpoint to verify if the API is running correctly and retrieve service statistics.

Autenticación: token de usuario (cabecera `token`).

