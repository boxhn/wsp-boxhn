# API · Etiquetas

Etiquetas de WhatsApp Business sobre chats y mensajes.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/labels/chat`

**Assign or remove a chat label**

Use Labeled=false to remove. Applications retain label IDs; no local catalog is maintained. Stdio method: labels.chat. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `LabelID` | string | **sí** | Canonical unsigned 32-bit decimal ID. Caller manages IDs. |
| `Labeled` | boolean | **sí** | Must be explicitly supplied. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/labels/edit`

**Create, edit or delete a label**

Deleted=true deletes. Otherwise Name and Color are required. Caller chooses an unused ID for creation. WhatsApp account/client support applies, especially Business accounts. No local catalog or listing is provided. Stdio method: labels.edit. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Color` | integer | no | Required unless deleting. |
| `Deleted` | boolean | **sí** | Must be explicitly supplied. |
| `LabelID` | string | **sí** | Canonical unsigned 32-bit decimal ID. Caller manages IDs. |
| `Name` | string | no | Nonblank; required unless deleting. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/labels/message`

**Assign or remove a message label**

Uses the original message ID. Labeled=false removes the association. No local catalog is maintained. Stdio method: labels.message. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `Id` | string | **sí** |  |
| `LabelID` | string | **sí** | Canonical unsigned 32-bit decimal ID. Caller manages IDs. |
| `Labeled` | boolean | **sí** | Must be explicitly supplied. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

