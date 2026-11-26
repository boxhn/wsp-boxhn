# API · Modo stdio (JSON-RPC 2.0)

El servicio se puede ejecutar como subproceso sin HTTP: `wuzapi -mode stdio`. Es la vía más directa para que un agente de IA lo use sin abrir puertos. Cada método JSON-RPC equivale a un endpoint HTTP; **los parámetros son los mismos campos del cuerpo JSON** de ese endpoint. Convenciones generales: [api-guia-ia.md](api-guia-ia.md).

## Cómo se llama

Una petición por línea en la entrada estándar, una respuesta por línea en la salida estándar:

```json
{"id":1,"method":"session.status","params":{"token":"TOKEN_DEL_USUARIO"}}
{"id":2,"method":"chat.send.text","params":{"token":"TOKEN_DEL_USUARIO","Phone":"5491155554444","Body":"Hola"}}
{"id":3,"method":"admin.users.list","params":{"adminToken":"TOKEN_ADMIN"}}
```

Respuesta correcta: `{"jsonrpc":"2.0","id":1,"result":{...}}` (el contenido de `data` del HTTP). Error: `{"jsonrpc":"2.0","id":1,"error":{"code":401,"message":"..."}}` donde `code` es el estado HTTP.

- `params.token` es el token del usuario; `params.adminToken` es el de administrador. Ambos se quitan del cuerpo en los métodos con validación estricta.
- Los métodos `admin.users.get/delete/edit/...` exigen además `params.userId`.
- Los eventos (lo que por HTTP sería un webhook) llegan como **notificaciones** JSON-RPC sin `id` en la misma salida.
- En este modo los logs van a stderr para no mezclarse con las respuestas.
- Los métodos `chat.conversations`, `chat.messages` y `chat.history` aceptan `chat_jid`, `limit`, `offset` y `before` como parámetros de consulta.

## Tabla de métodos

La ruta HTTP enlaza con la referencia del mismo endpoint en [api/](api/README.md).

| Método JSON-RPC | HTTP | Ruta |
|---|---|---|
| `health` | GET | `/health` |
| `admin.users.add` | POST | `/admin/users` |
| `admin.users.list` | GET | `/admin/users` |
| `admin.users.get` | GET | `/admin/users/{id}` |
| `admin.users.delete` | DELETE | `/admin/users/{id}` |
| `admin.users.edit` | PUT | `/admin/users/{id}` |
| `admin.users.delete.full` | DELETE | `/admin/users/{id} + /full` |
| `admin.users.delete.preserve_devices` | DELETE | `/admin/users/{id} + /preserve-devices` |
| `session.connect` | POST | `/session/connect` |
| `session.qr` | GET | `/session/qr` |
| `session.status` | GET | `/session/status` |
| `session.disconnect` | POST | `/session/disconnect` |
| `session.logout` | POST | `/session/logout` |
| `session.pairphone` | POST | `/session/pairphone` |
| `session.passkey-response` | POST | `/session/passkey-response` |
| `session.passkey-confirm` | POST | `/session/passkey-confirm` |
| `session.passkey-status` | GET | `/session/passkey-status` |
| `session.history` | GET | `/session/history` |
| `session.history.set` | POST | `/session/history` |
| `session.proxy` | POST | `/session/proxy` |
| `session.hmac.config` | POST | `/session/hmac/config` |
| `session.hmac.config.get` | GET | `/session/hmac/config` |
| `session.hmac.config.delete` | DELETE | `/session/hmac/config` |
| `session.sendqueue.config` | POST | `/session/sendqueue/config` |
| `session.sendqueue.config.get` | GET | `/session/sendqueue/config` |
| `chat.queue.list` | GET | `/chat/queue` |
| `chat.send.raw` | POST | `/chat/send/raw` |
| `chat.send.text` | POST | `/chat/send/text` |
| `chat.send.image` | POST | `/chat/send/image` |
| `chat.send.video` | POST | `/chat/send/video` |
| `chat.send.document` | POST | `/chat/send/document` |
| `chat.send.audio` | POST | `/chat/send/audio` |
| `chat.send.sticker` | POST | `/chat/send/sticker` |
| `chat.send.location` | POST | `/chat/send/location` |
| `chat.send.contact` | POST | `/chat/send/contact` |
| `chat.poll.vote` | POST | `/chat/poll/vote` |
| `chat.send.poll` | POST | `/chat/send/poll` |
| `chat.send.buttons` | POST | `/chat/send/buttons` |
| `chat.send.carousel` | POST | `/chat/send/carousel` |
| `chat.send.list` | POST | `/chat/send/list` |
| `chat.send.edit` | POST | `/chat/send/edit` |
| `chat.delete` | POST | `/chat/delete` |
| `chat.react` | POST | `/chat/react` |
| `chat.archive` | POST | `/chat/archive` |
| `chat.presence` | POST | `/chat/presence` |
| `labels.edit` | POST | `/labels/edit` |
| `labels.chat` | POST | `/labels/chat` |
| `labels.message` | POST | `/labels/message` |
| `chat.mute` | POST | `/chat/mute` |
| `chat.unread` | POST | `/chat/unread` |
| `chat.deletechat` | POST | `/chat/deletechat` |
| `chat.pinchat` | POST | `/chat/pinchat` |
| `chat.star` | POST | `/chat/star` |
| `chat.markplayed` | POST | `/chat/markplayed` |
| `chat.markread` | POST | `/chat/markread` |
| `chat.request-unavailable-message` | POST | `/chat/request-unavailable-message` |
| `chat.download.image` | POST | `/chat/downloadimage` |
| `chat.download.video` | POST | `/chat/downloadvideo` |
| `chat.download.audio` | POST | `/chat/downloadaudio` |
| `chat.download.document` | POST | `/chat/downloaddocument` |
| `chat.conversations,` | GET | `/chat/ + strings.TrimPrefix(req.Method, chat.)` |
| `chat.history` | GET | `/chat/history?chat_jid= + chatJID` |
| `user.contacts` | GET | `/user/contacts` |
| `user.presence` | POST | `/user/presence` |
| `user.business-profile` | POST | `/user/business-profile` |
| `user.info` | POST | `/user/info` |
| `user.check` | POST | `/user/check` |
| `user.avatar` | POST | `/user/avatar` |
| `user.block` | POST | `/user/block` |
| `user.unblock` | POST | `/user/unblock` |
| `user.lid` | GET | `/user/lid/ + jid` |
| `status.set.text` | POST | `/status/set/text` |
| `call.reject` | POST | `/call/reject` |
| `group.list` | GET | `/group/list` |
| `group.create` | POST | `/group/create` |
| `group.info` | GET | `/group/info` |
| `group.invitelink` | GET | `/group/invitelink` |
| `group.photo` | POST | `/group/photo` |
| `group.photo.remove` | POST | `/group/photo/remove` |
| `group.leave` | POST | `/group/leave` |
| `group.name` | POST | `/group/name` |
| `group.topic` | POST | `/group/topic` |
| `group.announce` | POST | `/group/announce` |
| `group.locked` | POST | `/group/locked` |
| `group.memberaddmode` | POST | `/group/memberaddmode` |
| `group.ephemeral` | POST | `/group/ephemeral` |
| `group.join` | POST | `/group/join` |
| `group.inviteinfo` | POST | `/group/inviteinfo` |
| `group.updateparticipants` | POST | `/group/updateparticipants` |
| `newsletter.list` | GET | `/newsletter/list` |
| `newsletter.join` | POST | `/newsletter/join` |
| `newsletter.leave` | POST | `/newsletter/leave` |
| `newsletter.mute` | POST | `/newsletter/mute` |
| `webhook.get` | GET | `/webhook` |
| `webhook.set` | POST | `/webhook` |
| `webhook.update` | PUT | `/webhook` |
| `webhook.delete` | DELETE | `/webhook` |

Generada desde `stdio.go` (función `routeRequest`). Un método que no esté en la tabla responde `404 unknown method`.
