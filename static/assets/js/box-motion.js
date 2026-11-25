/* ============================================================
   BoxUI Public · Motion — reveal al scroll
   Generado desde tools/fuente/. No editar a mano.
   ============================================================ */

/* BoxUI Public · Motion
   Un único IntersectionObserver para toda la página. */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Marca que el JS está vivo: recién aquí el CSS aplica el estado inicial.
    root.classList.add('box-motion-ready');
    if (reduce || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.setAttribute('data-box-inview', '');
            // once (default): deja de observar. repeat: se re-anima al volver a entrar.
            if (entry.target.dataset.boxRepeat === undefined) {
                observer.unobserve(entry.target);
            }
        });

        entries.forEach(function (entry) {
            if (entry.isIntersecting) return;
            if (entry.target.dataset.boxRepeat !== undefined) {
                entry.target.removeAttribute('data-box-inview');
            }
        });
    }, {
        // Dispara un poco antes de que el elemento toque el borde inferior.
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.1
    });

    function observeAll(scope) {
        (scope || document).querySelectorAll('[data-box-reveal]').forEach(function (el) {
            observer.observe(el);
        });
    }
    observeAll();

    // Contenido inyectado después (paginación, filtros de tienda, infinite scroll)
    window.boxMotionRefresh = observeAll;

    // Navbar: estado "scrolled" + barra de progreso
    var nav = document.querySelector('[data-box-nav]');
    var progress = document.querySelector('.box-scroll-progress');
    var toTop = document.querySelector('[data-box-to-top]');
    if (toTop) toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    var ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            var y = window.scrollY;
            if (nav) nav.toggleAttribute('data-box-scrolled', y > 12);
            if (progress) {
                var max = document.documentElement.scrollHeight - window.innerHeight;
                progress.style.setProperty('--boxp-progress', max > 0 ? (y / max).toFixed(4) : 0);
            }
            /* Botón "volver arriba" (nota 27): usa el mismo listener de scroll. */
            if (toTop) toTop.toggleAttribute('data-box-visible', y > 600);
            ticking = false;
        });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();
