# Guía de la API de WspBox para IA

Para qué sirve: que un agente de IA (o una persona) pueda usar **todas** las funciones del servicio
sin adivinar. Aquí está el modelo mental, la autenticación, el flujo de arranque, los formatos que
más fallan y el mapa "quiero hacer X → uso este endpoint". El detalle campo por campo está en
[`api/`](api/README.md).

WspBox (basado en WuzAPI) es un servicio Go que expone WhatsApp por **HTTP REST** y por **JSON-RPC
sobre stdin/stdout** ([api-stdio.md](api-stdio.md)). Usa la librería whatsmeow: habla directo con
los servidores de WhatsApp, sin navegador ni emulador. Admite muchos usuarios y dispositivos a la vez.

## 1. Modelo mental

| Concepto | Qué es |
|---|---|
| **Usuario (instancia)** | Un registro con `name` y `token`. Cada usuario es **una sesión de WhatsApp** (un teléfono vinculado). Se crea con la API de administración. |
| **Token de usuario** | Autentica casi toda la API. Identifica al usuario y, con él, a su sesión. |
| **Token de administrador** | Variable `WUZAPI_ADMIN_TOKEN`. Solo sirve para `/admin/*` (crear usuarios, proxies). |
| **Sesión** | Estados independientes: `connected` (socket abierto con WhatsApp) y `loggedIn` (el teléfono ya está vinculado). |
| **Webhook** | URL de tu sistema a la que el servicio envía mensajes y eventos. |

Regla práctica: **un token = un número de WhatsApp**. Para operar varios números, crea varios usuarios.

## 2. Autenticación

| Quién | Cabecera | Rutas |
|---|---|---|
| Usuario | `token: TOKEN` (también se acepta `?token=TOKEN` en la URL) | Todo excepto `/admin/*` y `/health` |
| Administrador | `Authorization: TOKEN_ADMIN` | `/admin/*` |

`/health` no pide autenticación. Un token inválido devuelve `401`. Evita poner el token en la URL
en producción: queda en los logs de los proxies.

## 3. Forma de las respuestas

Todas las respuestas HTTP son JSON con el mismo sobre:

```json
{ "code": 200, "success": true,  "data": { ... } }
{ "code": 400, "success": false, "error": "missing Phone in Payload" }
```

- Éxito: `success: true` y el resultado en `data` (objeto o lista).
- Error: `success: false` y el motivo en `error` (texto en inglés).
- `code` repite el estado HTTP. Los más habituales: `400` payload mal formado o campo obligatorio
  faltante, `401` token inválido, `500` sin sesión, sin conexión o error de WhatsApp, `501` función
  desactivada (por ejemplo historial).
- **Un `200` en un envío no confirma la entrega.** Solo dice que WhatsApp aceptó el mensaje. La
  entrega y la lectura llegan después como eventos por webhook (`Receipt`, `ReadReceipt`).

## 4. Destinatarios (`Phone`, `Chat`, `jid`)

El campo se llama distinto según el endpoint, pero acepta lo mismo:

| Formato | Ejemplo | Nota |
|---|---|---|
| Dígitos internacionales | `5491155554444` o `+5491155554444` | Sin espacios ni signos, salvo un `+` inicial |
| JID de teléfono | `5491155554444@s.whatsapp.net` | |
| JID LID | `123456789@lid` | Identificador interno de WhatsApp |
| JID de grupo | `120363000000000000@g.us` | Solo donde el endpoint admite grupos |

- Mantén los identificadores como **string**, nunca como número.
- Al **responder, conserva el JID completo** del chat que recibiste en el evento.
- Un número "desnudo" se resuelve con el mapa cacheado teléfono↔LID; si no se conoce, se usa el
  JID de teléfono. Ante ambigüedad, envía el JID completo.
- No se admiten nombres de usuario ni BSUID de la API Cloud.
- Un JID mal formado (varios `@`, espacios) se rechaza con `400`.

## 5. Arranque paso a paso

Sustituye `HOST` (por ejemplo `https://wsp.boxhn.com`), `TOKEN_ADMIN` y `TOKEN`.

```bash
# 1. Crear el usuario (solo administrador). El token lo eliges tú.
curl -X POST HOST/admin/users -H 'Authorization: TOKEN_ADMIN' -H 'Content-Type: application/json' \
  -d '{"name":"ventas","token":"TOKEN"}'

# 2. Conectar con WhatsApp. Sin Subscribe recibe todos los eventos.
curl -X POST HOST/session/connect -H 'token: TOKEN' -H 'Content-Type: application/json' \
  -d '{"Immediate":true}'

# 3a. Vincular con QR: pedir el QR (data URI PNG en data.QRCode) y escanearlo desde WhatsApp,
#     Dispositivos vinculados. El QR caduca en pocos segundos: vuelve a pedirlo si hace falta.
curl HOST/session/qr -H 'token: TOKEN'
# 3b. Vincular con código, sin cámara:
curl -X POST HOST/session/pairphone -H 'token: TOKEN' -H 'Content-Type: application/json' \
  -d '{"Phone":"5491155554444"}'            # devuelve data.LinkingCode

# 4. Esperar a loggedIn:true consultando el estado cada pocos segundos.
curl HOST/session/status -H 'token: TOKEN'

# 5. Recibir eventos en tu sistema.
curl -X POST HOST/webhook -H 'token: TOKEN' -H 'Content-Type: application/json' \
  -d '{"webhookurl":"https://tu-sistema.com/hook","events":["Message","ReadReceipt"]}'

# 6. Enviar el primer mensaje.
curl -X POST HOST/chat/send/text -H 'token: TOKEN' -H 'Content-Type: application/json' \
  -d '{"Phone":"5491155554444","Body":"Hola desde WspBox"}'
```

Cómo leer `GET /session/status` (`data`):

| `connected` | `loggedIn` | Significa | Qué hacer |
|---|---|---|---|
| `false` | `false` | Sin socket ni vínculo | `POST /session/connect` |
| `true` | `false` | Conectado, esperando el emparejamiento | Mostrar QR (`/session/qr`) o pedir `pairphone` |
| `true` | `true` | Listo | Usar la API |
| `false` | `true` | Vinculado pero sin socket | `POST /session/connect` |

`Immediate:false` (por defecto) hace que `connect` espere hasta 10 s para dar el estado real;
con `true` responde al instante y debes comprobar el estado después. `POST /session/logout`
desvincula el teléfono; `POST /session/disconnect` solo cierra el socket y conserva el vínculo.

## 6. Qué endpoint uso para…

| Quiero… | Endpoint | Detalle |
|---|---|---|
| Enviar texto (con respuesta, mención, vista previa) | `POST /chat/send/text` | [chat-envio](api/chat-envio.md) |
| Enviar imagen, video, audio, nota de voz, documento, sticker | `POST /chat/send/{image,video,audio,voice,document,sticker}` | [chat-envio](api/chat-envio.md) |
| Enviar ubicación o contacto | `POST /chat/send/{location,contact}` | [chat-envio](api/chat-envio.md) |
| Enviar botones, lista, carrusel o encuesta | `POST /chat/send/{buttons,list,carousel,poll}` | [chat-envio](api/chat-envio.md) |
| Editar o borrar un mensaje mío | `POST /chat/send/edit` · `POST /chat/delete` | [chat-envio](api/chat-envio.md), [chat-acciones](api/chat-acciones.md) |
| Enviar un mensaje protobuf a mano (avanzado) | `POST /chat/send/raw` | [chat-envio](api/chat-envio.md) |
| Reaccionar a un mensaje | `POST /chat/react` | [chat-acciones](api/chat-acciones.md) |
| Marcar leído / reproducido, mostrar "escribiendo…" | `POST /chat/markread` · `/chat/markplayed` · `/chat/presence` | [chat-acciones](api/chat-acciones.md) |
| Descargar el medio de un mensaje recibido | `POST /chat/download{image,video,audio,document,sticker}` | [chat-acciones](api/chat-acciones.md) |
| Leer historial o listar conversaciones | `GET /chat/history` · `/chat/messages` · `/chat/conversations` | [chat-acciones](api/chat-acciones.md) |
| Fijar, silenciar, archivar, marcar no leído o borrar un chat | `POST /chat/{pinchat,mute,archive,unread,deletechat}` | [chat-acciones](api/chat-acciones.md) |
| Fijar un mensaje, destacarlo, votar una encuesta | `POST /chat/pin` · `/chat/star` · `/chat/poll/vote` | [chat-acciones](api/chat-acciones.md) |
| Saber si un número tiene WhatsApp | `POST /user/check` | [usuario](api/usuario.md) |
| Datos de un usuario, avatar, perfil de negocio | `POST /user/{info,avatar,business-profile}` | [usuario](api/usuario.md) |
| Listar contactos | `GET /user/contacts` | [usuario](api/usuario.md) |
| Bloquear, desbloquear, ver bloqueados | `POST /user/{block,unblock}` · `GET /user/blocklist` | [usuario](api/usuario.md) |
| Ver o cambiar la privacidad | `GET`/`POST /user/privacy` | [usuario](api/usuario.md) |
| Presencia propia o de un contacto | `POST /user/presence` · `/user/presence/subscribe` | [usuario](api/usuario.md) |
| Crear y administrar grupos | `/group/*` | [group](api/group.md) |
| Entrar a un grupo por enlace / ver un enlace | `POST /group/join` · `GET /group/invitelink` | [group](api/group.md) |
| Canales (newsletters) | `/newsletter/*` | [newsletter](api/newsletter.md) |
| Etiquetas de WhatsApp Business | `POST /labels/{edit,chat,message}` | [labels](api/labels.md) |
| Publicar un estado de texto / rechazar una llamada | `POST /status/set/text` · `POST /call/reject` | [otros](api/otros.md) |
| Configurar webhook | `/webhook` (POST, GET, PUT, DELETE) | [webhook](api/webhook.md) |
| Proxy, historial, S3, firma HMAC de la sesión | `/session/{proxy,history,s3/config,hmac/config}` | [session](api/session.md) |
| Dar a un asistente acceso limitado al cliente web (sin contactos, grupos ni historial) | `/session/client-access` · `POST /chat/history/delete` | [session](api/session.md) · [client-access](client-access.md) |
| Crear o borrar usuarios, pool de proxies | `/admin/*` | [admin](api/admin.md) |

## 7. Webhooks y eventos

1. Configura con `POST /webhook` (`webhookurl` + `events`) o con `Subscribe` en `/session/connect`.
2. El servicio hace `POST` a tu URL por cada evento. Formato según la variable `WEBHOOK_FORMAT`:
   - `form` (por defecto): `application/x-www-form-urlencoded` con el JSON en el campo `jsonData` y el
     token en `token`.
   - `json`: cuerpo `application/json` con el evento (`event`, `type`, …) y `token`.
3. Responde `2xx` rápido y procesa en segundo plano. El servicio reintenta algunos fallos, pero no
   dependas de ello: guarda lo que recibes y haz tu proceso idempotente.
4. Si configuras HMAC (`/session/hmac/config`), cada webhook lleva la cabecera
   `x-hmac-signature` (SHA-256): verifícala antes de confiar en el contenido.
5. Con S3 activo, el evento incluye el bloque `s3` y/o `base64` según `media_delivery`
   (`base64`, `s3` o `both`).

Eventos válidos para `events`/`Subscribe` (`All` los recibe todos). **Un nombre desconocido se descarta
sin error** (solo queda un aviso en el log): si no te llegan eventos, revisa que el nombre sea exacto:

- **Mensajes:** `Message`, `UndecryptableMessage`, `Receipt`, `ReadReceipt`, `MediaRetry`
- **Grupos y contactos:** `GroupInfo`, `JoinedGroup`, `Picture`, `Blocklist`, `BlocklistChange`
- **Conexión:** `Connected`, `Disconnected`, `ConnectFailure`, `KeepAliveRestored`, `KeepAliveTimeout`,
  `QR`, `QRTimeout`, `QRScannedWithoutMultidevice`, `PairSuccess`, `PairError`, `LoggedOut`,
  `ClientOutdated`, `TemporaryBan`, `StreamError`, `StreamReplaced`
- **Privacidad y perfil:** `PrivacySettings`, `PushNameSetting`, `UserAbout`
- **Sincronización:** `AppState`, `AppStateSyncComplete`, `HistorySync`, `OfflineSyncCompleted`, `OfflineSyncPreview`
- **Llamadas:** `CallOffer`, `CallAccept`, `CallTerminate`, `CallOfferNotice`, `CallRelayLatency`
- **Presencia:** `Presence`, `ChatPresence`
- **Otros:** `IdentityChange`, `CATRefreshError`, `NewsletterJoin`, `NewsletterLeave`,
  `NewsletterMuteChange`, `NewsletterLiveUpdate`, `FBMessage`

Suscríbete solo a lo que uses: `All` genera mucho tráfico (presencia, recibos, sincronizaciones).
`ClientOutdated`, `LoggedOut` y `TemporaryBan` conviene vigilarlos siempre: indican que hay que
actualizar el servicio o volver a vincular.

## 8. Reglas y trampas

- **Conecta antes de usar.** Casi todo devuelve `500 no session` o `not connected` si la sesión no
  está conectada. Comprueba `/session/status`.
- **`Id` opcional en los envíos.** Si lo pasas, úsalo como ID del mensaje (te permite reintentar sin
  duplicar y luego borrar/editar/reaccionar). Si no, se genera uno y viene en la respuesta (`data.Id`).
  Guárdalo: lo necesitas para `delete`, `edit`, `react` y `markread`.
- **Mayúsculas en los campos.** Los cuerpos usan nombres como `Phone`, `Body`, `Id`; respeta la
  referencia, pero Go acepta mayúsculas/minúsculas indistintas al leer el JSON.
- **Medios:** los envíos de imagen, video, audio, documento y sticker reciben el contenido como data URI
  base64 (por ejemplo `data:image/jpeg;base64,...`; ver el campo de cada endpoint). Los archivos
  grandes tardan: usa tiempos de espera amplios.
- **Historial desactivado → `501`.** `/chat/messages` y `/chat/conversations` solo funcionan si el
  usuario tiene retención local de mensajes: `history` mayor que 0 (mensajes guardados por chat),
  que se fija con `POST /session/history`. Con `history: 0` responden `501`. Ese mismo endpoint admite
  `days_to_sync_history` (ventana de historial al emparejar), que solo afecta al **siguiente**
  emparejamiento: guárdalo antes de vincular.
- **Cuida la cuenta.** WhatsApp puede restringir números que envían mucho, a desconocidos o con
  contenido repetitivo. Espacia los envíos, no escribas a quien no te conoce y evita mensajes idénticos
  en ráfaga. El servicio no impone un límite: es responsabilidad de quien lo usa.
- **No desvincules por error.** `logout` borra el vínculo y hay que escanear de nuevo.
- **Presencia automática.** Con `WUZAPI_AUTO_PRESENCE=available` (por defecto) el servicio se muestra
  en línea al conectar; con `unavailable` se conserva la notificación push en el teléfono principal.
- **Proxy.** Con un pool de proxies (`/admin/proxy-pool`), una sesión sin proxy propio recibe el menos
  cargado al conectar y lo conserva.

## 9. Cómo exploro la API sin documentación abierta

1. `GET /health` para comprobar que el servicio responde.
2. `static/api/spec.yml` es la especificación OpenAPI; la interfaz navegable está en `/api` del
   propio servicio, y el panel de pruebas en `/dashboard` y `/login`.
3. [`api/README.md`](api/README.md) enlaza la referencia por grupo.

## 10. Desfases conocidos entre el spec y el código

Detectados al generar esta documentación (revisión de `routes.go` contra `static/api/spec.yml`).
Ante la duda, **gana el código**:

- Existen en el código pero **no están en el spec**: `POST /chat/archive`, `POST /chat/pin` y
  `POST /user/presence/subscribe`. Están documentados en [chat-acciones](api/chat-acciones.md) y
  [usuario](api/usuario.md) desde el código.
- `POST /chat/send/template` está en el spec pero **la ruta está comentada** en `routes.go`: no existe.
- `GET /user/lid/{phone}` en el spec se llama `{jid}` en el código; es el mismo valor.
- En el spec, `Subscribe` de `/session/connect` figura como `string`, pero el código espera una
  **lista de strings** (`["Message","ReadReceipt"]`).
- `static/api/spec.yml` tenía un error de sintaxis YAML en la descripción de `/chat/send/raw` (un `: `
  sin comillas) que impedía cargar el archivo completo: la página `/api` mostraba "Parser error on
  line 1563" y ningún endpoint. Se corrigió entrecomillando esa descripción; si vuelve a aparecer ese
  error, busca descripciones nuevas con `: ` sin comillas.

## 11. Mantener esta documentación

- `static/guia/api/*.md` es una **instantánea** de `static/api/spec.yml` más tres endpoints escritos desde el
  código. Al cambiar el spec o `routes.go`, actualiza el grupo afectado y la tabla de la sección 6.
- `static/guia/api-stdio.md` sale de `routeRequest` en `stdio.go`.
- Más contexto del servicio: [`../README.md`](../README.md), [`../API.md`](../API.md) (ejemplos `curl`
  extensos) y [`../AGENTS.md`](../AGENTS.md) (guía para quien modifica el código).
