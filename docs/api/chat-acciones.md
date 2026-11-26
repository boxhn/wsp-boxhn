# API · Chat: lectura, historial y acciones

Historial y conversaciones, descargas de medios, reacciones, lectura, presencia, fijar, silenciar, archivar y borrar.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### GET `/chat/conversations`

**List the current user's stored conversations**

Tenant-scoped latest-message summaries. Requires enabled history (501 otherwise). No-store response. Also available in stdio as chat.conversations.

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `limit` | query | integer | no |  |
| `offset` | query | integer | no |  |

Respuestas: `200` data contains chats, has_more and next_offset. Each chat has chat_jid, message_id, sender_jid, timestamp, message_type and text_content. · `400` Invalid pagination · `401` Invalid user token · `501` History disabled

### POST `/chat/delete`

**Deletes an own message or another participant's group message**

Omit SenderJID (or send an empty string) to delete your own message. To delete another participant's message, use the group JID in Phone and the original author's full PN or LID in SenderJID. The connected WhatsApp account must be a group admin; WhatsApp enforces deletion permissions. Providing your own PN or LID also deletes an own message and does not require group admin privileges. Use the sender identity from the original message event; PN and LID are not automatically interconverted.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Id` | string | **sí** | ej. `1234-abcd-21234` |
| `Phone` | string | **sí** | Destination chat; use the full group JID ending in @g.us for group messages. |
| `SenderJID` | string | no | Optional original message author. Omit or leave empty for own messages. Otherwise provide a numeric user JID ending in @s.whatsapp.net or @lid. Legacy @c.us is normalized to @s.whatsapp.net. Device/agent suffixes are validated and removed. Bare numbers, whitespace, multiple @ signs and group, broadcast or newsletter JIDs are rejected with HTTP 400. |

### POST `/chat/deletechat`

**Delete a chat conversation**

Deletes the whole conversation on every device of the account, like Delete chat in the phone app (app state). Send the last message when known: WhatsApp clients use it to decide what the deletion covers. Messages stored in WuzAPI history are not deleted. Stdio method: chat.deletechat. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `DeleteMedia` | boolean | no | Also delete the chat's media files. Default false. |
| `LastMessageFromMe` | boolean | no |  |
| `LastMessageId` | string | no | ID of the chat's last message. Requires LastMessageTimestamp and LastMessageFromMe. |
| `LastMessageSender` | string | no | Author JID of the last message, required only when someone else sent it in a group. |
| `LastMessageTimestamp` | integer | no | Unix seconds of the chat's last message. Defaults to now. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/downloadaudio`

**Downloads Audio from message**

Downloads an Audio file from a message and returns it Base64 media encoded

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `DirectPath` | string | no |  |
| `FileEncSHA256` | string | no |  |
| `FileLength` | number | **sí** |  |
| `FileSHA256` | string | **sí** |  |
| `MediaKey` | string | **sí** |  |
| `Mimetype` | string | **sí** |  |
| `Url` | string | **sí** |  |

### POST `/chat/downloaddocument`

**Downloads Document from message**

Downloads a Document from a message and returns it Base64 media encoded

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `DirectPath` | string | no |  |
| `FileEncSHA256` | string | no |  |
| `FileLength` | number | **sí** |  |
| `FileSHA256` | string | **sí** |  |
| `MediaKey` | string | **sí** |  |
| `Mimetype` | string | **sí** |  |
| `Url` | string | **sí** |  |

### POST `/chat/downloadimage`

**Downloads Image from message**

Downloads an Image from a message and returns it Base64 media encoded

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `DirectPath` | string | no |  |
| `FileEncSHA256` | string | no |  |
| `FileLength` | number | **sí** |  |
| `FileSHA256` | string | **sí** |  |
| `MediaKey` | string | **sí** |  |
| `Mimetype` | string | **sí** |  |
| `Url` | string | **sí** |  |

### POST `/chat/downloadsticker`

**Downloads Sticker from message**

Downloads a Sticker from a message and returns it Base64 media encoded

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `DirectPath` | string | no |  |
| `FileEncSHA256` | string | no |  |
| `FileLength` | number | **sí** |  |
| `FileSHA256` | string | **sí** |  |
| `MediaKey` | string | **sí** |  |
| `Mimetype` | string | **sí** |  |
| `Url` | string | **sí** |  |

### POST `/chat/downloadvideo`

**Downloads Video from message**

Downloads a Video from a message and returns it Base64 media encoded

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `DirectPath` | string | no |  |
| `FileEncSHA256` | string | no |  |
| `FileLength` | number | **sí** |  |
| `FileSHA256` | string | **sí** |  |
| `MediaKey` | string | **sí** |  |
| `Mimetype` | string | **sí** |  |
| `Url` | string | **sí** |  |

### GET `/chat/history`

**Get chat message history**

Retrieves message history for a specific chat, newest first. Requires history to be enabled.
With chat_jid=index, returns only the authenticated user's conversation index,
keyed by their user ID, with chat_jid and last_updated per chat (newest first).
Users with no stored messages receive an empty object. Other users' metadata is never included.
History contains events, not a materialized view of the latest message contents.
An edit is a separate row with message_type `edit`, its own message_id, the target
message ID in quoted_message_id, and replacement text or caption in text_content
(which can be empty). The original row is not modified. Consumers must apply edits
to their targets, using protocolMessage.timestampMS in datajson for edit ordering
when available. Database timestamps represent insertion time, including for HistorySync;
sent_at holds the send time WhatsApp reported, when known.
A limited result may contain an edit without its original message.
Reactions, edits and deletes sent through the API are stored like received ones, with
sender_jid `me` and the send's own message_id. Reactions keep the target in quoted_message_id
(a removed reaction sent through the API has an empty text_content); deletes keep it in text_content.
Newsletter edits and deletes use a generated local history message_id because WhatsApp
reuses the target ID. Target fields and endpoint responses are unchanged.
Live and HistorySync edits use the same fields. Legacy unknown rows are repaired
when the same edit is redelivered; existing rows are not scanned or backfilled.

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `chat_jid` | query | string | **sí** | The JID (WhatsApp ID) of the chat, or index for the authenticated user's conversation index |
| `limit` | query | integer | no | Maximum number of messages to retrieve (default is 50) |

### POST `/chat/markplayed`

**Mark incoming audio as played**

Sends played receipts, without playing or verifying media locally. All IDs must belong to the supplied chat and sender. Legacy Chat/Sender JID objects are also accepted. Stdio method: chat.markplayed.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ChatPhone` | string | **sí** | Individual PN/LID or group JID. |
| `Id` | array<string> | **sí** |  |
| `SenderPhone` | string | no | Required for groups: original sender PN/LID JID. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/markread`

**Marks a message as read**

Marks one or more received messages as read

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ChatPhone` | string | no | ej. `5491155553934` |
| `Id` | object | **sí** | ej. `[AABBCC11223344 DDEEFF55667788]` |
| `SenderPhone` | string | no | ej. `5491155553111` |

### GET `/chat/messages`

**Read a cursor-paginated page of stored messages**

Tenant-scoped history sorted by timestamp and row ID descending. Does not request phone-side history recovery. Also available in stdio as chat.messages. No-store response.

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `chat_jid` | query | string | **sí** |  |
| `limit` | query | integer | no |  |
| `before` | query | integer | no | next_before from the previous page; must belong to the current user and chat. Omit for newest messages. |

Respuestas: `200` data contains messages (existing history format), has_more and next_before. · `400` Invalid pagination or missing chat_jid · `401` Invalid user token · `404` Missing or pruned pagination anchor; refresh the chat · `501` History disabled

### POST `/chat/mute`

**Mute or unmute a conversation**

Updates WhatsApp conversation settings; does not suppress WuzAPI webhooks. Stdio method: chat.mute. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `DurationSeconds` | integer | no | Zero or omitted means indefinitely. Must be zero/omitted when unmuting. |
| `Mute` | boolean | **sí** | Must be explicitly supplied. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/pinchat`

**Pin or unpin a conversation**

Pins a conversation in the chat list; /chat/pin pins an individual message. WhatsApp pin limits apply. Stdio method: chat.pinchat.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `Pin` | boolean | **sí** | Must be explicitly supplied. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/poll/vote`

**Vote in a poll or retract a vote**

FromMe describes the poll creator. Preserve original PN/LID metadata. Requires the original message secret in this session store; missing secrets abort before sending. Caller enforces available options and selection limit. Failed sends are not automatically replayed. Stdio method: chat.poll.vote. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `FromMe` | boolean | **sí** | Must be explicitly supplied. |
| `Id` | string | **sí** | Original poll message ID. |
| `Options` | array<string> | **sí** | Exact distinct nonblank option names. Empty array retracts the vote; null is invalid. |
| `Sender` | string | **sí** | Original poll creator PN/LID JID, required even for direct chats. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/presence`

**Sets chat presence**

Sends indication if you are writing or not (state could be either "composing" or "paused"). Optional Media can be set to "audio" for indicating recording a message

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Media` | string | no | ej. `audio` |
| `Phone` | string | **sí** | ej. `5491155553935` |
| `State` | string | **sí** | ej. `composing` |

### POST `/chat/react`

**Reacts to a message**

Sends a reaction to some message. Phone, Body and Id are mandatory. If reaction is for your own message, prefix Phone with 'me:'. Body should be the reaction emoji.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Body` | string | **sí** | ej. `❤️` |
| `Id` | string | **sí** | ej. `me:3EB06F9067F80BAB89FF` |
| `Phone` | string | **sí** | ej. `5491155553935` |

### POST `/chat/request-unavailable-message`

**Request unavailable message**

Requests a copy of a message that couldn't be decrypted from the sender's primary device. 
This is useful when you receive an encrypted message that your client was unable to decrypt.

The response to this request will come as a normal message event with the `UnavailableRequestID` field set to the request message ID. 
The sender's primary device will attempt to resend the message content.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `chat` | string | **sí** | Chat JID where the message was sent (e.g., "5511999999999@s.whatsapp.net" for individual chat or "120363123456789012@g.us" for group chat) |
| `id` | string | **sí** | Message ID of the undecrypted message |
| `sender` | string | **sí** | JID of the user who sent the message |

### POST `/chat/star`

**Star or unstar a message**

Use the original author and exact message ID. Set Star to false to unstar. Stdio method: chat.star.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `FromMe` | boolean | **sí** | Must be explicitly supplied. |
| `Id` | string | **sí** |  |
| `Sender` | string | no | Required for groups; defaults to Chat for direct conversations. |
| `Star` | boolean | **sí** | Must be explicitly supplied. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/unread`

**Set conversation unread flag**

False clears the flag. Changes conversation state, not message read receipts; use /chat/markread for receipts. Stdio method: chat.unread. Unknown fields and trailing JSON are rejected.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | Individual PN/LID or group JID. |
| `Unread` | boolean | **sí** | Must be explicitly supplied. |

Respuestas: `200` Success in the standard WuzAPI envelope. · `400` Invalid payload. · `401` Missing or invalid user token. · `500` No session or upstream operation failed.

### POST `/chat/archive`

> **No aparece en spec.yml**; documentado desde el código (`handlers.go`, `ArchiveChat`).

**Archivar o desarchivar un chat**

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `jid` | string | **sí** | JID completo del chat (ej. `5491155554444@s.whatsapp.net` o `123@g.us`) |
| `archive` | boolean | no | `true` archiva, `false` desarchiva (por defecto `false`) |

Respuesta `200`: `{"success":true,"message":"Chat archived"}` (o `Chat unarchived`). Errores: `400` (falta jid o JID inválido), `500` (sin sesión o fallo de WhatsApp).

### POST `/chat/pin`

> **No aparece en spec.yml**; documentado desde el código (`handlers.go`, `PinMessage`). No confundir con `/chat/pinchat`, que fija un *chat*.

**Fijar o desfijar un mensaje dentro de un chat**

Autenticación: token de usuario (cabecera `token`). Requiere sesión conectada.

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Chat` | string | **sí** | JID del chat |
| `Id` | string | **sí** | ID del mensaje a fijar |
| `Sender` | string | solo en grupos | JID de quien envió el mensaje; obligatorio si el chat es grupo o difusión |
| `Pin` | boolean | no | `true` fija (por defecto), `false` desfija |
| `DurationSeconds` | integer | no | Cuánto dura fijado: solo `86400` (24 h), `604800` (7 días, por defecto) o `2592000` (30 días) |

Errores: `400` (campos faltantes o JID inválido), `500` (sin sesión o no conectado).

### POST `/chat/history/delete`

**Borra mensajes del historial guardado por WspBox**

No elimina nada del teléfono ni de WhatsApp. Con un token de cliente solo borra lo que ese cliente puede ver y
requiere el permiso `AllowDeleteHistory` (ver [../client-access.md](../client-access.md)).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `chat_jid` | string | uno de los dos | Borra solo esa conversación |
| `all` | boolean | uno de los dos | `true` borra todas las conversaciones visibles |

Respuesta: `{"Deleted": N}` con el número de mensajes borrados. Errores: `400` (ni `chat_jid` ni `all`, o los dos),
`403` (sin permiso, o conversación de grupo con los grupos ocultos).
