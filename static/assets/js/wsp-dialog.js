/* ============================================================
   wsp-dialog.js · modales de WspBox sobre <dialog> nativo
   ------------------------------------------------------------
   Qué hace: da a la página de login el comportamiento que antes
     daba Fomantic UI con $('#id').modal({...}).modal('show'):
     callbacks al mostrar, al ocultar y al aprobar/denegar, y
     modales "fijos" que no se cierran con Esc ni con clic fuera.
     El cierre por botón (data-box-close) y por clic en el velo
     ya lo resuelve box-ui.js; aquí no se duplica.
   Expone: window.wspDialog(selector, opciones?) -> { mostrar(),
     ocultar(), abierto() }.
   Opciones (todas opcionales):
     fijo        true: no se cierra con Esc ni con clic fuera.
     alMostrar   función, al abrir.
     alOcultar   función, al cerrar (por cualquier vía).
     alAprobar   función, al pulsar [data-wsp-aprobar]. Si devuelve
                 false el modal se queda abierto (por ejemplo para
                 mostrar el resultado de una acción en el propio
                 modal); cualquier otro valor lo cierra.
     alDenegar   función, al pulsar [data-wsp-denegar]; cierra.
   Uso: las opciones se guardan en el <dialog>; llamar de nuevo con
     otras opciones las reemplaza, y llamar sin opciones solo
     devuelve los controles (mostrar/ocultar/abierto).
   Depende de: nada (JavaScript nativo). Debe cargarse SIN defer,
     antes del script de la página, porque el login abre un modal
     mientras se está parseando.
   Documentación: docs/diseno-ui.md
   Limitación conocida: no replica las animaciones de Fomantic.
   ============================================================ */
(function () {
    'use strict';

    /* Conecta una sola vez los eventos de un <dialog>; las opciones
       viven en dlg._wsp y se leen en cada evento. */
    function conectar(dlg) {
        if (dlg._wspConectado) return;
        dlg._wspConectado = true;

        dlg.addEventListener('click', function (e) {
            var o = dlg._wsp || {};

            /* Modal fijo: el clic sobre el velo no debe llegar al
               manejador global de box-ui.js, que lo cerraría. */
            if (o.fijo && e.target === dlg) {
                e.stopPropagation();
                return;
            }

            var aprobar = e.target.closest('[data-wsp-aprobar]');
            if (aprobar && dlg.contains(aprobar)) {
                var res = o.alAprobar ? o.alAprobar() : undefined;
                if (res !== false) dlg.close();
                return;
            }

            var denegar = e.target.closest('[data-wsp-denegar]');
            if (denegar && dlg.contains(denegar)) {
                if (o.alDenegar) o.alDenegar();
                dlg.close();
            }
        });

        /* Esc: en un modal fijo se cancela el cierre */
        dlg.addEventListener('cancel', function (e) {
            if (dlg._wsp && dlg._wsp.fijo) e.preventDefault();
        });

        dlg.addEventListener('close', function () {
            var cerradoPorCodigo = dlg._wspCerrando;
            dlg._wspCerrando = false;

            /* Chrome no permite cancelar "cancel" (Esc) si la persona aún
               no ha interactuado con la página: el modal fijo se cierra
               igual. Si no lo cerró ocultar(), se vuelve a abrir. */
            if (dlg._wsp && dlg._wsp.fijo && !cerradoPorCodigo) {
                dlg.showModal();
                return;
            }
            if (dlg._wsp && dlg._wsp.alOcultar) dlg._wsp.alOcultar();
        });
    }

    window.wspDialog = function (selector, opciones) {
        var dlg = document.querySelector(selector);
        if (!dlg) {
            console.error('wspDialog: no existe ' + selector);
            return { mostrar: function () {}, ocultar: function () {}, abierto: function () { return false; } };
        }
        conectar(dlg);
        if (opciones) dlg._wsp = opciones;

        return {
            mostrar: function () {
                if (dlg.open) return;   // ya abierto: no repetir alMostrar
                dlg.showModal();
                if (dlg._wsp && dlg._wsp.alMostrar) dlg._wsp.alMostrar();
            },
            ocultar: function () {
                if (!dlg.open) return;
                dlg._wspCerrando = true;   // cierre intencionado: no reabrir un modal fijo
                dlg.close();
            },
            abierto: function () { return dlg.open; }
        };
    };
})();
