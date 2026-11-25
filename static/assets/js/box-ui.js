/* ============================================================
   BoxUI · box-ui.js
   Archivo único, sin dependencias. Resuelve lo que no se puede
   hacer solo con CSS: tema, modo de densidad, toasts, modales,
   navegación, header sticky, editor y sidebar de IA.

   Generado desde tools/fuente/. No editar a mano.
   ============================================================ */

/* ------------------------------------------------------------
   Tema · boxToggleTheme() — módulo 02
   ------------------------------------------------------------ */
/* Evita el flash de tema claro antes de que cargue el CSS.
   Va INLINE en el <head>, antes de cualquier <link>. */
(function () {
    var t = localStorage.getItem('box-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
})();

/* Último punto donde el usuario pulsó: de ahí sale el círculo del cambio de
   tema. Se registra en fase de captura para que lo tengamos aunque el botón
   detenga la propagación. `onclick="boxToggleTheme()"` no pasa el evento,
   y así no hace falta cambiar el HTML existente. */
var boxLastPointer = null;
document.addEventListener('pointerdown', function (e) {
    boxLastPointer = { x: e.clientX, y: e.clientY, t: Date.now() };
}, true);

/* Alternar tema.
   `origen` es opcional: un evento o un elemento desde el que se expande el
   círculo. Sin él se usa el último clic (si fue hace menos de un segundo), el
   elemento con foco (teclado) o, en último caso, la esquina superior derecha.

   Con View Transitions: se captura la página, se cambia el tema y el tema
   nuevo se revela con un `clip-path` circular. Sin soporte, o con movimiento
   reducido: fundido de color con la clase `box-theme-switching`, como v1.3. */
function boxToggleTheme(origen) {
    var root = document.documentElement;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    var apply = function () {
        root.setAttribute('data-theme', next);
        localStorage.setItem('box-theme', next);
    };
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!document.startViewTransition || reduce) {
        root.classList.add('box-theme-switching');
        apply();
        setTimeout(function () { root.classList.remove('box-theme-switching'); }, 350);
        return;
    }

    var p = boxThemeOrigin(origen);
    var w = window.innerWidth, h = window.innerHeight;
    var r = Math.hypot(Math.max(p.x, w - p.x), Math.max(p.y, h - p.y));

    root.classList.add('box-theme-vt');
    var vt = document.startViewTransition(apply);
    vt.ready.then(function () {
        root.animate(
            { clipPath: ['circle(0px at ' + p.x + 'px ' + p.y + 'px)',
                         'circle(' + r + 'px at ' + p.x + 'px ' + p.y + 'px)'] },
            { duration: 480, easing: 'cubic-bezier(.2, 0, 0, 1)',
              pseudoElement: '::view-transition-new(root)' }
        );
    });
    vt.finished.finally(function () { root.classList.remove('box-theme-vt'); });
}

function boxThemeOrigin(origen) {
    var el = null;
    if (origen && typeof origen.clientX === 'number' && origen.clientX + origen.clientY > 0) {
        return { x: origen.clientX, y: origen.clientY };
    }
    if (origen && origen.nodeType === 1) el = origen;
    else if (origen && origen.currentTarget && origen.currentTarget.nodeType === 1) el = origen.currentTarget;
    if (!el && boxLastPointer && Date.now() - boxLastPointer.t < 1000) {
        return { x: boxLastPointer.x, y: boxLastPointer.y };
    }
    if (!el && document.activeElement && document.activeElement !== document.body) {
        el = document.activeElement;
    }
    if (el) {
        var b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return { x: window.innerWidth - 40, y: 40 };
}


/* ------------------------------------------------------------
   Modo de densidad · boxSetUiMode() — módulo 18
   ------------------------------------------------------------ */
/* Cambiar y recordar el modo */
function boxSetUiMode(mode) {
    document.documentElement.setAttribute('data-ui-mode', mode);
    localStorage.setItem('box-ui-mode', mode);
}

/* Restaurar al cargar (junto al script de tema, en el <head>) */
(function () {
    var m = localStorage.getItem('box-ui-mode') || 'normal';
    document.documentElement.setAttribute('data-ui-mode', m);
})();


/* ------------------------------------------------------------
   Toasts y loader · boxToast() / boxLoader() — módulo 12
   ------------------------------------------------------------ */
/* API mínima de toasts. El proyecto solo llama boxToast(). */
(function () {
    'use strict';

    var ICONS = {
        success: 'fa-circle-check',
        error:   'fa-circle-exclamation',
        danger:  'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info'
    };

    function container() {
        var c = document.querySelector('.box-toast-container');
        if (!c) {
            c = document.createElement('div');
            c.className = 'box-toast-container';
            c.setAttribute('role', 'status');
            c.setAttribute('aria-live', 'polite');
            document.body.appendChild(c);
        }
        return c;
    }

    /* Recoloca la pila (v1.4). Recorre los toasts vivos del más nuevo al más
       viejo y deja en cada uno su orden (--_i) y su desplazamiento para la
       pila desplegada (--_y = suma de altos de los más nuevos + 8px de
       separación). Mide con scrollHeight y no offsetHeight: los de detrás
       están recortados al alto del de delante y necesitamos su alto real. */
    var GAP = 8;
    function natural(el) {
        return el.scrollHeight + (el.offsetHeight - el.clientHeight);
    }
    function layout(c) {
        var live = Array.prototype.filter.call(c.children, function (el) {
            return el.classList.contains('box-toast') && !el.hasAttribute('data-box-leaving');
        }).reverse();
        var y = 0;
        c.style.setProperty('--_front-h', live.length ? natural(live[0]) + 'px' : 'auto');
        live.forEach(function (el, i) {
            el.style.setProperty('--_i', i);
            el.style.setProperty('--_y', y + 'px');
            el.toggleAttribute('data-box-behind', i > 0);
            y += natural(el) + GAP;
        });
    }

    function remove(el) {
        if (el.hasAttribute('data-box-leaving')) return;
        el.setAttribute('data-box-leaving', '');
        if (el.parentNode) layout(el.parentNode);
        el.addEventListener('transitionend', function () { el.remove(); }, { once: true });
        setTimeout(function () { el.remove(); }, 600);   // red de seguridad
    }

    window.boxToast = function (msg, type, opts) {
        opts = opts || {};
        type = type || 'info';
        var ttl = opts.ttl === undefined ? 4000 : opts.ttl;

        var el = document.createElement('div');
        el.className = 'box-toast ' + type;
        el.innerHTML =
            '<i class="fas ' + (ICONS[type] || ICONS.info) + '"></i>' +
            '<div class="toast-content">' +
                (opts.title ? '<strong class="toast-title"></strong>' : '') +
                '<span class="toast-msg"></span>' +
            '</div>' +
            '<button class="toast-close" aria-label="Cerrar">&times;</button>' +
            (ttl ? '<span class="toast-timer"></span>' : '');

        /* textContent, nunca innerHTML: el mensaje puede venir del backend */
        if (opts.title) el.querySelector('.toast-title').textContent = opts.title;
        el.querySelector('.toast-msg').textContent = msg;
        if (ttl) el.style.setProperty('--_ttl', ttl + 'ms');

        var c = container();
        c.appendChild(el);
        layout(c);
        requestAnimationFrame(function () { el.classList.add('show'); });

        el.querySelector('.toast-close').addEventListener('click', function () { remove(el); });
        if (ttl) {
            var t = setTimeout(function () { remove(el); }, ttl);
            el.addEventListener('mouseenter', function () { clearTimeout(t); });
            el.addEventListener('mouseleave', function () {
                t = setTimeout(function () { remove(el); }, 1500);
            });
        }
        return el;
    };

    window.boxLoader = function (show, text) {
        var l = document.getElementById('global-loader');
        if (!l) return;
        if (text) { var s = l.querySelector('span:last-child'); if (s) s.textContent = text; }
        l.classList.toggle('show', !!show);
    };
})();


/* ------------------------------------------------------------
   Modales <dialog> — módulo 11
   ------------------------------------------------------------ */
/* Cierre por clic en el velo + gestión de <dialog> sin listeners por modal */
document.addEventListener('click', function (e) {
    /* Abrir: <button data-box-modal="#miModal"> */
    var opener = e.target.closest('[data-box-modal]');
    if (opener) {
        var dlg = document.querySelector(opener.getAttribute('data-box-modal'));
        if (dlg) dlg.showModal();
        return;
    }

    /* Cerrar por botón */
    var closer = e.target.closest('[data-box-close]');
    if (closer) {
        var d = closer.closest('dialog');
        if (d) d.close();
        return;
    }

    /* Cerrar al hacer clic fuera del <article> */
    if (e.target.tagName === 'DIALOG' && e.target.open) {
        var art = e.target.querySelector('article');
        if (!art) return;
        var r = art.getBoundingClientRect();
        var out = e.clientX < r.left || e.clientX > r.right ||
                  e.clientY < r.top  || e.clientY > r.bottom;
        if (out) e.target.close();
    }
});


/* ------------------------------------------------------------
   Navegación y menú móvil — módulo 09
   ------------------------------------------------------------ */
/* Estado "scrolled" de la nav + menú móvil */
(function () {
    var nav = document.querySelector('.nav-container');
    var toggle = document.getElementById('nav-toggle');
    var menu = document.getElementById('nav-menu');

    if (nav) {
        /* Alto real de la barra en `--box-nav-h`: el token es solo un valor de
           partida (la fila crece con lo que se le meta y con el modo de
           densidad) y los paneles acoplados lo usan para no quedar debajo. */
        var setNavH = function () {
            document.documentElement.style.setProperty(
                '--box-nav-h', nav.getBoundingClientRect().height.toFixed(2) + 'px');
        };
        setNavH();
        if (window.ResizeObserver) new ResizeObserver(setNavH).observe(nav);

        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                nav.toggleAttribute('data-box-scrolled', window.scrollY > 8);
                ticking = false;
            });
        }, { passive: true });
    }

    if (toggle && menu) {
        var setOpen = function (open) {
            menu.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', String(open));
        };

        toggle.setAttribute('aria-controls', 'nav-menu');
        setOpen(false);

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();   /* que no lo cierre el listener de fuera */
            setOpen(!menu.classList.contains('open'));
        });

        /* Anclas de la misma página no recargan: había que cerrarlo a mano */
        menu.addEventListener('click', function (e) {
            if (e.target.closest('a')) setOpen(false);
        });

        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target)) setOpen(false);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && menu.classList.contains('open')) {
                setOpen(false);
                toggle.focus();
            }
        });

        /* De vuelta en escritorio el menú es horizontal: la clase sobra */
        var mq = window.matchMedia('(max-width: 768px)');
        mq.addEventListener('change', function (e) { if (!e.matches) setOpen(false); });
    }
})();


/* ------------------------------------------------------------
   Compact header sticky — módulo 10
   ------------------------------------------------------------ */
/* Marca el header cuando se despega del inicio del contenedor */
(function () {
    document.querySelectorAll('.box-compact-header').forEach(function (h) {
        var sentinel = document.createElement('div');
        sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
        h.parentNode.insertBefore(sentinel, h);

        new IntersectionObserver(function (entries) {
            h.toggleAttribute('data-box-stuck', !entries[0].isIntersecting);
        }, { threshold: 0 }).observe(sentinel);
    });
})();


/* ------------------------------------------------------------
   Box Editor (WYSIWYG) — módulo 15
   ------------------------------------------------------------ */
/* --- Pegar imágenes y recomprimirlas al redimensionar ---
   Va primero en el archivo a propósito: expone `window.boxEditorPegarImagen`
   y `window.boxEditorObservarImagen`, que el bloque de abajo usa apenas
   carga —si fuera al revés, ese `window.boxEditorObservarImagen` todavía
   no existiría cuando se le llama.

   El pegado del bloque de abajo solo decide SI hay una imagen; insertarla y
   vigilar su tamaño vive aquí porque la segunda parte —recomprimir— también
   debería engancharse a una imagen puesta de cualquier otra forma (p. ej.
   `insertHTML` desde otro sitio), no solo desde el portapapeles.

   El problema real: el usuario pega una captura de 3000px, la achica a
   300px arrastrando el tirador propio (ver «REDIMENSIONAR IMÁGENES» más
   abajo) y el documento se queda con el base64 de los 3000px
   —pesando lo mismo— mostrado en una caja de 300px. La solución no es
   impedir el redimensionado: es, cuando ya terminó, volver a dibujar la
   imagen en un `<canvas>` al tamaño que realmente se ve y reemplazar el
   `src` por ESE base64, más chico. Si el usuario la agranda de vuelta no
   se vuelve a comprimir —ya se tiró el detalle, agrandar no lo devuelve—,
   así que la condición es siempre «¿el tamaño pedido es menor al tamaño
   natural de la imagen actual?». */
(function () {
    var vistos = typeof WeakSet === 'function' ? new WeakSet() : null;

    /* true la primera vez que se le pregunta por una imagen, false las
       siguientes — y de paso la marca. Si no hay `WeakSet` (muy viejo)
       vuelve siempre true: observar de más no rompe nada, no observar sí. */
    function marcarNueva(img) {
        if (!vistos) return true;
        if (vistos.has(img)) return false;
        vistos.add(img);
        return true;
    }

    function recomprimir(img) {
        var w = Math.round(img.clientWidth);
        var h = Math.round(img.clientHeight);
        if (!w || !h || !img.naturalWidth) return;
        if (w >= img.naturalWidth && h >= img.naturalHeight) return;   // agrandar no recomprime

        var lienzo = document.createElement('canvas');
        lienzo.width = w;
        lienzo.height = h;
        lienzo.getContext('2d').drawImage(img, 0, 0, w, h);

        /* Una imagen que no es base64 —cargada con `src` normal desde un
           dominio sin CORS— "mancha" el canvas: `toDataURL` tira
           `SecurityError`. No hay nada que recomprimir ahí (no hay base64
           que esté creciendo), así que se deja la imagen como está. */
        try {
            var mime = img.dataset.boxMime || 'image/png';
            img.src = lienzo.toDataURL(mime, 0.85);
            img.removeAttribute('width');
            img.removeAttribute('height');
        } catch (e) {}
    }

    /* Enganchado tanto desde el pegado (abajo) como desde la carga inicial
       del contenido (abajo): cualquier imagen que entre al editor, venga
       de donde venga, queda vigilada por si el usuario la redimensiona. */
    window.boxEditorObservarImagen = function (img, mimeConocido) {
        if (!marcarNueva(img)) return;
        if (mimeConocido) img.dataset.boxMime = mimeConocido;
        if (typeof ResizeObserver !== 'function') return;

        var espera = null;
        new ResizeObserver(function () {
            clearTimeout(espera);
            /* Debounce: mientras se arrastra el tirador el tamaño cambia en
               cada frame; recomprimir ahí sería carísimo y no serviría de
               nada hasta que el usuario suelta. */
            espera = setTimeout(function () { recomprimir(img); }, 400);
        }).observe(img);
    };

    /* API usada por el `paste` de abajo. `execCommand('insertImage')` no
       devuelve el nodo que crea, así que se identifica por descarte: de
       todas las `<img>` del editor, la nueva es la única que `marcarNueva`
       todavía no había visto (las demás ya se marcaron al cargar o al
       pegar una anterior). */
    window.boxEditorPegarImagen = function (content, file) {
        if (!file) return;
        var mime = file.type || 'image/png';
        var lector = new FileReader();
        lector.onload = function () {
            content.focus();
            document.execCommand('insertImage', false, lector.result);
            content.querySelectorAll('img').forEach(function (img) {
                window.boxEditorObservarImagen(img, mime);
            });
        };
        lector.readAsDataURL(file);
    };
})();

/* --- Redimensionar imágenes con el mouse ---
   Los tiradores nativos de `contenteditable` (`enableObjectResizing`) no
   son confiables entre navegadores —en algunos no aparece nada al hacer
   clic sobre la imagen—, así que el editor trae los suyos: un único
   tirador reutilizado, que se posiciona sobre la esquina inferior derecha
   de la imagen seleccionada. Vive en `.box-editor-container`, fuera de
   `.box-editor-content`, para no terminar guardado como parte del
   documento (lo que sí pasaría si fuera un hijo del área editable). */
(function () {
    document.querySelectorAll('.box-editor-container').forEach(function (c) {
        var content = c.querySelector('.box-editor-content');
        if (!content) return;

        var tirador = document.createElement('div');
        tirador.className = 'box-editor-resize-handle';
        tirador.setAttribute('aria-hidden', 'true');
        c.appendChild(tirador);

        var actual = null;   // <img> seleccionada, o null

        function posicionar() {
            if (!actual) { tirador.style.display = 'none'; return; }
            var rImg = actual.getBoundingClientRect();
            var rCont = c.getBoundingClientRect();
            tirador.style.display = 'block';
            tirador.style.left = (rImg.right - rCont.left - 7) + 'px';
            tirador.style.top = (rImg.bottom - rCont.top - 7) + 'px';
        }

        function seleccionar(img) {
            if (actual) actual.classList.remove('is-box-seleccionada');
            actual = img || null;
            if (actual) actual.classList.add('is-box-seleccionada');
            posicionar();
        }

        content.addEventListener('click', function (e) {
            seleccionar(e.target.closest('img'));
        });
        /* El scroll es DENTRO de `.box-editor-content` (su propio
           overflow-y), así que la imagen se mueve sin que el navegador
           reposicione nada fuera de ese scroll por su cuenta. */
        content.addEventListener('scroll', posicionar);
        window.addEventListener('resize', posicionar);
        /* Clic fuera de la imagen (y fuera del propio tirador) deselecciona */
        document.addEventListener('click', function (e) {
            if (!actual || e.target === tirador || e.target.closest('img') === actual) return;
            seleccionar(null);
        });

        var arrastrando = false, x0 = 0, y0 = 0, w0 = 0, h0 = 0;
        tirador.addEventListener('mousedown', function (e) {
            if (!actual || !actual.clientWidth) return;
            e.preventDefault();   // no robarle el foco al editor ni iniciar una selección de texto
            arrastrando = true;
            x0 = e.clientX; y0 = e.clientY;
            w0 = actual.clientWidth; h0 = actual.clientHeight;
        });
        document.addEventListener('mousemove', function (e) {
            if (!arrastrando) return;
            var w = Math.max(24, w0 + (e.clientX - x0));
            /* Proporción fija a partir del tamaño ORIGINAL (w0/h0), no del
               último frame: así no deriva con el redondeo de cada paso. */
            var h = Math.max(24, Math.round(w * (h0 / w0)));
            actual.style.width = w + 'px';
            actual.style.height = h + 'px';
            actual.removeAttribute('width');
            actual.removeAttribute('height');
            posicionar();
        });
        document.addEventListener('mouseup', function () {
            /* No hace falta recomprimir aquí: el `ResizeObserver` de arriba
               ya está mirando esta imagen (se enganchó al pegarla) y se
               encarga solo, con su propio debounce. */
            arrastrando = false;
        });
    });
})();

/* --- Recortar los cuatro lados de una imagen ---
   Doble clic sobre una imagen abre el modal: una copia de la imagen con
   cuatro tiradores —izquierda, derecha, arriba, abajo— que mueven cada
   borde de forma independiente. El recorte se calcula en porcentaje sobre
   la vista previa (da igual a qué tamaño se muestre, `.box-editor-crop-
   stack` la encoge a su tamaño real) y se aplica sobre la imagen ORIGINAL
   del documento, no sobre la copia del modal. */
(function () {
    document.querySelectorAll('.box-editor-container').forEach(function (c) {
        var content = c.querySelector('.box-editor-content');
        var modal = c.querySelector('.box-editor-crop-modal');
        if (!content || !modal) return;

        var imgModal = modal.querySelector('.box-editor-crop-img');
        var velo = {
            izq: modal.querySelector('.box-editor-crop-velo-izq'),
            der: modal.querySelector('.box-editor-crop-velo-der'),
            arriba: modal.querySelector('.box-editor-crop-velo-arriba'),
            abajo: modal.querySelector('.box-editor-crop-velo-abajo')
        };
        var tirador = {
            izq: modal.querySelector('.box-editor-crop-tirador-izq'),
            der: modal.querySelector('.box-editor-crop-tirador-der'),
            arriba: modal.querySelector('.box-editor-crop-tirador-arriba'),
            abajo: modal.querySelector('.box-editor-crop-tirador-abajo')
        };

        var imgOriginal = null;
        var pct = { izq: 0, der: 0, arriba: 0, abajo: 0 };   // % recortado de cada borde
        var MARGEN_MIN = 10;   // deja al menos 10% de ancho/alto visible

        function dibujar() {
            velo.izq.style.width = pct.izq + '%';
            velo.der.style.width = pct.der + '%';
            velo.arriba.style.height = pct.arriba + '%';
            velo.abajo.style.height = pct.abajo + '%';
            tirador.izq.style.insetInlineStart = pct.izq + '%';
            tirador.der.style.insetInlineStart = (100 - pct.der) + '%';
            tirador.arriba.style.top = pct.arriba + '%';
            tirador.abajo.style.top = (100 - pct.abajo) + '%';
            tirador.izq.setAttribute('aria-valuenow', String(Math.round(pct.izq)));
            tirador.der.setAttribute('aria-valuenow', String(Math.round(100 - pct.der)));
            tirador.arriba.setAttribute('aria-valuenow', String(Math.round(pct.arriba)));
            tirador.abajo.setAttribute('aria-valuenow', String(Math.round(100 - pct.abajo)));
        }

        content.addEventListener('dblclick', function (e) {
            var img = e.target.closest('img');
            if (!img) return;
            imgOriginal = img;
            pct = { izq: 0, der: 0, arriba: 0, abajo: 0 };
            imgModal.src = img.src;
            dibujar();
            modal.showModal();
        });

        var arrastrando = null;   // 'izq' | 'der' | 'arriba' | 'abajo' | null
        Object.keys(tirador).forEach(function (lado) {
            tirador[lado].addEventListener('mousedown', function (e) { e.preventDefault(); arrastrando = lado; });
        });

        /* El par opuesto a cada lado —para no dejar menos del margen mínimo
           entre los dos tiradores del mismo eje— y si ese eje es horizontal
           (izq/der, se lee con clientX/r.width) o vertical (arriba/abajo,
           clientY/r.height). */
        var EJE = {
            izq:    { eje: 'x', opuesto: 'der' },
            der:    { eje: 'x', opuesto: 'izq' },
            arriba: { eje: 'y', opuesto: 'abajo' },
            abajo:  { eje: 'y', opuesto: 'arriba' }
        };

        document.addEventListener('mousemove', function (e) {
            if (!arrastrando) return;
            var r = imgModal.getBoundingClientRect();
            if (!r.width || !r.height) return;
            var info = EJE[arrastrando];
            var crudo = info.eje === 'x'
                ? ((e.clientX - r.left) / r.width) * 100
                : ((e.clientY - r.top) / r.height) * 100;
            crudo = Math.max(0, Math.min(100, crudo));
            var limite = 100 - pct[info.opuesto] - MARGEN_MIN;
            /* izq/arriba avanzan desde 0%; der/abajo se miden desde su
               propio borde (100% − posición del cursor). */
            if (arrastrando === 'izq' || arrastrando === 'arriba') pct[arrastrando] = Math.max(0, Math.min(crudo, limite));
            else pct[arrastrando] = Math.max(0, Math.min(100 - crudo, limite));
            dibujar();
        });
        document.addEventListener('mouseup', function () { arrastrando = null; });

        /* Flechas de teclado sobre cada tirador, para quien no usa mouse */
        function conFlechas(lado, signoAvance) {
            tirador[lado].addEventListener('keydown', function (e) {
                var d = 0;
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') d = -1;
                else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') d = 1;
                if (!d) return;
                e.preventDefault();
                var limite = 100 - pct[EJE[lado].opuesto] - MARGEN_MIN;
                pct[lado] = Math.max(0, Math.min(pct[lado] + d * signoAvance, limite));
                dibujar();
            });
        }
        conFlechas('izq', 1);
        conFlechas('der', -1);
        conFlechas('arriba', 1);
        conFlechas('abajo', -1);

        modal.querySelector('[data-box-editor-crop-aplicar]').addEventListener('click', function () {
            if (!imgOriginal || (!pct.izq && !pct.der && !pct.arriba && !pct.abajo)) { modal.close(); return; }
            var nw = imgOriginal.naturalWidth, nh = imgOriginal.naturalHeight;
            var x0 = Math.round(nw * pct.izq / 100);
            var x1 = Math.round(nw * (1 - pct.der / 100));
            var y0 = Math.round(nh * pct.arriba / 100);
            var y1 = Math.round(nh * (1 - pct.abajo / 100));
            var w = Math.max(1, x1 - x0);
            var h = Math.max(1, y1 - y0);

            var lienzo = document.createElement('canvas');
            lienzo.width = w;
            lienzo.height = h;
            lienzo.getContext('2d').drawImage(imgOriginal, x0, y0, w, h, 0, 0, w, h);

            try {
                var mime = imgOriginal.dataset.boxMime || 'image/png';
                /* El ancho mostrado en la página se achica en la misma
                   proporción que se recortó; el alto queda en `auto` para
                   que respete la nueva proporción —ya no es la misma si se
                   recortó arriba o abajo— sin tener que recalcularlo a mano. */
                var anchoActual = imgOriginal.clientWidth || nw;
                var anchoNuevo = anchoActual * (w / nw);
                imgOriginal.src = lienzo.toDataURL(mime, 0.92);
                imgOriginal.style.width = Math.round(anchoNuevo) + 'px';
                imgOriginal.style.height = 'auto';
                imgOriginal.removeAttribute('width');
                imgOriginal.removeAttribute('height');
            } catch (err) {}   // misma imagen "manchada" por CORS de la nota de arriba

            modal.close();
        });
    });
})();

/* Refleja el estado real del cursor en los botones de la toolbar */
(function () {
    function sync(container) {
        container.querySelectorAll('[data-box-cmd]').forEach(function (btn) {
            var cmd = btn.getAttribute('data-box-cmd');
            /* createLink/unlink son acciones puntuales, no un estado que
               alternar: queryCommandState('createLink') no significa
               "el cursor está sobre un enlace", así que no se les pone
               aria-pressed (y si no lo tenían, tampoco se les inventa uno). */
            if (cmd === 'createLink' || cmd === 'unlink') return;
            var on = false;
            try { on = document.queryCommandState(cmd); } catch (e) {}
            btn.setAttribute('aria-pressed', String(on));
        });
    }

    document.querySelectorAll('.box-editor-container').forEach(function (c) {
        var content = c.querySelector('.box-editor-content');
        if (!content) return;

        /* Imágenes que ya traía el contenido al cargar (p. ej. al reabrir un
           documento guardado): se observan igual que las recién pegadas,
           adivinando el mime del propio `data:` URI si lo tiene. */
        content.querySelectorAll('img').forEach(function (img) {
            window.boxEditorObservarImagen(img, img.dataset.boxMime);
        });

        c.addEventListener('click', function (e) {
            /* Vista previa: el CSS de `[data-preview]` (más arriba) ya
               existía, pero nada lo encendía — el botón del ojo no hacía
               nada. Alterna el atributo y, para que sea una vista previa de
               verdad y no solo la toolbar atenuada, apaga `contenteditable`
               mientras tanto (si no, se podía seguir escribiendo "en
               preview" sin que ningún botón respondiera). */
            var btnPreview = e.target.closest('.box-editor-preview-btn');
            if (btnPreview) {
                var enPreview = c.toggleAttribute('data-preview');
                content.contentEditable = String(!enPreview);
                btnPreview.setAttribute('aria-pressed', String(enPreview));
                if (!enPreview) content.focus();
                return;
            }

            /* Ver/editar el HTML crudo del contenido — botón aparte, no es
               un `data-box-cmd` porque no actúa sobre la selección. */
            if (e.target.closest('[data-box-editor-code-btn]')) {
                var modalVer = c.querySelector('.box-editor-code-modal');
                if (modalVer) {
                    modalVer.querySelector('.box-editor-code-textarea').value = content.innerHTML.trim();
                    modalVer.showModal();
                }
                return;
            }
            var btnAplicar = e.target.closest('[data-box-editor-code-aplicar]');
            if (btnAplicar) {
                var modalAplicar = btnAplicar.closest('.box-editor-code-modal');
                content.innerHTML = modalAplicar.querySelector('.box-editor-code-textarea').value;
                /* El HTML pegado a mano puede traer imágenes en base64 que
                   todavía no se están vigilando para la nota 06 de arriba. */
                content.querySelectorAll('img').forEach(function (img) {
                    window.boxEditorObservarImagen(img, img.dataset.boxMime);
                });
                modalAplicar.close();
                content.focus();
                sync(c);
                return;
            }
            var btnCopiar = e.target.closest('[data-box-editor-code-copiar]');
            if (btnCopiar) {
                var modalCopiar = btnCopiar.closest('.box-editor-code-modal');
                var codigo = modalCopiar.querySelector('.box-editor-code-textarea').value;
                /* `boxCopy` vive en la nota 28 (App Patterns): si el proyecto
                   solo cargó este módulo suelto, cae a un copiado mínimo en
                   vez de reventar el resto de la toolbar con un error. */
                if (typeof boxCopy === 'function') { boxCopy(codigo, btnCopiar); }
                else {
                    var ta = modalCopiar.querySelector('.box-editor-code-textarea');
                    ta.select();
                    try { document.execCommand('copy'); } catch (err) {}
                }
                return;
            }

            var btn = e.target.closest('[data-box-cmd]');
            if (!btn) return;
            e.preventDefault();
            var cmd = btn.getAttribute('data-box-cmd');
            if (cmd === 'createLink') {
                /* prompt() es sincrónico y universal — igual que execCommand,
                   obsoleto pero es lo único con soporte garantizado aquí. */
                var url = window.prompt('URL del enlace:', 'https://');
                if (!url) { content.focus(); return; }
                document.execCommand('createLink', false, url);
            } else {
                document.execCommand(cmd, false, btn.dataset.boxVal || null);
            }
            content.focus();
            sync(c);
        });

        ['keyup', 'mouseup', 'focus'].forEach(function (ev) {
            content.addEventListener(ev, function () { sync(c); });
        });

        /* Pegar como texto plano: evita traer estilos de Word o del navegador.
           Si el portapapeles trae una imagen (captura de pantalla, copiada
           desde otra app) se inserta como `<img>` en base64 en su lugar —
           `boxEditorPegarImagen`, definida arriba, que además la recomprime
           cuando se redimensiona. */
        content.addEventListener('paste', function (e) {
            var cd = e.clipboardData || window.clipboardData;
            var items = cd && cd.items;
            for (var i = 0; items && i < items.length; i++) {
                if (items[i].type.indexOf('image/') !== 0) continue;
                e.preventDefault();
                window.boxEditorPegarImagen(content, items[i].getAsFile());
                return;
            }
            e.preventDefault();
            document.execCommand('insertText', false, cd.getData('text/plain'));
        });
    });
})();


/* ------------------------------------------------------------
   AI Sidebar — módulo 16
   ------------------------------------------------------------ */
(function () {
    var sidebar = document.getElementById('aiSidebar');
    var resizer = document.getElementById('aiResizer');
    if (!sidebar || !resizer) return;

    var MIN = 280, MAX = 640;

    function setWidth(w) {
        w = Math.min(MAX, Math.max(MIN, w));
        sidebar.style.setProperty('--_w', w + 'px');
        resizer.setAttribute('aria-valuenow', w);
        return w;
    }

    function onMove(e) {
        setWidth(window.innerWidth - e.clientX);
    }
    function stop() {
        sidebar.removeAttribute('data-resizing');
        resizer.removeAttribute('data-resizing');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', stop);
        localStorage.setItem('box-ai-width', sidebar.style.getPropertyValue('--_w'));
    }

    resizer.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        resizer.setPointerCapture(e.pointerId);
        sidebar.setAttribute('data-resizing', '');
        resizer.setAttribute('data-resizing', '');
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', stop);
    });

    /* Teclado: el mismo `role="separator"` promete esto — sin este listener
       el panel no se puede redimensionar sin mouse ni táctil. */
    resizer.addEventListener('keydown', function (e) {
        var current = parseInt(resizer.getAttribute('aria-valuenow'), 10) || sidebar.getBoundingClientRect().width;
        var step = e.shiftKey ? 40 : 16;
        var w;
        if (e.key === 'ArrowLeft')       w = current + step;   /* el carril crece hacia la izquierda */
        else if (e.key === 'ArrowRight') w = current - step;
        else if (e.key === 'Home')       w = MIN;
        else if (e.key === 'End')        w = MAX;
        else return;
        e.preventDefault();
        localStorage.setItem('box-ai-width', setWidth(w) + 'px');
    });

    /* Restaurar ancho */
    var saved = localStorage.getItem('box-ai-width');
    if (saved) setWidth(parseInt(saved, 10));
    else resizer.setAttribute('aria-valuenow', parseInt(getComputedStyle(sidebar).getPropertyValue('--_w'), 10));

    window.boxToggleAiSidebar = function () {
        sidebar.classList.toggle('collapsed');
    };
})();


/* ------------------------------------------------------------
   Patrones de panel · nav vertical, copiar, subida — módulo 28
   ------------------------------------------------------------ */
/* Los cuatro patrones que no se pueden resolver solo con CSS. Todo por
   delegación: no se registra un listener por instancia, y funciona con
   marcado inyectado después de la carga. */

/* --- Navegación vertical off-canvas ---
   `data-box-vnav-toggle="#id"` abre/cierra el menú. El velo se crea una sola
   vez y se reutiliza: no hace falta ponerlo en el HTML. */
(function () {
    var overlay = null;
    var current = null;

    function getOverlay() {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'box-vnav-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', function () { setOpen(current, false); });
        }
        return overlay;
    }

    function setOpen(nav, open) {
        if (!nav) return;
        nav.toggleAttribute('data-box-vnav-open', open);
        getOverlay().toggleAttribute('data-box-vnav-open', open);
        /* La clase va en `body`, no en `html`: la regla que la implementa
           —aquí y en `24-public-navbar.css`— selecciona `body.box-no-scroll`. */
        document.body.classList.toggle('box-no-scroll', open);
        current = open ? nav : null;

        var t = document.querySelector('[data-box-vnav-toggle="#' + nav.id + '"]');
        if (t) t.setAttribute('aria-expanded', String(open));
    }

    document.addEventListener('click', function (e) {
        var toggle = e.target.closest('[data-box-vnav-toggle]');
        if (toggle) {
            var nav = document.querySelector(toggle.getAttribute('data-box-vnav-toggle'));
            if (nav) {
                e.preventDefault();
                setOpen(nav, !nav.hasAttribute('data-box-vnav-open'));
            }
            return;
        }
        /* Navegar cierra el cajón: si el enlace es un ancla de la misma página
           no hay recarga que lo haga por nosotros. */
        if (current && e.target.closest('.box-nav-vertical a')) setOpen(current, false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && current) setOpen(current, false);
    });

    /* En escritorio el menú vuelve a ser una columna: el estado abierto sobra */
    var mq = window.matchMedia('(min-width: 992px)');
    mq.addEventListener('change', function (e) { if (e.matches && current) setOpen(current, false); });
})();

/* --- Carril del menú lateral: alfiler fijado y su preferencia recordada ---
   `:hover`/`:focus-within` ya hacen que el mini se asome por CSS; esto solo
   gobierna el fijado permanente (`data-box-rail-toggle="#id"`) y lo recuerda
   por carril en `localStorage`, igual que el tema o el modo de interfaz. */
(function () {
    var LS_PREFIJO = 'box-rail:';

    function leer(id) {
        try { return localStorage.getItem(LS_PREFIJO + id); } catch (e) { return null; }
    }
    function guardar(id, estado) {
        try { localStorage.setItem(LS_PREFIJO + id, estado); } catch (e) {}
    }

    function aplicar(rail, toggle, abierto) {
        rail.setAttribute('data-box-rail', abierto ? 'abierto' : 'mini');
        if (toggle) toggle.setAttribute('aria-pressed', String(abierto));
        guardar(rail.id, abierto ? 'abierto' : 'mini');
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-box-rail-toggle]'), function (toggle) {
        var rail = document.querySelector(toggle.getAttribute('data-box-rail-toggle'));
        if (!rail || !rail.id) return;

        var recordado = leer(rail.id);
        if (recordado) aplicar(rail, toggle, recordado === 'abierto');

        toggle.addEventListener('click', function () {
            aplicar(rail, toggle, rail.getAttribute('data-box-rail') !== 'abierto');
        });
    });
})();

/* --- Buscador del menú lateral ---
   Filtra por texto los `<li>` del `<nav>` que acompaña al buscador dentro
   del mismo carril (`.box-nav-rail-inner`). Mientras hay texto, abre los
   grupos colapsados para que sus coincidencias se vean, y los vuelve a
   cerrar al borrar la búsqueda —solo los que abrió él, nunca uno que el
   usuario ya tenía abierto a mano. */
(function () {
    function normalizar(s) {
        return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function filtrar(input) {
        var inner = input.closest('.box-nav-rail-inner');
        if (!inner) return;
        var nav = inner.querySelector('.box-nav-vertical');
        var sinResultados = inner.querySelector('.box-nav-sin-resultados');
        var clear = inner.querySelector('.box-nav-search-clear');
        var q = normalizar(input.value);
        if (clear) clear.hidden = input.value === '';

        var hayCoincidencia = false;
        Array.prototype.forEach.call(nav.querySelectorAll(':scope > ul > li'), function (li) {
            var grupo = li.querySelector(':scope > details.box-nav-group');
            var cabecera = grupo ? grupo.querySelector(':scope > summary') : li.querySelector(':scope > a');
            var opciones = grupo ? grupo.querySelectorAll('.box-nav-submenu a') : [];
            var coincideAlgo = !!cabecera && (q === '' || normalizar(cabecera.textContent).indexOf(q) !== -1);

            Array.prototype.forEach.call(opciones, function (a) {
                var coincide = q === '' || normalizar(a.textContent).indexOf(q) !== -1;
                a.closest('li').toggleAttribute('data-box-nav-oculto', q !== '' && !coincide);
                if (coincide) coincideAlgo = true;
            });

            li.toggleAttribute('data-box-nav-oculto', q !== '' && !coincideAlgo);
            if (coincideAlgo) hayCoincidencia = true;

            if (!grupo) return;
            if (q !== '' && !grupo.open) {
                grupo.open = true;
                grupo.setAttribute('data-box-nav-abierto-por-busqueda', '');
            } else if (q === '' && grupo.hasAttribute('data-box-nav-abierto-por-busqueda')) {
                grupo.open = false;
                grupo.removeAttribute('data-box-nav-abierto-por-busqueda');
            }
        });

        if (sinResultados) sinResultados.classList.toggle('is-visible', q !== '' && !hayCoincidencia);
    }

    document.addEventListener('input', function (e) {
        if (e.target.matches('.box-nav-search-input')) filtrar(e.target);
    });
    document.addEventListener('click', function (e) {
        var clear = e.target.closest('.box-nav-search-clear');
        if (!clear) return;
        var input = clear.closest('.box-nav-search').querySelector('.box-nav-search-input');
        input.value = '';
        input.focus();
        filtrar(input);
    });
})();

/* --- Tooltip lateral de las opciones del menú ---
   `.box-nav-vertical [data-box-tip]::after` está suprimido por CSS (ver
   nota de arriba): este nodo lo reemplaza. Un único flotante reutilizado
   para todo el menú —no uno por opción—, colgado de `<body>`, así que
   ningún `overflow` de la lista con scroll lo recorta. */
(function () {
    var tip = null;
    var espera = null;

    function crear() {
        if (tip) return tip;
        tip = document.createElement('div');
        tip.className = 'box-nav-tip-flotante';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
        return tip;
    }

    function ocultar() {
        clearTimeout(espera);
        if (tip) tip.classList.remove('is-visible');
    }

    function mostrar(el) {
        var texto = el.getAttribute('data-box-tip');
        if (!texto) return;
        clearTimeout(espera);
        espera = setTimeout(function () {
            var nodo = crear();
            nodo.textContent = texto;
            var r = el.getBoundingClientRect();
            nodo.classList.add('is-visible');   // visible antes de medir: si no, offsetWidth da 0
            var izquierda = r.right + 8;
            var maxIzq = window.innerWidth - nodo.offsetWidth - 8;
            nodo.style.left = Math.min(izquierda, Math.max(8, maxIzq)) + 'px';
            nodo.style.top = (r.top + r.height / 2 - nodo.offsetHeight / 2) + 'px';
        }, 350);   // mismo retraso que el tooltip nativo: no aparece al pasar de largo
    }

    document.addEventListener('mouseover', function (e) {
        var el = e.target.closest('.box-nav-vertical [data-box-tip]');
        if (el) mostrar(el); else if (!e.target.closest('.box-nav-tip-flotante')) ocultar();
    });
    document.addEventListener('focusin', function (e) {
        var el = e.target.closest('.box-nav-vertical [data-box-tip]');
        if (el) mostrar(el);
    });
    document.addEventListener('focusout', function (e) {
        if (e.target.closest('.box-nav-vertical [data-box-tip]')) ocultar();
    });
    /* Clic (navegar, abrir/cerrar un grupo) no debe dejar el tooltip colgado */
    document.addEventListener('click', function (e) {
        if (e.target.closest('.box-nav-vertical [data-box-tip]')) ocultar();
    });
    window.addEventListener('scroll', ocultar, true);
})();

/* --- Copiar al portapapeles ---
   `data-box-copy` con el texto, o apuntando a un selector con `data-box-copy-from`. */
function boxCopy(text, host) {
    var done = function (ok) {
        if (!host) return;
        var prev = host.querySelector('.box-copy-status');
        if (prev) prev.remove();

        var tag = document.createElement('span');
        tag.className = 'box-copy-status';
        tag.setAttribute('role', 'status');
        tag.textContent = ok ? 'Copiado' : 'No se pudo copiar';
        if (!ok) tag.style.background = 'var(--box-danger-solid)';
        host.appendChild(tag);
        setTimeout(function () { tag.remove(); }, 1900);
    };

    /* Respaldo con <textarea> + execCommand. Hace falta en dos casos: en
       http:// —cualquier panel servido en red local— `navigator.clipboard`
       directamente no existe; y en https:// la promesa puede rechazar por
       permiso denegado o por falta de activación del usuario. */
    var legacy = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove();
        done(ok);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
        return;
    }
    legacy();
}

document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-box-copy], [data-box-copy-from]');
    if (!btn) return;
    e.preventDefault();

    var text = btn.getAttribute('data-box-copy');
    if (text === null) {
        var src = document.querySelector(btn.getAttribute('data-box-copy-from'));
        text = src ? (src.value !== undefined ? src.value : src.textContent) : '';
    }
    boxCopy(String(text).trim(), btn.closest('.box-copy') || btn.parentElement);
});

/* --- Subida con previsualización ---
   El `<input type="file">` no acepta que se le quiten archivos: para poder
   borrar una miniatura hay que reconstruir su `FileList` con un DataTransfer.
   Por eso se guarda la lista aparte y se reasigna entera. */
(function () {
    var stores = new WeakMap();

    function render(input) {
        var wrap = input.closest('.box-upload');
        var grid = wrap && wrap.querySelector('.box-upload-grid');
        if (!grid) return;

        var files = stores.get(input) || [];
        grid.textContent = '';

        files.forEach(function (file, i) {
            var cell = document.createElement('div');
            cell.className = 'box-upload-thumb';

            if (file.type.indexOf('image/') === 0) {
                var img = document.createElement('img');
                img.alt = file.name;
                /* Se revoca en cuanto carga: un blob por archivo se acumula */
                img.src = URL.createObjectURL(file);
                img.addEventListener('load', function () { URL.revokeObjectURL(img.src); });
                cell.appendChild(img);
            } else {
                cell.textContent = file.name;
            }

            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'box-upload-remove';
            del.setAttribute('aria-label', 'Quitar ' + file.name);
            del.innerHTML = '&times;';
            del.addEventListener('click', function () {
                var list = stores.get(input) || [];
                list.splice(i, 1);
                commit(input, list);
            });
            cell.appendChild(del);

            if (i === 0 && input.multiple) cell.setAttribute('data-box-main', 'Portada');
            grid.appendChild(cell);
        });
    }

    function commit(input, files) {
        var dt = new DataTransfer();
        files.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
        stores.set(input, files);
        render(input);
    }

    function accept(input, incoming) {
        var max = parseInt(input.getAttribute('data-box-max') || '0', 10);
        var files = input.multiple ? (stores.get(input) || []).slice() : [];
        for (var i = 0; i < incoming.length; i++) {
            if (max > 0 && files.length >= max) break;
            files.push(incoming[i]);
            if (!input.multiple) break;
        }
        commit(input, files);
    }

    document.addEventListener('change', function (e) {
        var input = e.target;
        if (!input.matches || !input.matches('.box-upload input[type="file"]')) return;
        /* `input.files` ya trae solo la última selección: acumular es la razón
           de existir de este bloque. */
        accept(input, input.files);
    });

    ['dragenter', 'dragover'].forEach(function (type) {
        document.addEventListener(type, function (e) {
            var drop = e.target.closest && e.target.closest('.box-upload-drop');
            if (!drop) return;
            e.preventDefault();
            drop.classList.add('is-over');
        });
    });

    ['dragleave', 'drop'].forEach(function (type) {
        document.addEventListener(type, function (e) {
            var drop = e.target.closest && e.target.closest('.box-upload-drop');
            if (!drop) return;
            drop.classList.remove('is-over');
        });
    });

    document.addEventListener('drop', function (e) {
        var drop = e.target.closest && e.target.closest('.box-upload-drop');
        if (!drop || !e.dataTransfer) return;
        e.preventDefault();
        var input = drop.closest('.box-upload').querySelector('input[type="file"]');
        if (input && !input.disabled) accept(input, e.dataTransfer.files);
    });
})();

/* --- Tarjeta enlace: luz que sigue al cursor (v1.4) ---
   Escribe la posición del puntero dentro de la `.box-card-link` en
   `--_mx` / `--_my`. El CSS de la luz vive en el módulo 13. Un solo listener
   por documento; `pointermove` es pasivo y solo escribe dos variables. */
(function () {
    document.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var card = e.target.closest && e.target.closest('.box-card-link');
        if (!card) return;
        var r = card.getBoundingClientRect();
        card.style.setProperty('--_mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--_my', (e.clientY - r.top) + 'px');
    }, { passive: true });
})();

/* --- Cifras que cuentan hasta su valor: data-box-count (v1.4) ---
   <span class="box-stat-value" data-box-count="128450" data-box-prefix="L ">L 128.450</span>

   El HTML ya trae la cifra final escrita: sin JS, con movimiento reducido o
   si el elemento nunca entra en pantalla, eso es lo que se lee. Al entrar en
   pantalla por primera vez la cifra sube desde 0 en ~1,1 s, con salida
   suave. Atributos opcionales:
     data-box-prefix / data-box-suffix  texto antes/después ("L ", " %")
     data-box-decimals                  decimales a mostrar (0 por defecto)
   El formato de miles sigue el `lang` del <html> (es-HN → 128,450 / es → 128.450). */
(function () {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var lang = document.documentElement.lang || undefined;

    function format(el, value) {
        var dec = parseInt(el.getAttribute('data-box-decimals') || '0', 10);
        return (el.getAttribute('data-box-prefix') || '') +
            value.toLocaleString(lang, { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
            (el.getAttribute('data-box-suffix') || '');
    }

    function run(el) {
        var to = parseFloat(el.getAttribute('data-box-count'));
        if (isNaN(to)) return;
        var start = performance.now(), dur = 1100;
        (function step(now) {
            var p = Math.min(1, (now - start) / dur);
            var eased = 1 - Math.pow(1 - p, 4);   // ease-out: frena al llegar
            el.textContent = format(el, to * eased);
            if (p < 1) requestAnimationFrame(step);
        })(start);
    }

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            run(e.target);
        });
    }, { threshold: 0.4 });

    function scan(scope) {
        (scope || document).querySelectorAll('[data-box-count]').forEach(function (el) {
            if (el.boxCount) return;
            el.boxCount = true;
            io.observe(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { scan(); });
    } else {
        scan();
    }
    /* Para cifras inyectadas después (tablero que se refresca por fetch). */
    window.boxCountRefresh = scan;
})();


/* ------------------------------------------------------------
   Gráficos · boxChartTheme() / boxOnThemeChange() — módulo 27
   ------------------------------------------------------------ */
/* Devuelve los colores del tema actual para pasárselos a la librería de
   gráficos. Se lee del CSS calculado, así que respeta el tema, el modo y
   cualquier override del proyecto.

   Chart.js no entiende var(--…): hay que resolverlo antes.

   Uso:
     const t = boxChartTheme();
     new Chart(ctx, {
         data: { datasets: [{ data, backgroundColor: t.palette }] },
         options: {
             color: t.label,
             scales: { x: { grid: { color: t.grid } }, y: { grid: { color: t.grid } } }
         }
     });

   Al cambiar de tema hay que volver a llamarla y actualizar el gráfico:
     boxOnThemeChange(() => { aplicar(boxChartTheme()); chart.update(); });
*/
window.boxChartTheme = function (el) {
    const cs = getComputedStyle(el || document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const palette = [];
    for (let i = 1; i <= 8; i++) palette.push(v('--box-chart-' + i));
    return {
        palette: palette,
        grid: v('--box-chart-grid'),
        label: v('--box-chart-label'),
        text: v('--box-text'),
        surface: v('--box-surface'),
        brand: v('--box-brand'),
        font: v('--box-font-family'),
        fontSize: parseFloat(v('--box-font-size')) || 14
    };
};

/* Color de la serie n (1-based), ciclando la paleta. */
window.boxChartColor = function (n, el) {
    const cs = getComputedStyle(el || document.documentElement);
    return cs.getPropertyValue('--box-chart-' + (((n - 1) % 8) + 1)).trim();
};

/* Avisa cuando cambia el tema o el modo de densidad. Lo que se pinta en un
   <canvas> no se re-tematiza solo: hay que redibujarlo.
   Devuelve una función para dejar de observar. */
window.boxOnThemeChange = function (fn) {
    const obs = new MutationObserver(function (muts) {
        for (const m of muts) {
            if (m.attributeName === 'data-theme' || m.attributeName === 'data-ui-mode') { fn(); return; }
        }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-ui-mode'] });
    return function () { obs.disconnect(); };
};

/* Leyenda: alterna aria-pressed al pulsar y avisa con un evento — BoxUI no
   sabe ocultar una serie en Chart.js/lo que sea, solo refleja el estado.
   Antes la leyenda se veía clicable (cursor, hover) pero no hacía nada.
   Uso: legend.addEventListener('box-chart-legend-change', e => {
       chart.setDatasetVisibility(e.detail.index, e.detail.on); chart.update();
   }); */
document.addEventListener('click', function (e) {
    var btn = e.target.closest('.box-chart-legend > button');
    if (!btn) return;
    var legend = btn.parentElement;
    var buttons = Array.prototype.slice.call(legend.children);
    var on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    legend.dispatchEvent(new CustomEvent('box-chart-legend-change', {
        bubbles: true,
        detail: { index: buttons.indexOf(btn), on: on }
    }));
});

/* Si el gráfico es el patrón SVG a mano (no Chart.js), la leyenda puede
   ocultar la serie por su cuenta: basta con marcar cada barra/sector/línea
   (trazo, área y puntos, los tres con el mismo índice) con
   data-box-chart-series="N" (mismo índice que su botón en la leyenda).
   display:none, no opacity: la serie desaparece del todo, no se atenúa.
   En barras y pastel, además, las que quedan se redistribuyen para llenar
   el mismo espacio que ocupaban todas — como en cualquier librería real al
   quitar una categoría, no un hueco vacío en su lugar. La línea no
   redistribuye: su eje X son fechas/categorías fijas, no huecos que cerrar.
   Con Chart.js real, ignora todo esto y usa el evento de arriba en su lugar. */
document.addEventListener('box-chart-legend-change', function (e) {
    var scope = e.target.closest('article') || e.target.parentElement;
    if (!scope) return;
    scope.querySelectorAll('[data-box-chart-series="' + e.detail.index + '"]').forEach(function (el) {
        el.style.display = e.detail.on ? '' : 'none';
    });

    var bars = scope.querySelectorAll('rect[data-box-chart-series]');
    if (bars.length) reflowBoxChartBars(bars);

    var segs = scope.querySelectorAll('.box-chart-pie-seg');
    if (segs.length) reflowBoxChartPie(segs);
});

function reflowBoxChartBars(bars) {
    var list = Array.prototype.slice.call(bars);
    /* x/width ORIGINALES, guardados una sola vez: hace falta calcular
       siempre desde "todas visibles", no ir acumulando redondeos toggle
       tras toggle (si no, un vaivén de clics iría desviando el resultado). */
    list.forEach(function (r) {
        if (r.dataset.boxChartX0 === undefined) {
            r.dataset.boxChartX0 = r.getAttribute('x');
            r.dataset.boxChartW0 = r.getAttribute('width');
        }
    });
    var lefts = list.map(function (r) { return parseFloat(r.dataset.boxChartX0); });
    var rights = list.map(function (r, i) { return lefts[i] + parseFloat(r.dataset.boxChartW0); });
    var left = Math.min.apply(null, lefts);
    var right = Math.max.apply(null, rights);
    var visible = list.filter(function (r) { return r.style.display !== 'none'; });
    if (!visible.length) return;

    /* Conserva la proporción ancho:hueco original (no un valor fijo): con
       todas las barras visibles el resultado es, bit a bit, el original —
       ocultar y volver a mostrar todo no desplaza nada. */
    var w0 = parseFloat(list[0].dataset.boxChartW0);
    var gapSum = 0, gapCount = 0;
    for (var i = 1; i < list.length; i++) { gapSum += lefts[i] - rights[i - 1]; gapCount++; }
    var k = gapCount && gapSum > 0 ? w0 / (gapSum / gapCount) : null;   // ancho:hueco

    var n = visible.length;
    var span = right - left;
    var barW = k ? span / (n + (n - 1) / k) : span / n;
    var gap = k ? barW / k : 0;

    visible.forEach(function (r, i) {
        r.setAttribute('x', left + i * (barW + gap));
        r.setAttribute('width', barW);
    });
}

function reflowBoxChartPie(segs) {
    var list = Array.prototype.slice.call(segs);
    var r = parseFloat(list[0].getAttribute('r'));
    var circumference = 2 * Math.PI * r;
    var visible = list.filter(function (c) { return c.style.display !== 'none'; });
    var total = visible.reduce(function (sum, c) {
        return sum + parseFloat(c.dataset.boxChartFrac || 0);
    }, 0);
    if (!total) return;
    var offset = 0;
    visible.forEach(function (c) {
        var frac = parseFloat(c.dataset.boxChartFrac || 0) / total;
        var len = frac * circumference;
        c.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + circumference.toFixed(1));
        c.setAttribute('stroke-dashoffset', String(-offset));
        offset += len;
    });
}

/* Tooltip al pasar el ratón/el dedo por un dato: cualquier elemento con
   data-box-chart-value dentro de .box-chart. El texto es
   "data-box-chart-label: data-box-chart-value" (o solo el valor, si no hay
   label). Un solo tooltip por gráfico, creado la primera vez que hace falta. */
(function () {
    function tooltipFor(box) {
        var tip = box.querySelector('.box-chart-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'box-chart-tooltip';
            box.appendChild(tip);
        }
        return tip;
    }
    function place(tip, box, ev) {
        var r = box.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left) + 'px';
        tip.style.top = (ev.clientY - r.top) + 'px';
    }
    document.addEventListener('pointerover', function (e) {
        var el = e.target.closest('[data-box-chart-value]');
        if (!el) return;
        var box = el.closest('.box-chart');
        if (!box) return;
        var tip = tooltipFor(box);
        tip.textContent = el.hasAttribute('data-box-chart-label')
            ? el.getAttribute('data-box-chart-label') + ': ' + el.getAttribute('data-box-chart-value')
            : el.getAttribute('data-box-chart-value');
        tip.classList.add('show');
        place(tip, box, e);
        function move(ev) { place(tip, box, ev); }
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', function hide() {
            tip.classList.remove('show');
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerleave', hide);
        }, { once: true });
    });
})();


/* ------------------------------------------------------------
   Pestañas · activación y teclado — módulo 31
   ------------------------------------------------------------ */
/* Pestañas · activación por clic y teclado — módulo 31.
   Todo por delegación: un listener por documento, no uno por pestaña.
   El estado vive en `aria-selected` + `tabindex` roving. */
(function () {
    'use strict';

    function activate(root, tab, focus) {
        root.querySelectorAll('[role="tab"]').forEach(function (t) {
            var on = t === tab;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
        });
        root.querySelectorAll('[role="tabpanel"]').forEach(function (p) {
            p.hidden = p.getAttribute('aria-labelledby') !== tab.id;
        });
        if (focus) tab.focus();
    }

    document.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-box-tabs] [role="tab"]');
        if (!tab) return;
        activate(tab.closest('[data-box-tabs]'), tab, false);
    });

    document.addEventListener('keydown', function (e) {
        var tab = e.target.closest && e.target.closest('[data-box-tabs] [role="tab"]');
        if (!tab) return;
        var root = tab.closest('[data-box-tabs]');
        var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
        var i = tabs.indexOf(tab);
        var next = null;
        if (e.key === 'ArrowRight')      next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft')  next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home')       next = tabs[0];
        else if (e.key === 'End')        next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activate(root, next, true); }
    });

    /* API opcional: cambiar de pestaña desde el código de la app.
       boxTabsShow('#detalle', 'historial') — activa la pestaña por id. */
    window.boxTabsShow = function (root, tabId) {
        var r = typeof root === 'string' ? document.querySelector(root) : root;
        if (!r) return;
        var tab = r.querySelector('#' + tabId);
        if (tab) activate(tab.closest('[data-box-tabs]'), tab, false);
    };
})();

/* Indicador deslizante · pestañas (módulo 31) y control segmentado (módulo 23).
   v1.4. Un solo mecanismo para los dos: medir el elemento activo y escribir
   su posición en el contenedor (`--_ind-x`, `--_ind-w`). El CSS de cada
   módulo pinta el indicador y lo anima.

   No depende de quién cambie el estado: escucha los atributos ARIA
   (`aria-selected` / `aria-pressed`) con un MutationObserver, así que
   funciona igual con el JS de pestañas de arriba que con el código del
   proyecto que alterna un segmentado. Un ResizeObserver re-mide cuando
   cambia el ancho (carga de fuentes, ventana, panel que estaba oculto). */
(function () {
    'use strict';

    var SEL = '.box-tablist, .box-segmented';
    /* Solo hijos directos: un segmentado dentro de un panel no debe mover
       el indicador de la lista de pestañas que lo contiene. */
    var ACTIVE = ':scope > [aria-selected="true"], :scope > [aria-pressed="true"]';

    var resize = 'ResizeObserver' in window
        ? new ResizeObserver(function (entries) {
            entries.forEach(function (e) { place(e.target); });
        })
        : null;

    function place(list) {
        var active = list.querySelector(ACTIVE);
        if (!active || !active.offsetWidth) {
            list.removeAttribute('data-box-indicator');
            return;
        }
        list.style.setProperty('--_ind-x', active.offsetLeft + 'px');
        list.style.setProperty('--_ind-w', active.offsetWidth + 'px');
        /* El atributo se pone después de las variables: el pseudo-elemento
           nace ya en su sitio y no se anima desde la izquierda al cargar. */
        list.setAttribute('data-box-indicator', '');
    }

    function init(list) {
        if (list.boxIndicator) return;
        list.boxIndicator = true;
        place(list);
        if (resize) resize.observe(list);
    }

    function scan(scope) {
        (scope || document).querySelectorAll(SEL).forEach(init);
    }

    if (!('MutationObserver' in window)) return;   // sin soporte: subrayado clásico

    new MutationObserver(function (muts) {
        muts.forEach(function (m) {
            if (m.type === 'attributes') {
                var list = m.target.parentElement;
                if (list && list.matches(SEL)) { init(list); place(list); }
            } else {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType !== 1) return;
                    if (n.matches(SEL)) init(n);
                    scan(n);
                });
            }
        });
    }).observe(document.documentElement, {
        subtree: true, childList: true,
        attributes: true, attributeFilter: ['aria-selected', 'aria-pressed']
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { scan(); });
    } else {
        scan();
    }
})();


/* ------------------------------------------------------------
   Menú desplegable — módulo 32
   ------------------------------------------------------------ */
/* Menú desplegable · apertura, cierre por clic fuera y Esc — módulo 32.
   Un solo listener por documento: la apertura vive en `data-box-open`. */
(function () {
    'use strict';

    function open(dd) {
        var trigger = dd.querySelector('[data-box-dropdown]');
        dd.setAttribute('data-box-open', '');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        var first = dd.querySelector('.box-menu button, .box-menu a');
        if (first) first.focus({ preventScroll: true });
    }
    function close(dd) {
        var trigger = dd.querySelector('[data-box-dropdown]');
        dd.removeAttribute('data-box-open');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus({ preventScroll: true });
        }
    }

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-box-dropdown]');
        document.querySelectorAll('.box-dropdown[data-box-open]').forEach(function (dd) {
            if (!trigger || !dd.contains(trigger)) close(dd);
        });
        if (!trigger) return;
        var dd = trigger.closest('.box-dropdown');
        if (dd.hasAttribute('data-box-open')) close(dd);
        else open(dd);
    });

    document.addEventListener('keydown', function (e) {
        var openDd = document.querySelector('.box-dropdown[data-box-open]');
        if (!openDd) return;

        if (e.key === 'Escape') { close(openDd); return; }

        /* Flechas, Home y End dentro del menú abierto — el mismo recorrido
           que ya tiene `.box-tabs` con sus pestañas, aquí sobre los ítems. */
        var items = openDd.querySelectorAll('.box-menu button, .box-menu a');
        if (!items.length) return;
        var i = Array.prototype.indexOf.call(items, document.activeElement);
        if (i === -1) return;

        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    });
})();


/* ------------------------------------------------------------
   Slider y carrusel — módulo 33
   ------------------------------------------------------------ */
/* Slider / carrusel · flechas, puntos, teclado, deslizamiento y autoplay — módulo 33.
   El índice vive en la propiedad `--_i` del contenedor; el CSS hace la
   transformación. Los estados de accesibilidad (aria-hidden, aria-current)
   se sincronizan aquí. */
(function () {
    'use strict';

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function slides(c) { return c.querySelectorAll('.box-carousel-slide'); }
    function dots(c) { return c.querySelectorAll('.box-carousel-dot'); }
    function last(c) { return slides(c).length - 1; }
    function current(c) {
        var i = parseInt(c.style.getPropertyValue('--_i') || '0', 10);
        return isNaN(i) ? 0 : Math.max(0, Math.min(i, last(c)));
    }
    function render(c, i) {
        i = Math.max(0, Math.min(i, last(c)));
        c.style.setProperty('--_i', i);
        slides(c).forEach(function (s, k) { s.setAttribute('aria-hidden', String(k !== i)); });
        dots(c).forEach(function (d, k) { d.setAttribute('aria-current', String(k === i)); });
    }
    function move(c, dir) { render(c, current(c) + dir); }

    /* Autoplay opcional: data-box-carousel-interval="4000".
       Se pausa al pasar el ratón o enfocar; respeta prefers-reduced-motion. */
    function bindAutoplay(c) {
        var ms = parseInt(c.getAttribute('data-box-carousel-interval'), 10);
        if (!ms || reduce) return;
        var timer = null;
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        function play() {
            stop();
            timer = setInterval(function () {
                if (!document.hidden) move(c, 1);
            }, ms);
        }
        c.addEventListener('pointerenter', stop);
        c.addEventListener('focusin', stop);
        c.addEventListener('pointerleave', play);
        c.addEventListener('focusout', function (e) {
            if (!c.contains(e.relatedTarget)) play();
        });
        play();
    }

    function init(scope) {
        (scope || document).querySelectorAll('[data-box-carousel]').forEach(function (c) {
            render(c, current(c));
            if (!c._boxAuto) { bindAutoplay(c); c._boxAuto = true; }
        });
    }
    init();

    window.boxCarouselRefresh = init;                 // contenido inyectado
    window.boxCarouselGo = function (root, i) {        // ir a una diapositiva
        var c = typeof root === 'string' ? document.querySelector(root) : root;
        if (c) render(c, i);
    };

    /* Clic en flechas y puntos */
    document.addEventListener('click', function (e) {
        var car = e.target.closest('[data-box-carousel]');
        if (!car) return;
        if (e.target.closest('[data-box-carousel-next]')) move(car, 1);
        else if (e.target.closest('[data-box-carousel-prev]')) move(car, -1);
        else {
            var dot = e.target.closest('[data-box-carousel-dot]');
            if (dot) render(car, parseInt(dot.getAttribute('data-box-carousel-dot'), 10));
        }
    });

    /* Teclado: ← → cuando el foco está dentro del carrusel */
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var car = e.target.closest && e.target.closest('[data-box-carousel]');
        if (!car) return;
        if (e.target.matches('input, textarea, select, [contenteditable]')) return;
        e.preventDefault();
        move(car, e.key === 'ArrowRight' ? 1 : -1);
    });

    /* Deslizamiento táctil (y con el ratón) sobre el viewport.
       El viewport declara touch-action: pan-y, así que el gesto vertical es del
       navegador (scroll de página) y solo el horizontal llega aquí. La diapositiva
       acompaña al dedo y al soltar avanza si pasó el umbral o vuelve a su sitio. */
    var drag = null;

    function dragEnd(ev, cancelled) {
        if (!drag || (ev && ev.pointerId !== drag.id)) return;
        var d = drag;
        drag = null;
        if (!d.on) return;
        d.track.style.transition = '';
        d.track.style.transform = '';
        var w = d.viewport.offsetWidth || 1;
        var dx = cancelled ? 0 : d.dx;
        if (Math.abs(dx) > Math.min(60, w * 0.18)) move(d.car, dx < 0 ? 1 : -1);
        else render(d.car, current(d.car));
        /* Un arrastre no debe activar el enlace o botón sobre el que terminó */
        var swallow = function (c) { c.stopPropagation(); c.preventDefault(); };
        document.addEventListener('click', swallow, true);
        setTimeout(function () { document.removeEventListener('click', swallow, true); }, 60);
    }

    document.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var viewport = e.target.closest && e.target.closest('.box-carousel-viewport');
        if (!viewport) return;
        drag = {
            id: e.pointerId, viewport: viewport, car: viewport.closest('[data-box-carousel]'),
            track: viewport.querySelector('.box-carousel-track'),
            x: e.clientX, y: e.clientY, dx: 0, on: false
        };
    });

    document.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.on) {
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
            drag.on = true;
            drag.track.style.transition = 'none';
            if (e.pointerType === 'mouse') drag.viewport.setPointerCapture(e.pointerId);
        }
        drag.dx = dx;
        drag.track.style.transform =
            'translateX(calc(var(--_i, 0) * (var(--box-carousel-peek) - 100%) + ' + dx + 'px))';
    });

    document.addEventListener('pointerup', function (e) { dragEnd(e, false); });
    document.addEventListener('pointercancel', function (e) { dragEnd(e, true); });
})();


/* ------------------------------------------------------------
   Asistente por pasos · boxWizardGo() — módulo 29
   ------------------------------------------------------------ */
/* Asistente por pasos: mueve aria-current y data-box-step="done" entre los
   .box-wizard-step al pulsar Siguiente/Atrás — módulo 29.
   Deliberadamente NO decide qué panel mostrar por paso ni valida campos:
   eso es lógica de la app (un wizard real casi siempre valida antes de
   avanzar). Esto solo resuelve el indicador visual, que es lo que es
   igual en cualquier asistente. Opcional: sin data-box-wizard en el
   contenedor, los botones no hacen nada por su cuenta. */
(function () {
    function steps(root) { return Array.prototype.slice.call(root.querySelectorAll('.box-wizard-step')); }
    function current(root) { return steps(root).findIndex(function (s) { return s.getAttribute('aria-current') === 'step'; }); }

    function render(root, i) {
        var list = steps(root);
        i = Math.max(0, Math.min(i, list.length - 1));
        list.forEach(function (s, k) {
            s.removeAttribute('aria-current');
            if (k === i) {
                s.setAttribute('aria-current', 'step');
                s.removeAttribute('data-box-step');
                s.removeAttribute('aria-disabled');
            } else if (k < i) {
                s.setAttribute('data-box-step', 'done');
                s.removeAttribute('aria-disabled');
            } else {
                s.removeAttribute('data-box-step');
            }
        });
        root.dispatchEvent(new CustomEvent('box-wizard-change', { detail: { index: i }, bubbles: true }));
    }

    window.boxWizardGo = function (rootOrSelector, i) {
        var root = typeof rootOrSelector === 'string' ? document.querySelector(rootOrSelector) : rootOrSelector;
        if (root) render(root, i);
    };

    document.addEventListener('click', function (e) {
        var root = e.target.closest('[data-box-wizard]');
        if (!root) return;
        if (e.target.closest('[data-box-wizard-next]')) render(root, current(root) + 1);
        else if (e.target.closest('[data-box-wizard-prev]')) render(root, current(root) - 1);
    });
})();
