/* ============================================================
   BoxUI Public · Nav — drawers y mega menús
   Generado desde tools/fuente/. No editar a mano.
   ============================================================ */

/* BoxUI Public · Nav
   Drawer móvil, mega-menús accesibles y bloqueo de scroll. */
(function () {
    'use strict';

    var body = document.body;
    var overlay = document.querySelector('.box-overlay');

    function openPanel(panel, trigger) {
        panel.setAttribute('data-box-open', '');
        if (overlay) overlay.setAttribute('data-box-open', '');
        body.classList.add('box-no-scroll');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        // Foco al primer elemento enfocable del panel
        var first = panel.querySelector('a, button, input');
        if (first) first.focus({ preventScroll: true });
    }

    function closePanels() {
        document.querySelectorAll('[data-box-panel][data-box-open]').forEach(function (p) {
            p.removeAttribute('data-box-open');
        });
        if (overlay) overlay.removeAttribute('data-box-open');
        body.classList.remove('box-no-scroll');
        document.querySelectorAll('[aria-expanded="true"][data-box-target]').forEach(function (t) {
            t.setAttribute('aria-expanded', 'false');
        });
    }

    // Disparadores: <button data-box-target="#cart-drawer">
    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-box-target]');
        if (trigger) {
            e.preventDefault();
            var panel = document.querySelector(trigger.getAttribute('data-box-target'));
            if (!panel) return;
            panel.hasAttribute('data-box-open') ? closePanels() : openPanel(panel, trigger);
            return;
        }
        if (e.target.closest('[data-box-close]') || e.target === overlay) {
            closePanels();
            /* El aviso (.box-announce) no es un panel: data-box-close solo
               cerraba paneles y el aviso nunca se ocultaba. */
            var announce = e.target.closest('.box-announce');
            if (announce) announce.hidden = true;
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanels();
    });

    // Mega-menú por teclado: abre con Enter/Espacio, cierra al salir del item
    document.querySelectorAll('.box-nav-item-has-menu').forEach(function (item) {
        var link = item.querySelector('.box-nav-link');
        if (!link) return;
        link.setAttribute('aria-haspopup', 'true');
        link.setAttribute('aria-expanded', 'false');

        link.addEventListener('click', function (e) {
            if (window.matchMedia('(max-width: 1024px)').matches) return;
            e.preventDefault();
            var open = item.toggleAttribute('data-box-open');
            link.setAttribute('aria-expanded', String(open));
        });

        item.addEventListener('focusout', function (e) {
            if (!item.contains(e.relatedTarget)) {
                item.removeAttribute('data-box-open');
                link.setAttribute('aria-expanded', 'false');
            }
        });
    });
})();
