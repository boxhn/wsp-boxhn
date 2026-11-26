# API · Webhook

Configurar la URL y los eventos que el servicio envía a tu sistema.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### GET `/webhook`

**Shows webhook**

Gets the configured webhook and subscribed events.

## Webhook

The following _webhook_ endpoints are used to get or set the webhook that will be called whenever a message or event is received. Available event types are:

* Message
* ReadReceipt
* Presence
* HistorySync
* ChatPresence
* All (subscribes to all event types)

Autenticación: token de usuario (cabecera `token`).

### POST `/webhook`

**Sets webhook**

Sets the webhook that will be used to POST information when messages are received and configures the events to subscribe to.

## Webhook

The following _webhook_ endpoints are used to get or set the webhook that will be called whenever a message or event is received. Available event types are:

* Message
* ReadReceipt
* Presence
* HistorySync
* ChatPresence
* All (subscribes to all event types)

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `events` | array<string> | **sí** | List of events to subscribe to |
| `webhook` | string | **sí** | The URL of the webhook |

### PUT `/webhook`

**Updates webhook**

Updates the webhook URL, events, and activation status.

## Webhook

The following _webhook_ endpoints are used to get or set the webhook that will be called whenever a message or event is received. Available event types are:

* Message
* ReadReceipt
* Presence
* HistorySync
* ChatPresence
* All (subscribes to all event types)

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Active` | boolean | no | Whether the webhook should be active or not |
| `events` | array<string> | no | List of events to subscribe to |
| `webhook` | string | no | The URL of the webhook |

### DELETE `/webhook`

**Deletes webhook**

Removes the configured webhook and clears events for the user

Autenticación: token de usuario (cabecera `token`).

