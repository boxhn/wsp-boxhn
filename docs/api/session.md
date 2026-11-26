# API · Sesión de WhatsApp

Conexión, QR, código de emparejamiento, passkey, historial, proxy, S3 y firma HMAC de la sesión.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### POST `/session/connect`

**connects to WhatsApp servers**

Initiates connection to WhatsApp servers.

If there is no previous session created, it will generate a QR code that can be retrieved via the [qr](#/Session/get_session_qr) API call. Alternatively, the device may initiate passkey pairing instead of QR — in that case, a PasskeyRequest webhook will be sent with the challenge data.

If the optional Subscribe is supplied it will limit webhooks to the specified event types: Message,ReadReceipt,Presence,HistorySync,ChatPresence.

If no Subscribe is supplied it will subscribe to All events.

If Immediate is set to false, the action will wait for 10 seconds to retrieve actual connection status from whatsapp, otherwise it will return immediatly.

When setting Immediate to true you should check for actual connection status after a few seconds via the [status](#/Session/get_session_status) API call as your connection might fail if the session was closed from another device.

If the session has no proxy and the admin proxy pool is in use, a pool proxy is assigned before connecting.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Immediate` | boolean | no |  |
| `Subscribe` | string | no | ej. `[Message ChatPresence]` |

### POST `/session/disconnect`

**disconnects from WhatsApp servers**

Closes connection to WhatsApp servers. Session is not terminated, that means that calling connect again will reuse the previous session avoiding QR code scanning

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `clear` | query | boolean | no | If true, also clears the user's event subscriptions on disconnect. Defaults to false, which preserves them. |

### GET `/session/history`

**Request history sync**

Requests WhatsApp to sync message history for the connected session. Supports query parameters to customize the sync request.

Autenticación: token de usuario (cabecera `token`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `count` | query | integer | no | Number of messages to sync (default 50) |
| `chat_jid` | query | string | no | JID of the chat to sync history for (e.g., 120363313346913103@g.us for groups or 5521971532700@s.whatsapp.net for DMs) |
| `oldest_msg_id` | query | string | no | Message ID of the oldest message to start sync from |
| `oldest_msg_from_me` | query | boolean | no | Whether the oldest message was sent by the current user |
| `oldest_msg_timestamp` | query | integer | no | Timestamp of the oldest message in milliseconds |

Respuestas: `200` History sync requested successfully · `400` Bad request or session not connected · `500` Internal server error

### POST `/session/history`

**Configure message retention and pairing history**

Save before starting pairing. No active WhatsApp session is required. Omitted fields retain their current values. Sync days affect the next new pairing, not an ordinary reconnect or a QR already issued. Zero preserves WhatsApp default sync behavior; it does not disable incoming HistorySync events.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `days_to_sync_history` | integer | no | Requested full history window on next pairing. Availability is determined by WhatsApp and the phone. |
| `history` | integer | no | Local message retention count per chat, independent of sync days. |

Respuestas: `200` Configuration saved · `400` Missing settings or invalid values · `500` Database error

### GET `/session/hmac/config`

**Get HMAC configuration status**

Retrieves HMAC configuration status. For security reasons, the actual key is never returned - only masked with '***' if configured.

Autenticación: token de usuario (cabecera `token`).

### POST `/session/hmac/config`

**Configure HMAC key for webhook signing**

Sets HMAC key for webhook signature verification. Once configured, all webhooks will include x-hmac-signature header.

**Security Notes:**
- HMAC key must be at least 32 characters long
- Key cannot be retrieved after saving
- To update key, send new request with new key

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `hmac_key` | string | **sí** | HMAC key for webhook signing (min 32 chars) |

### DELETE `/session/hmac/config`

**Delete HMAC configuration**

Removes HMAC configuration and disables webhook signing.

Autenticación: token de usuario (cabecera `token`).

### POST `/session/logout`

**Logs out from WhatsApp**

Closes connection to WhatsApp servers and terminate session. That means that next time connect is issued, QR scan will be needed from phone to connect again

Autenticación: token de usuario (cabecera `token`).

### POST `/session/pairphone`

**Gets pair by phone code**

Gets the code to enter into whatsapp client when pairing by phone number instead of QR code

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Phone` | string | **sí** | ej. `5491155553934` |

### POST `/session/passkey-confirm`

**Confirm passkey pairing code**

Confirms that the 8-character pairing code was displayed to the user and matches the code on the phone.

This endpoint must be called after receiving a webhook with the PasskeyConfirmation event.

Autenticación: token de usuario (cabecera `token`).

### POST `/session/passkey-response`

**Send passkey WebAuthn response**

Sends the WebAuthn response from the authenticator to complete passkey pairing.

This endpoint must be called after receiving a webhook with the PasskeyRequest event containing the challenge data.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `response` | object | **sí** | WebAuthn response object from navigator.credentials.get() |
| `response.id` | string | no | Base64url-encoded credential identifier |
| `response.rawId` | string | no | Base64url-encoded raw credential identifier |
| `response.response` | object | no | Authenticator response data |
| `response.response.authenticatorData` | string | no | Base64url-encoded authenticator data |
| `response.response.clientDataJSON` | string | no | Base64url-encoded client data |
| `response.response.signature` | string | no | Base64url-encoded signature |
| `response.response.userHandle` | string | no | Base64url-encoded user handle (can be null) |
| `response.type` | string | no | Credential type |

### GET `/session/passkey-status`

**Get passkey pairing status**

Checks if there is a pending passkey pairing request for this session.

Returns passkeyPending=true with the publicKey challenge data if the device initiated passkey pairing instead of QR.

Autenticación: token de usuario (cabecera `token`).

### POST `/session/proxy`

**Set Proxy Configuration**

Sets or disables the proxy configuration for the user.
Provide a JSON payload with "proxy_url" (e.g. "http://host:port" or "socks5://user:pass@host:port") and "enable" (boolean).

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `enable` | boolean | **sí** | Whether to enable or disable the proxy. |
| `proxy_url` | string | **sí** | Proxy URL in format "http://host:port" or "socks5://user:pass@host:port" |
| `webhook_use_proxy` | boolean | no | Whether webhook deliveries use the configured proxy. When omitted, the existing per-user value is preserved. |

Respuestas: `200` Proxy configured successfully · `400` Bad Request · `500` Internal Server Error

### GET `/session/qr`

**Gets QR code for scanning**

Gets QR code if the user is connected but not logged in and the device is pairing via QR. If the user is already logged in, QRCode will be empty. If the device initiated passkey pairing instead of QR, QRCode will also be empty — in that case the pairing data is delivered via PasskeyRequest webhook.

Autenticación: token de usuario (cabecera `token`).

### GET `/session/s3/config`

**Get S3 Configuration**

Retrieves the current S3 storage configuration for the user.

Autenticación: token de usuario (cabecera `token`).

### POST `/session/s3/config`

**Configure S3 Storage**

Configures S3 storage settings for the user to store media files.
Supports AWS S3, MinIO, Backblaze B2, and other S3-compatible services.
When enabled, media files will be uploaded to S3 and can be accessed via public URLs.

Autenticación: token de usuario (cabecera `token`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `access_key` | string | no | S3 access key ID |
| `bucket` | string | no | S3 bucket name |
| `enabled` | boolean | no | Whether S3 storage is enabled |
| `endpoint` | string | no | S3 endpoint URL (leave empty for AWS S3) |
| `media_delivery` | string (base64, s3, both) | no | Media delivery method |
| `path_style` | boolean | no | Use path-style URLs (required for MinIO) |
| `public_url` | string | no | Custom public URL for accessing files (optional, for CDN) |
| `region` | string | no | S3 region |
| `retention_days` | integer | no | Number of days to retain files (0 for no expiration) |
| `secret_key` | string | no | S3 secret access key |

### DELETE `/session/s3/config`

**Delete S3 Configuration**

Removes the S3 storage configuration for the user and reverts to default base64 media delivery.

Autenticación: token de usuario (cabecera `token`).

### POST `/session/s3/test`

**Test S3 Connection**

Tests the S3 connection using the current configuration to ensure it's working properly.

Autenticación: token de usuario (cabecera `token`).

### GET `/session/status`

**Gets connection and session status**

Gets status from connection, including websocket connection and logged in status (session)

Autenticación: token de usuario (cabecera `token`).

