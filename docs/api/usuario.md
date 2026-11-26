# API · Usuario y contactos

Consulta de usuarios, avatar, contactos, bloqueos, privacidad, presencia y perfil de negocio.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/user/avatar`

**Gets profile picture information**

Gets information about users profile pictures on WhatsApp, either a thumbnail (Preview=true) or full picture.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Phone` | string | **sí** | ej. `5491155553934` |
| `Preview` | bool | **sí** | ej. `true` |

### POST `/user/block`

**Block a WhatsApp user**

Blocks a WhatsApp user and returns the updated blocklist.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `JID` | string | no | ej. `5491155553935@s.whatsapp.net` |
| `Phone` | string | no | ej. `5491155553935` |

### GET `/user/blocklist`

**Get the current blocklist**

Returns the list of WhatsApp users currently blocked by the session.

Autenticación: token de usuario (cabecera `token`).

### POST `/user/business-profile`

**Look up a business profile**

Uses the authenticated user session. Returned profile fields may be empty. No local cache. A nil result returns 404; upstream errors, including unavailable profiles, return 500. Stdio method: user.business-profile. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Phone` | string | **sí** | International phone without +, PN JID, or LID JID. Groups/channels are rejected. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `404` Business profile unavailable (nil result). · `500` No session or upstream operation failed.

### POST `/user/check`

**Checks if user has WhatsApp**

Checks if users have an account with WhatsApp

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Phone` | object | **sí** | ej. `[5491155553934 5491155553935]` |

### GET `/user/contacts`

**Gets all contacts for the account**

Gets complete list of contacts for the connected account

Autenticación: token de usuario (cabecera `token`).

### POST `/user/info`

**Gets information about users on WhatsApp**

Gets extra information about users on WhatsApp

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Phone` | object | **sí** | ej. `[5491155553934 5491155553935]` |

### GET `/user/lid/{phone}`

> **Nota:** en el código el parámetro de ruta se llama `{jid}` (`GET /user/lid/{jid}`); es el mismo valor.

**Get JID and LID for a WhatsApp number**

Returns the **JID** (WhatsApp ID) and **LID** (Linked Device ID) associated with a given phone number.
<br>Use this endpoint to identify contacts within WhatsApp.

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `phone` | path | string | **sí** | Phone number in international format (without the + sign) |

### POST `/user/presence`

**Send user global presence**

Sends user presence Available or Unavailable

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `type` | string | **sí** | ej. `available` |

### GET `/user/privacy`

**Get privacy settings**

Returns the account's current privacy settings (last seen, profile photo, status, read receipts, online, groups, calls).

Autenticación: token de usuario (cabecera `token`).

### POST `/user/privacy`

**Set a privacy setting**

Updates a single privacy setting. Valid Name/Value combinations:
<br>`groupadd`, `last`, `status`, `profile`: `all`, `contacts`, `contact_blacklist`, `none`
<br>`readreceipts`: `all`, `none`
<br>`online`: `all`, `match_last_seen`
<br>`calladd`: `all`, `known`

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|

### POST `/user/unblock`

**Unblock a WhatsApp user**

Unblocks a WhatsApp user and returns the updated blocklist.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `JID` | string | no | ej. `5491155553935@s.whatsapp.net` |
| `Phone` | string | no | ej. `5491155553935` |

### POST `/user/presence/subscribe`

> **No aparece en spec.yml**; documentado desde el código (`handlers.go`, `SubscribePresence`).

**Suscribirse a la presencia (en línea / última vez) de un contacto**

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Phone` | string | **sí** | Número o JID del contacto |

Respuesta `200`: `{"Details":"Presence subscription requested successfully"}`. Los cambios llegan después como evento `Presence` por webhook. Errores: `400` (falta Phone o inválido), `500` (sin sesión).

