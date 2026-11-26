/*
 * guia.js — Navegación y carga de la documentación en /guia.
 *
 * Qué hace: construye el menú lateral, carga el .md que indica el hash de la URL
 * (p. ej. /guia/#/api/chat-envio.md), lo muestra con MiniMd y reescribe los
 * enlaces relativos entre documentos para que naveguen dentro de la página.
 * También ofrece "Copiar para IA" (texto crudo del documento) y el enlace
 * directo al .md, pensado para que una IA lo lea y sepa cómo integrarse.
 * Qué expone: nada global.
 * Depende de: md.js (MiniMd) y de index.html (ids: guia-nav, guia-doc,
 * guia-titulo, guia-copiar, guia-crudo, guia-url-ia).
 * Cómo extender: añadir un documento = copiar el .md a static/guia/ y listarlo en NAV.
 * Limitaciones conocidas: los enlaces con ancla (#seccion) dentro de un documento
 * se ignoran; la ancla se descarta y se abre el documento desde arriba.
 */
(function () {
  'use strict';

  // Menú: grupos con sus documentos. La ruta es relativa a /guia/.
  var NAV = [
    { grupo: 'Empezar', docs: [
      { t: 'Guía para IA y desarrolladores', p: 'api-guia-ia.md' },
      { t: 'Envío pausado (anti-baneo)', p: 'send-queue.md' },
      { t: 'Acceso restringido del cliente web', p: 'client-access.md' },
      { t: 'Modo stdio (JSON-RPC)', p: 'api-stdio.md' }
    ] },
    { grupo: 'Referencia de la API', docs: [
      { t: 'Índice', p: 'api/README.md' },
      { t: 'Sesión', p: 'api/session.md' },
      { t: 'Webhook', p: 'api/webhook.md' },
      { t: 'Enviar mensajes', p: 'api/chat-envio.md' },
      { t: 'Acciones de chat', p: 'api/chat-acciones.md' },
      { t: 'Usuario', p: 'api/usuario.md' },
      { t: 'Grupos', p: 'api/group.md' },
      { t: 'Canales', p: 'api/newsletter.md' },
      { t: 'Etiquetas', p: 'api/labels.md' },
      { t: 'Otros', p: 'api/otros.md' },
      { t: 'Administración', p: 'api/admin.md' }
    ] }
  ];
  var DEFAULT_DOC = 'api-guia-ia.md';

  var elNav = document.getElementById('guia-nav');
  var elDoc = document.getElementById('guia-doc');
  var elTitulo = document.getElementById('guia-titulo');
  var elCopiar = document.getElementById('guia-copiar');
  var elCrudo = document.getElementById('guia-crudo');
  var rawText = '';

  function buildNav() {
    NAV.forEach(function (g) {
      var h = document.createElement('h2');
      h.textContent = g.grupo;
      elNav.appendChild(h);
      g.docs.forEach(function (d) {
        var a = document.createElement('a');
        a.href = '#/' + d.p;
        a.textContent = d.t;
        a.dataset.path = d.p;
        elNav.appendChild(a);
      });
    });
    var sw = document.createElement('a');
    sw.href = '/api';
    sw.textContent = 'Swagger (interactivo)';
    sw.className = 'guia-externo';
    elNav.appendChild(sw);
  }

  // Ruta pedida por el hash; solo se aceptan nombres de la lista para no cargar archivos arbitrarios.
  function currentPath() {
    var p = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('#')[0];
    var known = NAV.some(function (g) { return g.docs.some(function (d) { return d.p === p; }); });
    return known ? p : DEFAULT_DOC;
  }

  // Resuelve un enlace relativo (../x.md, api/y.md) contra el documento actual.
  function resolve(base, href) {
    var parts = base.split('/').slice(0, -1);
    href.split('/').forEach(function (seg) {
      if (seg === '..') parts.pop();
      else if (seg !== '.' && seg !== '') parts.push(seg);
    });
    return parts.join('/');
  }

  function rewriteLinks(base) {
    elDoc.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (/^(https?:|mailto:|#)/.test(href)) {
        if (/^https?:/.test(href)) a.target = '_blank';
        return;
      }
      var file = href.split('#')[0];
      if (/\.md$/.test(file)) a.setAttribute('href', '#/' + resolve(base, file));
    });
  }

  async function load() {
    var path = currentPath();
    elNav.querySelectorAll('a').forEach(function (a) {
      a.classList.toggle('activo', a.dataset.path === path);
    });
    elCrudo.href = path;
    elDoc.textContent = 'Cargando…';
    try {
      var res = await fetch(path);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rawText = await res.text();
      elDoc.innerHTML = MiniMd.render(rawText);
      rewriteLinks(path);
      var h1 = elDoc.querySelector('h1');
      document.title = (h1 ? h1.textContent : 'Documentación') + ' · WspBox';
      elTitulo.textContent = h1 ? h1.textContent : 'Documentación';
      window.scrollTo(0, 0);
    } catch (e) {
      rawText = '';
      elDoc.textContent = 'No se pudo cargar el documento (' + e.message + ').';
    }
  }

  async function copyRaw() {
    if (!rawText) return;
    try {
      await navigator.clipboard.writeText(rawText);
      elCopiar.textContent = 'Copiado';
    } catch (e) {
      elCopiar.textContent = 'No se pudo copiar';
    }
    setTimeout(function () { elCopiar.textContent = 'Copiar para IA'; }, 2000);
  }

  document.getElementById('guia-url-ia').textContent = location.origin + '/guia/api-guia-ia.md';
  elCopiar.addEventListener('click', copyRaw);
  window.addEventListener('hashchange', load);
  buildNav();
  load();
})();
