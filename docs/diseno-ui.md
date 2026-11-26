# Diseño de WspBox (BoxUI)

Rama de trabajo: `feat/landing-login-wspbox`. Todo lo visual vive en `static/`;
no hay cambios en Go, en la API ni en la base de datos. Por eso el diseño se puede
llevar a `main` con un merge cuando se decida, sin tocar el backend.

## Estado

| Pantalla | Ruta | Estado |
|---|---|---|
| Landing | `/` (`static/index.html`) | Rediseñada con BoxUI (contexto `public`) |
| Login | `/login` (`static/login/index.html`) | Rediseñado con BoxUI (contexto `app`), sin Fomantic ni jQuery |
| Dashboard | `/dashboard` y `/dashboard/history.html` | Rediseñado con BoxUI; conserva jQuery (copia local) con un puente de compatibilidad (ver "Dashboard") |
| Docs, API (Swagger), Web Client | `/docs`, `/api`, `/client/` | Sin rediseño; solo se ocultó el término WuzAPI de sus textos |

## Mapa de archivos

```
static/
  index.html                  Landing (BoxUI public)
  assets/
    css/
      vendor.css              Solo importa FontAwesome en la capa `vendor`
      boxui/boxui.min.css     BoxUI núcleo (copiado de ui.box.hn, no se edita)
      boxui-public/boxui-public.min.css   Módulo landing (copiado, no se edita)
      wspbox.css              Tema: tokens de marca + clases .wsp-* de landing y login
      wsp-dashboard.css       Estilos del panel: rejilla, barra, tarjeta de instancia, multiselect
      wsp-historial.css       Estilos del visor de historial (con tokens)
    js/
      box-ui.js               Comportamiento de BoxUI (tema, modales, toasts)
      box-nav.js              Navbar y drawer móvil de la landing
      box-motion.js           Reveal/stagger (copiado; la landing no lo usa)
      wsp-dialog.js           Modales sobre <dialog> (ver "Modales del login")
      wsp-compat.js           Puente jQuery -> BoxUI del dashboard (ver "Dashboard")
    lib/fontawesome/          Iconos locales (sin CDN)
    lib/jquery/jquery.min.js  jQuery 3.7.1, copia local (la usa el JS del dashboard)
docs/diseno-ui.md             Este archivo
```

## Flujo

1. El HTML fija `data-theme`, `data-ui-mode` y `data-ui-context` y un script en
   `<head>` los restaura desde `localStorage` antes de pintar (sin parpadeo).
2. Orden de carga obligatorio: `vendor.css` → `boxui.min.css` →
   `boxui-public.min.css` (solo landing) → `wspbox.css`.
3. La identidad se decide con tokens en `wspbox.css`, dentro de `@layer box.tokens`:
   `--box-brand-500` (verde `#0b7a5e`) y los acentos `--boxp-accent-2/3`.
4. La tipografía es la del sistema (BoxUI por defecto). Para elegir otra familia
   hay que servir el `.woff2` desde `static/assets/` y declarar
   `--box-font-heading` en `wspbox.css`; no se usa CDN.

## Reglas que se cumplen

- Ningún hex ni `!important` fuera de la definición de tokens; no se editan los `.min.css`.
- Toda clase `box-*` usada existe en `ui.box.hn/skill/referencia.md`.
- Sin CDN: la landing no carga nada externo.

## Cómo depurar

- Iconos pegados arriba a la izquierda: `vendor.css` se cargó después del framework.
- El tema no cambia o no se recuerda: revisar que `box-ui.js` esté con `defer`.
- Colores que no cambian al editar `wspbox.css`: el token debe estar en
  `@layer box.tokens`; fuera de capa rompe `data-ui-mode`.
- Para ver una pantalla sin levantar Go: servir la carpeta `static/` con cualquier
  servidor de archivos estáticos y abrir `/index.html`.

## Cómo extender

1. Busca primero la clase en `ui.box.hn/skill/referencia.md`.
2. Si falta, crea una clase genérica `.wsp-*` en `wspbox.css`, con tokens.
3. Una pantalla nueva copia la cabecera de `static/index.html` (orden de carga).

## Llevar el diseño a `main`

El diff de la rama contra `main` solo toca `static/` y `docs/`. Antes de mergear,
traer `main` a la rama (`git merge origin/main`) para resolver choques de HTML que
`main` haya cambiado, y comprobar que `node --test static/login/index.test.cjs`
sigue pasando. Con Autodeploy activo en Dokploy, el merge a `main` despliega.

## Modales del login

El login usaba `$('#id').modal({...}).modal('show')` de Fomantic. Ahora cada modal es
un `<dialog>` de BoxUI y `assets/js/wsp-dialog.js` ofrece el mismo comportamiento:

```js
wspDialog('#modalSendTextMessage', {
  alAprobar: function () { /* ... */ return false; }  // false = el modal sigue abierto
}).mostrar();
wspDialog('#modalLoginQR').ocultar();
wspDialog('#modalLoginQR').abierto();   // true/false
```

- Botón que aprueba: `data-wsp-aprobar`; que deniega: `data-wsp-denegar`; que solo
  cierra: `data-box-close` (lo resuelve `box-ui.js`).
- `{fijo: true}` (modal del token): no se cierra con Esc ni con clic fuera. Chrome no
  deja cancelar Esc antes de que la persona interactúe con la página, por eso el helper
  reabre el modal si se cierra por una vía distinta de `ocultar()`.
- Elementos ocultos desde JS: clase `wsp-oculto` (no `hidden`). Los grupos que
  requieren sesión de WhatsApp llevan `wsp-requiere-sesion`.
- Los toasts usan `boxToast(mensaje, 'success' | 'error')`.
- Los eventos del webhook son casillas (`#webhookEvents`), no un dropdown; "Todos"
  marca y desmarca el resto.
- `static/login/index.test.cjs` simula `wspDialog`; si cambia su API, actualizar el test.

Cómo probar el login en local: compilar `go build -o wuzapi.exe .`, ejecutarlo con
`WUZAPI_ADMIN_TOKEN` y `WUZAPI_GLOBAL_ENCRYPTION_KEY` de prueba desde una carpeta
vacía, crear un usuario con `POST /admin/users` y abrir `/login/?token=<token>`. El
servidor genera un QR real; la sesión de WhatsApp no se completa sin escanearlo.

## Dashboard

Estructura: `static/dashboard/index.html` (panel) y `history.html` (visor de historial), con la
lógica en `js/app.js`, `js/groups.js` y `js/proxypool.js`. Antes usaban Fomantic UI desde CDN.

**Decisión:** la lógica (≈4.800 líneas con jQuery) no se reescribió. Cambió solo lo visual:

1. **HTML y plantillas del JS** pasaron de clases de Fomantic a BoxUI (`ui modal` -> `<dialog>`,
   `ui button` -> `box-btn`, `ui message` -> `box-alert`, iconos `x icon` -> `fas fa-x`, etc.). Se
   conservaron los ids y las clases de gancho que usa el JS: `hidden`, `widget`, `maingrid`,
   `admingrid`, `logingrid`, `adminlogin`, `no-hover`, y `positive`/`negative`/`cancel` en los botones
   de los modales.
2. **`assets/js/wsp-compat.js`** implementa sobre BoxUI los métodos de Fomantic que el código usa:
   `$.toast`, `.modal()`, `.dropdown()`, `.checkbox()` y `.form()` (validación: `empty`,
   `integer[a..b]`, `regExp[...]`, `url`). Un método nuevo se añade ahí; no hace falta tocar `app.js`.
3. **Selectores múltiples:** los de eventos son `<select multiple>` nativos (`.wsp-dropdown`); los de
   participantes de grupos son un `.wsp-multiselect` propio, con búsqueda y alta libre de números.
4. **`css/app.css` se retiró** (era de Fomantic y llevaba colores fijos). Los estados que el JS alterna
   por clase (`hidden`, `loading`, `disabled`, `show`, `info`/`success`/`error`) están en
   `wsp-dashboard.css`. `.hidden` va al final de ese archivo a propósito.

Orden de carga de scripts: jQuery, `box-ui.js`, `wsp-dialog.js`, `wsp-compat.js` y luego los de la página.

### Cómo depurar

- Un modal no abre: el elemento debe tener `id` (el puente abre por id con `wspDialog`).
- El botón del pie no dispara `onApprove`: debe estar dentro de `<footer>` y llevar `positive`,
  `approve` u `ok` (cancelar: `negative`, `deny` o `cancel`).
- Una celda de tabla corta sus botones con "…": BoxUI recorta las celdas; la de acciones ya está exenta
  en `wsp-dashboard.css`.
- Probar en local: ver "Cómo probar el login en local". El panel de administración entra con el token de
  administrador (botón Admin Login) y la vista de usuario con el token del usuario.

### Pendiente y limitaciones conocidas

- **Idioma:** el panel y el historial están en español (tú). Los mensajes de consola (`console.log/error`) y
  los valores técnicos (nombres de eventos, claves de la API, estados internos) siguen en inglés a propósito.
  Al añadir un texto nuevo, escríbelo ya en español. Ojo con la lógica que compara textos: el tipo de grupo
  (`Community`, `Community Group`, `Group`) es un valor interno y solo se traduce al mostrarlo (`etiquetaTipo`).
- Las etiquetas de color de las tarjetas de acción ("Config", "User"...) se omitieron: el divisor de
  cada grupo ya da ese contexto.
- La validación del formulario "Add Instance" muestra el primer error como aviso; Fomantic marcaba cada
  campo.
- `history.html`: se verificó que carga y ejecuta el flujo de acceso, pero no la vista de mensajes
  (requiere una instancia con historial activado y datos).
- jQuery sigue siendo una dependencia del panel; eliminarla exigiría reescribir su lógica.
