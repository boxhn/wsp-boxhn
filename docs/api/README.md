# Referencia de la API por grupo

Punto de partida: [../api-guia-ia.md](../api-guia-ia.md) (autenticación, formato de respuestas,
destinatarios, flujo de arranque y trampas). Esta carpeta tiene el detalle campo por campo.

| Archivo | Contenido | Autenticación |
|---|---|---|
| [session.md](session.md) | Conectar, QR, emparejamiento por código, passkey, historial, proxy, S3 y HMAC de la sesión | Usuario |
| [webhook.md](webhook.md) | Configurar, consultar, actualizar y borrar el webhook | Usuario |
| [chat-envio.md](chat-envio.md) | Enviar texto, medios, ubicación, contactos, botones, listas, carruseles, encuestas, edición y mensajes crudos | Usuario |
| [chat-acciones.md](chat-acciones.md) | Historial, conversaciones, descargas, reacciones, lectura, presencia, fijar, silenciar, archivar y borrar | Usuario |
| [usuario.md](usuario.md) | Verificar números, info, avatar, contactos, bloqueos, privacidad y presencia | Usuario |
| [group.md](group.md) | Crear y administrar grupos, participantes e invitaciones | Usuario |
| [newsletter.md](newsletter.md) | Canales de WhatsApp | Usuario |
| [labels.md](labels.md) | Etiquetas de WhatsApp Business | Usuario |
| [otros.md](otros.md) | Rechazar llamadas, estado de texto y `/health` | Usuario (`/health`: ninguna) |
| [admin.md](admin.md) | Usuarios (instancias) y pool de proxies | Administrador |

Otro modo de acceso: [../api-stdio.md](../api-stdio.md) (JSON-RPC por stdin/stdout, mismos campos).

## Cómo leer un endpoint

- **Requerido `sí`**: sin ese campo el servicio responde `400`.
- Los nombres de campo respetan mayúsculas tal como aparecen (`Phone`, `Body`, `Id`).
- Las descripciones vienen del spec y están en inglés; los títulos y las notas de este proyecto, en español.
- Un bloque con una nota `No aparece en spec.yml` se escribió a partir del código.

## Origen y vigencia

Generada desde `static/api/spec.yml` (con tres endpoints añadidos desde el código). Si un
endpoint no está aquí, comprueba `routes.go`. La lista de desfases conocidos está en la sección 10 de
la guía.
