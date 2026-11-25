# Diseño de WspBox (BoxUI)

Rama de trabajo: `feat/landing-login-wspbox`. Todo lo visual vive en `static/`;
no hay cambios en Go, en la API ni en la base de datos. Por eso el diseño se puede
llevar a `main` con un merge cuando se decida, sin tocar el backend.

## Estado

| Pantalla | Ruta | Estado |
|---|---|---|
| Landing | `/` (`static/index.html`) | Rediseñada con BoxUI (contexto `public`) |
| Login | `/login` (`static/login/index.html`) | Pendiente: usa Fomantic UI + jQuery (ver abajo) |
| Dashboard | `/dashboard` (`static/dashboard/`) | Pendiente: usa Fomantic UI + jQuery |
| Docs, API (Swagger), Web Client | `/docs`, `/api`, `/client/` | Fuera del alcance |

## Mapa de archivos

```
static/
  index.html                  Landing (BoxUI public)
  assets/
    css/
      vendor.css              Solo importa FontAwesome en la capa `vendor`
      boxui/boxui.min.css     BoxUI núcleo (copiado de ui.box.hn, no se edita)
      boxui-public/boxui-public.min.css   Módulo landing (copiado, no se edita)
      wspbox.css              ÚNICA hoja propia: tokens de marca + clases .wsp-*
    js/
      box-ui.js               Comportamiento de BoxUI (tema, modales, toasts)
      box-nav.js              Navbar y drawer móvil de la landing
      box-motion.js           Reveal/stagger (copiado; la landing no lo usa)
    lib/fontawesome/          Iconos locales (sin CDN)
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

## Por qué el login y el dashboard siguen pendientes

Ambos están construidos con Fomantic UI y jQuery desde CDN, y su JavaScript depende
de esas librerías (en el login, unas 25 llamadas a `.modal()` y `.dropdown()` con
callbacks). Cambiar solo el HTML a BoxUI rompería el flujo del código QR y los
formularios. Rediseñarlos exige también sustituir esas llamadas por `<dialog>` de
BoxUI, que es un cambio de comportamiento y no solo de imagen.
