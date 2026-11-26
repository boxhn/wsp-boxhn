# API · Administración

Usuarios (instancias) y pool de proxies. Requiere el token de administrador.

Convenciones generales (autenticación, respuestas, destinatarios): [../api-guia-ia.md](../api-guia-ia.md). Este archivo se generó desde `static/api/spec.yml`.

### GET `/admin/proxy-pool`

**List proxy pool**

Lists the proxies in the pool with their current number of assigned sessions. Proxy passwords are masked.

Autenticación: token de administrador (cabecera `Authorization`).

### POST `/admin/proxy-pool`

**Add proxy to pool**

Adds a proxy to the pool. Sessions that connect without a proxy are assigned the least-loaded enabled pool proxy with free capacity, and keep it on later connects.
If the pool has enabled proxies but all are full, /session/connect returns 503, or connects without a proxy when WUZAPI_PROXY_POOL_FALLBACK=direct.

Autenticación: token de administrador (cabecera `Authorization`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `enabled` | boolean | no | Whether new sessions may be assigned to this proxy (default true) |
| `label` | string | no | ej. `residential-1` |
| `max_devices` | integer | no | Maximum number of sessions assigned to this proxy (default 1) |
| `proxy_url` | string | **sí** | Proxy URL in format "http://host:port" or "socks5://user:pass@host:port" |

### PUT `/admin/proxy-pool/{id}`

**Edit proxy in pool**

Updates a pool entry. All fields are optional. Disabling stops new assignments but keeps existing ones.
max_devices cannot be lower than the current assigned_count. Changing proxy_url also updates the sessions assigned to the entry.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** |  |

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `enabled` | boolean | no |  |
| `label` | string | no |  |
| `max_devices` | integer | no |  |
| `proxy_url` | string | no |  |

### DELETE `/admin/proxy-pool/{id}`

**Delete proxy from pool**

Deletes a pool entry. Returns 409 while sessions are still assigned to it.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** |  |

### GET `/admin/users`

**List users**

Retrieve a list of users from the database, displaying also connection status and other info.

Autenticación: token de administrador (cabecera `Authorization`).

### POST `/admin/users`

**Create a new user**

Add a new user to the database.

Autenticación: token de administrador (cabecera `Authorization`).

Cuerpo (`application/json`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `days_to_sync_history` | integer | no | History window requested in days on the next new pairing. 0 uses WhatsApp defaults. Configure before starting pairing; reconnecting an already linked device does not trigger a new full sync. Independent of local history retention. |
| `events` | string | no | Events to subscribe to. Ex: 'All', 'Message', 'Presence' |
| `history` | integer | no | Number of messages to store in history per chat for this user. 0 means no history is saved, any positive number enables history storage for that many messages per chat. Default is 0 |
| `name` | string | **sí** | ej. `John Doe` |
| `proxyConfig` | object | no |  |
| `proxyConfig.enabled` | boolean | no | Enable proxy for the user, default is false |
| `proxyConfig.proxyURL` | string | no | Proxy URL to use for the user. Format: socks5://user:pass@host:port or http://host:port |
| `proxyConfig.webhookUseProxy` | boolean | no | Route webhook deliveries through the configured proxy. Defaults to the WUZAPI_WEBHOOK_USE_PROXY server setting (true). |
| `s3Config` | object | no |  |
| `s3Config.accessKey` | string | no | ej. `1234567890` |
| `s3Config.bucket` | string | no | ej. `my-bucket` |
| `s3Config.enabled` | boolean | no | Enable S3 for the user, default is false |
| `s3Config.endpoint` | string | no | ej. `https://s3.amazonaws.com` |
| `s3Config.mediaDelivery` | string | no | Media delivery type for the user, default is both |
| `s3Config.pathStyle` | boolean | no | Enable path style for the user, default is false |
| `s3Config.publicURL` | string | no | Public URL for the user |
| `s3Config.region` | string | no | ej. `us-east-1` |
| `s3Config.retentionDays` | integer | no | Retention days for the user, default is 30 |
| `s3Config.secretKey` | string | no | ej. `1234567890` |
| `token` | string | **sí** | ej. `1234ABCD` |
| `webhook` | string | no | Webhook URL to receive events |

### GET `/admin/users/{id}`

**List users**

Retrieve a list of users from the database, displaying also connection status and other info.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** | ID of the user to request |

### DELETE `/admin/users/{id}`

**Delete a user from DB**

Deletes a user by their ID.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** | ID of the user to delete |

### DELETE `/admin/users/{id}/full`

**Delete a user from DB and S3, logout and disconnect from whatsapp and clear it up from memory**

Stops the session, attempts remote logout, deletes safely identified credentials, and removes the user, history, memory state and local/S3 files. Ambiguous ownership returns 409 and retains the user and devices. File cleanup is best effort.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** | ID of the user to delete |

### DELETE `/admin/users/{id}/preserve-devices`

**Delete an instance while preserving all WhatsApp device credentials**

Explicitly opts into preserving credentials. Stops the session without remote logout,
removes the user and history atomically, and cleans up memory and local/S3 files.
Never resolves, deletes or reassigns WhatsApp devices. Devices remain linked to the phone.
File cleanup is best effort. Orphaned credentials require separate cleanup.
A previous failed full deletion is not required. No request body is needed.
Stdio method admin.users.delete.preserve_devices accepts userId and adminToken.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** | ID of the instance to remove |

### POST `/admin/users/{id}/proxy-pool/release`

**Release a user's pool proxy**

Frees the pool slot held by a disconnected session and clears its proxy. Returns 409 while the session is starting, pairing, reconnecting, or shutting down; disconnect and wait for shutdown first. On its next connect the session is assigned a pool proxy again.

Autenticación: token de administrador (cabecera `Authorization`).

| Parámetro | En | Tipo | Requerido | Descripción |
|---|---|---|---|---|
| `id` | path | string | **sí** | ID of the user |

