# API · Canales (newsletters)

Listar, unirse, salir y silenciar canales de WhatsApp.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/newsletter/join`

**Join a newsletter**

Follows a WhatsApp channel. The channel JID must use the `@newsletter` server.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `NewsletterJID` | string | **sí** | The WhatsApp channel JID. |

### POST `/newsletter/leave`

**Leave a newsletter**

Unfollows a WhatsApp channel. The channel JID must use the `@newsletter` server.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `NewsletterJID` | string | **sí** | The WhatsApp channel JID. |

### GET `/newsletter/list`

**List subscribed newsletters**

Returns complete list of subscribed newsletters

Autenticación: token de usuario (cabecera `token`).

### POST `/newsletter/mute`

**Change newsletter notification settings**

Mutes or unmutes notifications for a WhatsApp channel. The channel JID must use the `@newsletter` server.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Mute` | boolean | **sí** | Set to true to mute notifications, false to unmute them. |
| `NewsletterJID` | string | **sí** | The WhatsApp channel JID. |

