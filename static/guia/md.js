/*
 * md.js — Renderizador mínimo de Markdown a HTML para la documentación (/guia).
 *
 * Qué hace: convierte el subconjunto de Markdown que usan los .md de static/guia:
 * títulos, párrafos, tablas, listas (con anidación), bloques de código con
 * ``` , citas con >, **negrita**, *cursiva*, `código`, enlaces y <br>.
 * Qué expone: window.MiniMd.render(texto) -> string HTML.
 * Depende de: nada (sin librerías ni CDN).
 * Se usa desde: static/guia/guia.js. Documentación: docs/guia-documentacion.md.
 *
 * Seguridad: todo el texto se escapa antes de generar etiquetas; solo se
 * reconstruyen <br> y los enlaces (se bloquean los esquemas javascript:).
 * Limitaciones conocidas: no soporta imágenes, HTML embebido, listas de tareas
 * ni notas al pie. Si un documento nuevo las necesita, añadirlas aquí.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Formato en línea. El código se aparta primero para que su contenido no se interprete.
  function inline(text) {
    var codes = [];
    text = text.replace(/`([^`]+)`/g, function (m, c) {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    text = esc(text);
    text = text.replace(/&lt;br\s*\/?&gt;/g, '<br>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*\w])\*([^*\s][^*]*[^*\s]|[^*\s])\*(?![*\w])/g, '$1<em>$2</em>');
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      if (/^\s*javascript:/i.test(url)) return label;
      return '<a href="' + url + '">' + label + '</a>';
    });
    return text.replace(/\u0000(\d+)\u0000/g, function (m, i) {
      return '<code>' + esc(codes[i]) + '</code>';
    });
  }

  // Divide una fila de tabla en celdas ignorando "|" dentro de `código` o escapados (\|).
  function splitRow(line) {
    var cells = [], cur = '', inCode = false;
    line = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue; }
      if (ch === '`') inCode = !inCode;
      if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  var RE_LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
  var RE_TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

  function renderList(items) {
    var out = '', stack = [];
    items.forEach(function (it) {
      var tag = /\d/.test(it.marker) ? 'ol' : 'ul';
      while (stack.length && stack[stack.length - 1].indent > it.indent) {
        out += '</li></' + stack.pop().tag + '>';
      }
      if (!stack.length || it.indent > stack[stack.length - 1].indent) {
        out += '<' + tag + '>';
        stack.push({ indent: it.indent, tag: tag });
      } else {
        out += '</li>';
      }
      out += '<li>' + inline(it.text);
    });
    while (stack.length) out += '</li></' + stack.pop().tag + '>';
    return out;
  }

  function render(md) {
    var lines = md.replace(/\r\n?/g, '\n').split('\n');
    var html = '', i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (/^\s*$/.test(line)) { i++; continue; }

      // Bloque de código con vallas ```
      var fence = line.match(/^\s*```\s*([\w-]*)/);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
        i++; // cierra la valla
        html += '<pre><code' + (fence[1] ? ' class="lang-' + esc(fence[1]) + '"' : '') + '>' + esc(code.join('\n')) + '</code></pre>';
        continue;
      }

      // Título
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        html += '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>';
        i++;
        continue;
      }

      // Tabla: fila de cabecera seguida de la fila separadora
      if (/^\s*\|/.test(line) && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var rows = '';
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows += '<tr>' + splitRow(lines[i]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        html += '<div class="guia-tabla"><table><thead><tr>' +
          head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        continue;
      }

      // Cita
      if (/^\s*>/.test(line)) {
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
        html += '<blockquote>' + render(quote.join('\n')) + '</blockquote>';
        continue;
      }

      // Lista (las líneas con sangría que no son viñeta continúan el elemento anterior)
      if (RE_LIST.test(line)) {
        var items = [];
        while (i < lines.length) {
          var m = lines[i].match(RE_LIST);
          if (m) {
            items.push({ indent: m[1].length, marker: m[2], text: m[3] });
          } else if (/^\s+\S/.test(lines[i]) && items.length) {
            items[items.length - 1].text += ' ' + lines[i].trim();
          } else break;
          i++;
        }
        html += renderList(items);
        continue;
      }

      // Párrafo: líneas consecutivas que no son otro bloque
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*```/.test(lines[i]) &&
             !/^#{1,6}\s/.test(lines[i]) && !RE_LIST.test(lines[i]) && !/^\s*>/.test(lines[i]) &&
             !(/^\s*\|/.test(lines[i]) && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]))) {
        para.push(lines[i++].trim());
      }
      html += '<p>' + inline(para.join(' ')) + '</p>';
    }
    return html;
  }

  global.MiniMd = { render: render };
})(window);
