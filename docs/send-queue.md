# Cola de envío pausado (anti-baneo)

Permite que los mensajes de un número no salgan en ráfaga sino con ritmo humano:
lotes pequeños, pausas aleatorias y un tope por hora. Se activa **por usuario**
(por número de WhatsApp); si no se activa, todo funciona como siempre.

> El ritmo reduce el riesgo de baneo pero no lo elimina: también influyen la
> calidad de los contactos, los reportes de spam y la antigüedad del número.

## Cómo se usa

1. Configurar la política (con el `token` del usuario):

```bash
curl -X POST http://localhost:8080/session/sendqueue/config \
  -H "token: USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"Enabled":true,"BatchSize":3,"MsgDelayMin":5,"MsgDelayMax":15,"BatchPauseMin":60,"BatchPauseMax":180,"HourlyCap":60}'
```

| Campo | Defecto | Significado |
|---|---|---|
| `Enabled` | `false` | Activa la cola para este usuario |
| `Paused` | `false` | Detiene el envío sin perder lo encolado |
| `BatchSize` | 3 | Mensajes por lote (1–50) |
| `MsgDelayMin/Max` | 5 / 15 | Segundos aleatorios entre mensajes del mismo lote |
| `BatchPauseMin/Max` | 60 / 180 | Segundos aleatorios al terminar cada lote |
| `HourlyCap` | 60 | Máximo de mensajes enviados en los últimos 60 min (1–10000) |

Los campos omitidos toman el valor por defecto (la llamada reemplaza la política completa).

2. Enviar como siempre (`POST /chat/send/text`, `image`, `audio`, `document`, `video`,
   `sticker`, `location`, `contact`, `buttons`, `carousel`, `list`, `poll`, `voice`, `raw`).
   Con la cola activa la respuesta es **202**:

```json
{"code":202,"data":{"Details":"Queued","QueueId":"0179...-a1b2","Position":4},"success":true}
```

3. Consultar o cancelar:
   - `GET /chat/queue?status=pending|sent|failed|cancelled&limit=50`
   - `DELETE /chat/queue/{QueueId}` (solo si sigue `pending`)
   - `GET /session/sendqueue/config`
   - Stdio: `session.sendqueue.config`, `session.sendqueue.config.get`, `chat.queue.list`
     (cancelar solo existe por HTTP).

4. Resultado: cuando un mensaje sale (o falla) se emite el evento webhook
   **`QueuedMessageStatus`** (hay que suscribirse a él o a `All`):

```json
{"type":"QueuedMessageStatus","event":{"QueueId":"0179...","Status":"sent","MessageId":"3EB0...","Error":""}}
```

`/chat/send/edit` **no** se encola (sale directo). Con la cola activa la respuesta del
envío ya no trae el `Id` de WhatsApp: se obtiene del evento o de `GET /chat/queue` (`MessageId`).

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `send_queue.go` | Modelo, validación de política y consultas SQL |
| `send_queue_http.go` | `sendQueueGate` (puerta de entrada) y endpoints HTTP |
| `send_queue_worker.go` | Planificador y worker por usuario; ritmo, tope por hora, reintentos, evento |
| `send_queue_test.go` | Pruebas con reloj falso (sin esperas reales ni WhatsApp) |
| `migrations.go` (ID 18) | Tablas `send_queue_config` y `send_queue` |
| `routes.go` | Envuelve cada `/chat/send/*` con `sendQueueGate` y registra los endpoints |
| `main.go` | Arranca el worker y lo detiene en el apagado |

## Flujo de datos

```
POST /chat/send/text ─ authalice ─ sendQueueGate ─┬─ cola desactivada ─► handler normal (síncrono)
                                                  └─ cola activada ─► INSERT send_queue (pending) ─► 202
scheduler (cada 5 s o al encolar) ─► un runUser por usuario con pendientes
runUser: ¿pausado? ¿tope/hora? ¿toca esperar? ─► claim (pending→sending)
       ─► reproduce la petición contra s.router (contexto sqReplayKey: no se vuelve a encolar)
       ─► 2xx: sent + MessageId · 4xx: failed · 5xx: reintento (máx. 3) · apagado: vuelve a pending
       ─► evento QueuedMessageStatus
```

Reproducir la petición en el router evita duplicar la lógica de los ~15 handlers de envío.

## Cómo depurar

- `GET /chat/queue?status=failed` muestra `Result` (cuerpo de la respuesta del handler, máx. 1000 caracteres) y `Attempts`.
- Consulta directa: `SELECT id,status,attempts,result FROM send_queue WHERE user_id='...' ORDER BY id DESC;`
- Nada sale: revisa `Paused`, que el usuario esté conectado (si no, los envíos fallan con 500 y se reintentan 3 veces) y el tope por hora.
- Logs: busca `send queue:` en el log del servidor.

## Cómo extender

- Nuevo endpoint de envío: envolverlo en `routes.go` con `c.Then(s.sendQueueGate(...))`; no requiere más cambios.
- Nuevas reglas de ritmo: `runUser` en `send_queue_worker.go`; los tiempos son inyectables (`now`, `sleep`, `jitter`) para probarlas.

## Limitaciones conocidas

- Los medios van en base64 dentro del cuerpo guardado; se rechazan cuerpos mayores de 25 MiB (413) y los mensajes terminados se borran a los 30 días.
- El ritmo (pausa pendiente y posición en el lote) vive en memoria: tras un reinicio el primer mensaje sale sin espera previa. Los pendientes sí se conservan.
- Con varias instancias del servicio sobre la misma base de datos, el reclamo de mensajes es seguro (UPDATE condicional) pero el ritmo se calcula por instancia.
- Editar o responder a un mensaje que aún está en cola no es posible hasta que tenga `MessageId`.
- Nota de diseño: la política vive en su propia tabla (`send_queue_config`), no en `users`, para no tocar la caché de autenticación.
