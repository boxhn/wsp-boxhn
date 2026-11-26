# Documentación en el panel (/guia)

Página `/guia/` que muestra la documentación en español con formato y menú lateral, y
sirve de punto de entrada para que una IA sepa cómo integrarse con la API.

## Dónde está accesible

- Panel (usuario y administrador): botón **Documentación** (abre `/guia/`) y botón **API** (abre `/api`, Swagger) en la barra superior (`static/dashboard/index.html`); en móvil solo icono.
- Landing: enlace **Documentación** en el pie (`static/index.html`).
- Directo: `http://HOST/guia/`. Los `.md` también se sirven crudos
  (p. ej. `/guia/api-guia-ia.md`) para pasárselos a una IA; el botón **Copiar para IA**
  copia el documento que se está viendo.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `static/guia/index.html` | Estructura de la página y aviso "¿Vas a integrarlo con una IA?" |
| `static/guia/guia.js` | Menú (`NAV`), carga del `.md` según el hash, reescritura de enlaces, botón copiar |
| `static/guia/md.js` | Renderizador mínimo de Markdown (sin librerías) |
| `static/assets/css/wsp-guia.css` | Estilos con tokens BoxUI |
| `static/guia/*.md`, `static/guia/api/*.md` | Los documentos. Viven en `static/` porque la imagen Docker solo copia esa carpeta |

## Flujo

`/guia/#/api/chat-envio.md` → `guia.js` valida la ruta contra `NAV` → `fetch` del `.md` →
`MiniMd.render` → enlaces `*.md` relativos pasan a `#/ruta` para navegar sin recargar.

## Cómo depurar

- "No se pudo cargar el documento": comprobar que el `.md` existe en `static/guia/` y que el
  servidor se reinició si se compiló un binario nuevo (el servidor lee `static/` junto al ejecutable).
- Formato raro en un documento: el renderizador soporta solo títulos, tablas, listas, código,
  citas, negrita, cursiva, enlaces y `<br>` (ver cabecera de `md.js`).

## Cómo extender

1. Copiar el `.md` a `static/guia/` (o `static/guia/api/`).
2. Añadirlo a `NAV` en `guia.js`. Solo los documentos listados se pueden abrir.
3. Si usa una sintaxis no soportada, ampliar `md.js`.

## Limitaciones conocidas

- Los enlaces con ancla (`#seccion`) dentro de un documento no se respetan; se abre el documento desde arriba.
- `static/guia/api/*.md` es una instantánea de `static/api/spec.yml`: hay que regenerarla cuando cambie el spec
  (ver la sección de vigencia en `static/guia/api-guia-ia.md`).
- El panel de usuario está parcialmente en inglés y parcialmente en español; esta página va en español.
