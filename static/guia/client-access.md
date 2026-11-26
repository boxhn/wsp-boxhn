# Acceso restringido del cliente web

Permite dar a otra persona (por ejemplo, un asistente) un acceso **limitado** al cliente web
(`/client/`) usando un **token de cliente** distinto del token del usuario. El dueño decide, desde el
panel, qué puede ver y hacer esa persona.

Caso típico: tu asistente atiende por ti, desde tu número, a un cliente concreto, pero **no** debe ver
tus conversaciones personales anteriores, tu lista de contactos ni tus grupos.

## Cómo se usa (desde el panel)

1. Entra al panel (`/dashboard`), abre tu instancia y pulsa **Acceso del cliente web**.
2. Pulsa **Crear acceso del cliente**. Se genera un token que empieza por `cl_`.
3. Marca lo que quieres permitir y pulsa **Guardar permisos**.
4. Entrega a la persona la dirección `https://TU-SERVIDOR/client/` y ese token (no tu token de usuario).

Todo parte **cerrado**: sin permisos marcados, la persona solo puede ver los mensajes nuevos y
enviar mensajes a números que ya conoce.

## Qué controla cada permiso

| Permiso | Si está desactivado | Si está activado |
|---|---|---|
| Ver mi lista de contactos | No ve contactos (el servidor responde 403) | Ve la agenda sincronizada |
| Ver y crear grupos | Los grupos no aparecen ni en la lista ni en el historial; no puede listarlos ni crearlos | Los ve y puede crear grupos |
| Ver el historial anterior | Solo ve mensajes **enviados a partir de la fecha de corte** ("solo mensajes nuevos") | Ve todo el historial guardado |
| Configurar el historial | Sin botón de ajustes ni de recuperar historial del teléfono | Puede cambiar cuántos mensajes se guardan y pedir historial |
| Borrar el historial de las conversaciones que puede ver | Sin botón de borrar | Puede borrar una conversación o todas las que ve |

**Siempre permitido:** enviar mensajes (texto, medios, notas de voz...) a cualquier número o JID que conozca,
marcar leído, descargar los medios de lo que ve, consultar si un número tiene WhatsApp y ver el avatar.
**Siempre reservado al dueño:** webhook, proxy, S3, HMAC, cerrar sesión o desconectar, la cola de envío, bloquear
contactos, privacidad, borrar un chat en el teléfono y administrar este mismo acceso.

### "Solo mensajes nuevos" y la fecha de corte

Con **Ver el historial anterior** desactivado, el cliente solo ve mensajes cuya hora de envío en WhatsApp
(`sent_at`) es igual o posterior a la **fecha de corte** (`HistorySince`).

- La fecha de corte es el momento en que se creó el acceso, o el momento en que se **desactivó** el historial.
- El botón **Ocultar todo lo anterior a ahora** la mueve a este instante.
- Se usa la hora real del mensaje, no la de guardado: los mensajes viejos que llegan al vincular el teléfono
  se guardan "hoy" pero siguen quedando ocultos.

### Borrar historial

Borra mensajes del historial **guardado por WspBox**; no los elimina del teléfono ni de WhatsApp. Con token de
cliente solo se borra lo que ese cliente puede ver (respeta la fecha de corte y los grupos ocultos): lo anterior
al corte se conserva para el dueño. Con el token del usuario se borra todo lo pedido.

## API

Se configura con el token del **usuario** (el token de cliente recibe 403). Detalle de campos en
[api/session.md](api/session.md) y [api/chat-acciones.md](api/chat-acciones.md).

| Método y ruta | Quién | Para qué |
|---|---|---|
| `GET /session/client-access` | usuario y cliente | El dueño ve la configuración y el token; el cliente solo ve sus permisos |
| `POST /session/client-access` | usuario | Crea o actualiza. Campos opcionales: `Enabled`, `AllowContacts`, `AllowGroups`, `AllowHistory`, `AllowHistoryConfig`, `AllowDeleteHistory`, `ResetHistorySince`, `RegenerateToken` |
| `DELETE /session/client-access` | usuario | Revoca el acceso y borra el token |
| `POST /chat/history/delete` | usuario y cliente (si tiene el permiso) | Cuerpo `{"chat_jid":"..."}` o `{"all":true}`; responde `{"Deleted":N}` |

Por stdio: `session.client-access.get`, `session.client-access.set`, `session.client-access.delete` y
`chat.history.delete`.

## Cómo funciona por dentro

| Archivo | Responsabilidad |
|---|---|
| `client_access.go` | Modelo, token, middlewares y handlers (todo el servidor de esta función) |
| `handlers_client.go` | `ListConversations` y `ListChatMessages` aplican `clientVisibility` |
| `migrations.go` | Migración 19: tabla `client_access` (una fila por usuario) |
| `routes.go` | Orden de middlewares: `clientAccessAuth` → `authalice` → `clientAccessGuard` |
| `static/dashboard/js/clientaccess.js` + modal en `index.html` | Interfaz del panel |
| `webclient/src/App.svelte` | El cliente web lee sus permisos y oculta lo que no puede usar |

Flujo de una petición con token de cliente:

1. `clientAccessAuth` reconoce el token (`cl_...`), lo cambia por el token real del usuario y anota la política.
   Así la autenticación y las cachés siguen siendo las de siempre.
2. `clientAccessGuard` deja pasar **solo** una lista cerrada de rutas (la que usa el cliente web); el resto es 403.
   En `/session/status` quita el token del usuario, webhook, proxy, S3, HMAC y eventos de la respuesta.
3. Los handlers de conversaciones y mensajes añaden el filtro de grupos y de fecha de corte a la consulta SQL.

La seguridad **la aplica el servidor**: ocultar botones en el cliente es solo comodidad.

## Cómo depurar

- `401` con un token `cl_...`: está desactivado, revocado o regenerado.
- `403 ... not available with a client access token`: la ruta no está en la lista cerrada (`allows` en `client_access.go`).
- `403 ... disabled for this client access`: falta ese permiso en el panel.
- La política tarda hasta 30 segundos en aplicarse en otra instancia del servicio; en la misma se aplica al instante
  (la caché se vacía al guardar).
- Los permisos se leen de la tabla `client_access` (`SELECT * FROM client_access WHERE user_id = '...'`).

## Cómo extender

- Nuevo permiso: columna en `addClientAccessSQL` (otra migración), campo en `clientAccess`, `clientAccessView`
  y `SetClientAccess`, regla en `allows` y casilla en el panel y en el cliente.
- Nueva ruta para el cliente: añadirla a `allows`. Por defecto todo lo nuevo queda reservado al dueño.

## Limitaciones conocidas

- **Enviar a grupos:** si la persona conoce el JID de un grupo (`...@g.us`), puede enviarle mensajes aunque los grupos
  estén ocultos; el permiso controla ver y listar, no escribir a un JID conocido.
- El token de cliente se guarda en texto plano en la tabla, igual que el token de usuario.
- La comparación por fecha de corte usa `COALESCE(sent_at, timestamp)`. En SQLite los instantes se guardan como
  texto, así que con zonas horarias distintas la comparación puede desfasarse horas; PostgreSQL (producción) compara
  instantes reales. Las pruebas automáticas cubren SQLite; la variante PostgreSQL se prueba definiendo
  `WUZAPI_TEST_POSTGRES_DSN`.
