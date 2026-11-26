/*
 * sendqueue.js — Dashboard: configuración y vista de la cola de envío pausado.
 *
 * Qué hace: abre el modal "Envío pausado" desde el widget #sendQueueConfig,
 * carga y guarda la política de ritmo (GET/POST /session/sendqueue/config) y
 * lista/cancela mensajes en cola (GET /chat/queue, DELETE /chat/queue/{id}).
 * Qué expone: nada global; solo engancha eventos al cargar la página.
 * Depende de: jQuery y el shim de modales (wsp-compat.js), y de las funciones
 * globales de app.js: baseUrl, getLocalStorageItem, showError, showSuccess.
 * Orden de carga: después de app.js (ver index.html).
 * Documentación: docs/send-queue.md.
 *
 * Nota: estos endpoints responden con el sobre estándar
 * {"code":..,"data":{..},"success":true}; el dato útil viene en `data`.
 */
(function () {
  'use strict';

  var STATUS_CLASS = { sent: 'positive', failed: 'negative', cancelled: 'secondary' };

  // Cabeceras con el token del usuario conectado (igual que el resto del dashboard).
  function authHeaders(withJson) {
    var h = new Headers();
    h.append('token', getLocalStorageItem('token'));
    if (withJson) h.append('Content-Type', 'application/json');
    return h;
  }

  // Llama a la API y devuelve {ok, body}; nunca lanza por respuestas HTTP de error.
  async function api(method, path, payload) {
    var res = await fetch(baseUrl + path, {
      method: method,
      headers: authHeaders(payload !== undefined),
      body: payload !== undefined ? JSON.stringify(payload) : undefined
    });
    var body = null;
    try { body = await res.json(); } catch (e) { /* respuesta sin JSON */ }
    return { ok: res.ok, body: body };
  }

  function errorText(body) {
    return (body && (body.error || body.Details)) || 'Error desconocido';
  }

  // ---- Política de ritmo ----

  function fillForm(cfg) {
    $('#sqEnabled').prop('checked', !!cfg.Enabled);
    $('#sqPaused').prop('checked', !!cfg.Paused);
    $('#sqBatchSize').val(cfg.BatchSize);
    $('#sqHourlyCap').val(cfg.HourlyCap);
    $('#sqMsgDelayMin').val(cfg.MsgDelayMin);
    $('#sqMsgDelayMax').val(cfg.MsgDelayMax);
    $('#sqBatchPauseMin').val(cfg.BatchPauseMin);
    $('#sqBatchPauseMax').val(cfg.BatchPauseMax);
  }

  function readForm() {
    var num = function (id) { return parseInt($(id).val(), 10); };
    return {
      Enabled: $('#sqEnabled').is(':checked'),
      Paused: $('#sqPaused').is(':checked'),
      BatchSize: num('#sqBatchSize'),
      HourlyCap: num('#sqHourlyCap'),
      MsgDelayMin: num('#sqMsgDelayMin'),
      MsgDelayMax: num('#sqMsgDelayMax'),
      BatchPauseMin: num('#sqBatchPauseMin'),
      BatchPauseMax: num('#sqBatchPauseMax')
    };
  }

  async function loadConfig() {
    try {
      var r = await api('GET', '/session/sendqueue/config');
      if (r.ok && r.body && r.body.data) fillForm(r.body.data);
      else showError('No se cargaron los ajustes del envío pausado: ' + errorText(r.body));
    } catch (e) {
      showError('Error al cargar los ajustes del envío pausado');
      console.error(e);
    }
  }

  async function saveConfig() {
    var cfg = readForm();
    // Validación en cliente para dar un mensaje claro; el servidor vuelve a validar.
    if ([cfg.BatchSize, cfg.HourlyCap, cfg.MsgDelayMin, cfg.MsgDelayMax, cfg.BatchPauseMin, cfg.BatchPauseMax].some(isNaN)) {
      showError('Todos los campos numéricos son obligatorios');
      return;
    }
    if (cfg.MsgDelayMax < cfg.MsgDelayMin || cfg.BatchPauseMax < cfg.BatchPauseMin) {
      showError('La pausa máxima debe ser mayor o igual a la mínima');
      return;
    }
    try {
      var r = await api('POST', '/session/sendqueue/config', cfg);
      if (r.ok && r.body && r.body.success) {
        showSuccess('Ajustes del envío pausado guardados');
        $('#modalSendQueue').modal('hide');
      } else {
        showError('No se guardaron los ajustes: ' + errorText(r.body));
      }
    } catch (e) {
      showError('Error al guardar los ajustes del envío pausado');
      console.error(e);
    }
  }

  // ---- Lista de mensajes en cola ----

  function cell(text) {
    var td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function renderRows(items) {
    var body = document.getElementById('sq-body');
    body.textContent = '';
    if (!items.length) {
      var tr = document.createElement('tr');
      var td = cell('No hay mensajes');
      td.colSpan = 6;
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    items.forEach(function (it) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(new Date(it.CreatedAt * 1000).toLocaleString()));
      tr.appendChild(cell(String(it.Path).split('/').pop()));
      var st = cell(it.Status);
      st.className = STATUS_CLASS[it.Status] || '';
      if (it.Result) st.title = it.Result; // detalle del error, si lo hay
      tr.appendChild(st);
      tr.appendChild(cell(String(it.Attempts)));
      tr.appendChild(cell(it.MessageId || ''));
      var actions = document.createElement('td');
      if (it.Status === 'pending') {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'box-btn box-btn-danger';
        btn.textContent = 'Cancelar';
        btn.addEventListener('click', function () { cancelItem(it.QueueId); });
        actions.appendChild(btn);
      }
      tr.appendChild(actions);
      body.appendChild(tr);
    });
  }

  async function loadQueue() {
    var status = $('#sqStatusFilter').val();
    var query = '?limit=100' + (status ? '&status=' + encodeURIComponent(status) : '');
    try {
      var r = await api('GET', '/chat/queue' + query);
      if (r.ok && r.body && Array.isArray(r.body.data)) renderRows(r.body.data);
      else showError('No se cargó la cola: ' + errorText(r.body));
    } catch (e) {
      showError('Error al cargar la cola');
      console.error(e);
    }
  }

  async function cancelItem(id) {
    try {
      var r = await api('DELETE', '/chat/queue/' + encodeURIComponent(id));
      if (r.ok) {
        showSuccess('Mensaje cancelado');
        loadQueue();
      } else {
        showError('No se pudo cancelar: ' + errorText(r.body));
      }
    } catch (e) {
      showError('Error al cancelar el mensaje');
      console.error(e);
    }
  }

  // ---- Enganche de eventos ----

  document.addEventListener('DOMContentLoaded', function () {
    var widget = document.getElementById('sendQueueConfig');
    if (!widget) return;
    widget.addEventListener('click', function () {
      $('#modalSendQueue').modal({
        onApprove: function () { saveConfig(); return false; }
      }).modal('show');
      loadConfig();
      loadQueue();
    });
    document.getElementById('sqRefresh').addEventListener('click', loadQueue);
    document.getElementById('sqStatusFilter').addEventListener('change', loadQueue);
  });
})();
