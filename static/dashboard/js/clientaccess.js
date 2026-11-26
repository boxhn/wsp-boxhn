/*
 * clientaccess.js — Dashboard: acceso restringido del cliente web (/client).
 *
 * Qué hace: desde el widget #clientAccessConfig abre el modal "Acceso del cliente web"
 * para crear un token de cliente aparte y elegir qué puede hacer quien lo use: ver
 * contactos, grupos e historial, configurar el historial y borrar conversaciones.
 * También permite activar/desactivar, regenerar el token y revocarlo.
 * Qué expone: nada global; engancha eventos al cargar la página.
 * Depende de: jQuery y el puente wsp-compat.js (modales), y de las funciones globales de
 * app.js: baseUrl, getLocalStorageItem, showError, showSuccess.
 * Orden de carga: después de app.js (ver index.html).
 * API que usa: GET/POST/DELETE /session/client-access (ver static/guia/client-access.md).
 *
 * Nota: la configuración se hace con el token del usuario (dueño). El token de cliente
 * no puede llegar aquí: el servidor responde 403.
 */
(function () {
  'use strict';

  var current = null; // última configuración recibida del servidor

  function headers() {
    var h = new Headers();
    h.append('token', getLocalStorageItem('token'));
    h.append('Content-Type', 'application/json');
    return h;
  }

  // Llama a la API y devuelve {ok, body}; no lanza por respuestas HTTP de error.
  async function api(method, payload) {
    var res = await fetch(baseUrl + '/session/client-access', {
      method: method,
      headers: headers(),
      body: payload !== undefined ? JSON.stringify(payload) : undefined
    });
    var body = null;
    try { body = await res.json(); } catch (e) { /* sin JSON */ }
    return { ok: res.ok, body: body };
  }

  function errorText(body) {
    return (body && body.error) || 'Error desconocido';
  }

  function formatSince(seconds) {
    if (!seconds) return 'ahora';
    return new Date(seconds * 1000).toLocaleString('es');
  }

  // Pinta el modal según haya o no un acceso creado.
  function render(cfg) {
    current = cfg;
    var configured = !!cfg.Configured;
    $('#caEmpty').toggleClass('hidden', configured);
    $('#caConfigured').toggleClass('hidden', !configured);
    $('#caSave').toggleClass('hidden', !configured);
    if (!configured) return;

    $('#caEnabled').prop('checked', !!cfg.Enabled);
    $('#caToken').val(cfg.Token || '');
    $('#caUrl').text(location.origin + '/client/');
    $('#caContacts').prop('checked', !!cfg.AllowContacts);
    $('#caGroups').prop('checked', !!cfg.AllowGroups);
    $('#caHistory').prop('checked', !!cfg.AllowHistory);
    $('#caHistoryConfig').prop('checked', !!cfg.AllowHistoryConfig);
    $('#caDeleteHistory').prop('checked', !!cfg.AllowDeleteHistory);
    $('#caSince').text(formatSince(cfg.HistorySince));
    refreshSinceBox();
    resetConfirm();
  }

  // El aviso de "solo mensajes nuevos" solo aplica con el historial cerrado.
  function refreshSinceBox() {
    $('#caSinceBox').toggleClass('hidden', $('#caHistory').is(':checked'));
  }

  async function load() {
    try {
      var r = await api('GET');
      if (r.ok && r.body && r.body.data) render(r.body.data);
      else showError('No se cargó el acceso del cliente web: ' + errorText(r.body));
    } catch (e) {
      showError('Error al cargar el acceso del cliente web');
      console.error(e);
    }
  }

  // Envía los cambios y repinta con la respuesta. Devuelve true si salió bien.
  async function send(payload, okMessage) {
    try {
      var r = await api('POST', payload);
      if (r.ok && r.body && r.body.success) {
        render(r.body.data);
        if (okMessage) showSuccess(okMessage);
        return true;
      }
      showError('No se guardó el acceso del cliente web: ' + errorText(r.body));
    } catch (e) {
      showError('Error al guardar el acceso del cliente web');
      console.error(e);
    }
    return false;
  }

  function readPermissions() {
    return {
      Enabled: $('#caEnabled').is(':checked'),
      AllowContacts: $('#caContacts').is(':checked'),
      AllowGroups: $('#caGroups').is(':checked'),
      AllowHistory: $('#caHistory').is(':checked'),
      AllowHistoryConfig: $('#caHistoryConfig').is(':checked'),
      AllowDeleteHistory: $('#caDeleteHistory').is(':checked')
    };
  }

  // Los botones destructivos piden una segunda pulsación (sin diálogos del navegador).
  var confirmTimer = null;
  function resetConfirm() {
    clearTimeout(confirmTimer);
    $('#caRegenerate').text('Generar otro').removeData('armed');
    $('#caRevoke').text('Revocar acceso').removeData('armed');
  }
  function armed($btn, label) {
    if ($btn.data('armed')) return true;
    resetConfirm();
    $btn.data('armed', true).text(label);
    confirmTimer = setTimeout(resetConfirm, 5000);
    return false;
  }

  async function copyToken() {
    var token = $('#caToken').val();
    try {
      await navigator.clipboard.writeText(token);
      showSuccess('Token copiado');
    } catch (e) {
      $('#caToken').trigger('select'); // sin permiso del portapapeles: queda seleccionado
      showError('No se pudo copiar; el token quedó seleccionado');
    }
  }

  async function revoke() {
    try {
      var r = await api('DELETE');
      if (r.ok) {
        showSuccess('Acceso del cliente web revocado');
        render({ Configured: false });
      } else {
        showError('No se revocó el acceso: ' + errorText(r.body));
      }
    } catch (e) {
      showError('Error al revocar el acceso');
      console.error(e);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var widget = document.getElementById('clientAccessConfig');
    if (!widget) return;

    widget.addEventListener('click', function () {
      wspDialog('#modalClientAccess', { alOcultar: resetConfirm }).mostrar();
      load();
    });
    $('#caCreate').on('click', function () { send({}, 'Acceso del cliente web creado'); });
    $('#caSave').on('click', async function () {
      if (await send(readPermissions(), 'Permisos guardados')) $('#modalClientAccess').modal('hide');
    });
    $('#caHistory').on('change', refreshSinceBox);
    $('#caCopy').on('click', copyToken);
    $('#caResetSince').on('click', function () { send({ ResetHistorySince: true }, 'Se ocultó todo lo anterior a ahora'); });
    $('#caRegenerate').on('click', function () {
      if (armed($(this), 'Confirmar: el token anterior dejará de funcionar')) {
        send({ RegenerateToken: true }, 'Token nuevo generado');
      }
    });
    $('#caRevoke').on('click', function () {
      if (armed($(this), 'Confirmar: se borrará el acceso y su token')) revoke();
    });
  });
})();
