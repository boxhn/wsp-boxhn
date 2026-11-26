/* ============================================================
   wsp-compat.js · puente jQuery -> BoxUI para el dashboard
   ------------------------------------------------------------
   Qué hace: el JavaScript del dashboard (app.js, groups.js,
     proxypool.js) se escribió contra Fomantic UI. En vez de
     reescribir miles de líneas de lógica, este archivo
     implementa sobre BoxUI los pocos métodos de Fomantic que ese
     código usa, con la misma firma:
       $.toast({class, message})              -> boxToast
       $(el).toast({class, message})          -> boxToast (forma de plugin)
       $(el).modal(opciones | 'show' | 'hide' | 'is active' |
                   'setting', nombre, fn)     -> <dialog> (wsp-dialog.js)
       $(el).dropdown(opciones | 'get value' | 'clear' |
                   'set selected' | 'refresh' |
                   'restore defaults')        -> <select> y .wsp-multiselect
       $(el).checkbox(opciones | 'set checked' | 'set unchecked' |
                   'check' | 'uncheck' | 'is checked')
       $(form).form(opciones | 'reset')       -> validación mínima
   Qué NO hace: no es Fomantic completo. Solo cubre lo que usa el
     dashboard; un método nuevo se añade aquí (ver docs/diseno-ui.md).
   Depende de: jQuery (assets/lib/jquery), box-ui.js (boxToast) y
     wsp-dialog.js. Orden de carga: jquery, box-ui, wsp-dialog,
     wsp-compat y después los scripts de la página.
   Limitaciones conocidas: la validación muestra el primer error
     como toast (Fomantic marcaba cada campo); el multiselect con
     búsqueda es propio y más simple que el de Fomantic.
   ============================================================ */
(function ($) {
    'use strict';

    /* ---------------- toast ---------------- */
    $.toast = function (o) {
        var tipo = o.class === 'error' || o.class === 'warning' || o.class === 'success' ? o.class : 'info';
        boxToast(o.message, tipo, o.title ? { title: o.title } : undefined);
    };

    $.fn.toast = function (o) { $.toast(o); return this; };

    /* ---------------- modal ---------------- */
    function opcionesModal(o) {
        return {
            fijo: o.closable === false,
            alMostrar: o.onVisible || o.onShow,
            alOcultar: o.onHidden,
            alAprobar: o.onApprove,
            alDenegar: o.onDeny
        };
    }

    $.fn.modal = function (a, b, c) {
        if (a === 'is active') {
            return this.length ? wspDialog('#' + this[0].id).abierto() : false;
        }
        return this.each(function () {
            var sel = '#' + this.id;
            if (a === undefined || typeof a === 'object') {
                wspDialog(sel, opcionesModal(a || {}));
            } else if (a === 'show') {
                wspDialog(sel).mostrar();
            } else if (a === 'hide') {
                wspDialog(sel).ocultar();
            } else if (a === 'setting') {
                // $(m).modal('setting', 'onHidden', fn): se fusiona con lo ya guardado
                var dlg = this, prev = dlg._wsp || {};
                var mapa = { onApprove: 'alAprobar', onDeny: 'alDenegar', onHidden: 'alOcultar',
                             onVisible: 'alMostrar', onShow: 'alMostrar' };
                if (mapa[b]) { prev[mapa[b]] = c; wspDialog(sel, prev); }
            }
        });
    };

    /* ---------------- dropdown ---------------- */
    function esMultiselect(el) { return el.classList.contains('wsp-multiselect'); }
    function esSelectMultiple(el) { return el.tagName === 'SELECT' && el.multiple; }

    function valoresSelect(el) {
        if (!el.multiple) return el.value;
        return Array.prototype.filter.call(el.options, function (o) { return o.selected && o.value !== ''; })
            .map(function (o) { return o.value; });
    }

    function avisarCambio(el) {
        var cfg = $(el).data('wspDropdown');
        if (cfg && cfg.onChange) {
            var v = esMultiselect(el) ? el._wspVal.slice() : valoresSelect(el);
            cfg.onChange.call(el, v, '', $());
        }
    }

    /* Multiselect con búsqueda y alta libre (participantes de un grupo) */
    function iniciarMultiselect(el, cfg) {
        if (el._wspIniciado) return;
        el._wspIniciado = true;
        el._wspVal = [];
        el._wspCfg = cfg || {};

        var chips = document.createElement('span');
        chips.className = 'wsp-ms-chips';
        var entrada = document.createElement('input');
        entrada.type = 'text';
        entrada.className = 'wsp-ms-input';
        entrada.setAttribute('aria-label', 'Buscar o escribir un número');
        el.insertBefore(chips, el.firstChild);
        el.insertBefore(entrada, el.querySelector('.menu'));
        el._wspChips = chips;
        el._wspEntrada = entrada;

        el.addEventListener('click', function (e) {
            var item = e.target.closest('.menu .item');
            if (item && !item.classList.contains('disabled')) {
                alternarValor(el, item.getAttribute('data-value'));
                return;
            }
            var quitar = e.target.closest('[data-wsp-quitar]');
            if (quitar) { alternarValor(el, quitar.getAttribute('data-wsp-quitar')); return; }
            el.classList.add('wsp-abierto');
            entrada.focus();
        });
        entrada.addEventListener('input', function () { filtrarMenu(el); });
        entrada.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var v = entrada.value.trim();
                if (v && el._wspCfg.allowAdditions && el._wspVal.indexOf(v) < 0) {
                    el._wspVal.push(v);
                    entrada.value = '';
                    dibujarMultiselect(el);
                    avisarCambio(el);
                }
            }
        });
        document.addEventListener('click', function (e) {
            if (!el.contains(e.target)) el.classList.remove('wsp-abierto');
        });
        dibujarMultiselect(el);
    }

    function alternarValor(el, v) {
        var i = el._wspVal.indexOf(v);
        if (i >= 0) el._wspVal.splice(i, 1); else el._wspVal.push(v);
        dibujarMultiselect(el);
        avisarCambio(el);
    }

    function textoDeItem(el, v) {
        var it = el.querySelector('.menu .item[data-value="' + String(v).replace(/"/g, '\\"') + '"]');
        return it ? it.textContent : v;
    }

    function filtrarMenu(el) {
        var q = el._wspEntrada.value.trim().toLowerCase();
        el.querySelectorAll('.menu .item').forEach(function (it) {
            it.style.display = !q || it.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
        });
    }

    function dibujarMultiselect(el) {
        el._wspChips.innerHTML = '';
        el._wspVal.forEach(function (v) {
            var chip = document.createElement('span');
            chip.className = 'box-badge box-badge-primary wsp-ms-chip';
            chip.textContent = textoDeItem(el, v) + ' ';
            var x = document.createElement('button');
            x.type = 'button';
            x.className = 'wsp-ms-quitar';
            x.setAttribute('data-wsp-quitar', v);
            x.setAttribute('aria-label', 'Quitar');
            x.innerHTML = '&times;';
            chip.appendChild(x);
            el._wspChips.appendChild(chip);
        });
        var oculto = el.querySelector('input[type="hidden"]');
        if (oculto) oculto.value = el._wspVal.join(',');
        var marcador = el.querySelector('.default.text');
        if (marcador) marcador.style.display = el._wspVal.length ? 'none' : '';
        el.querySelectorAll('.menu .item').forEach(function (it) {
            it.classList.toggle('active', el._wspVal.indexOf(it.getAttribute('data-value')) >= 0);
        });
    }

    $.fn.dropdown = function (a, b) {
        if (a === 'get value') {
            var el0 = this[0];
            if (!el0) return '';
            return esMultiselect(el0) ? el0._wspVal.slice() : valoresSelect(el0);
        }
        return this.each(function () {
            var el = this;
            if (a === undefined || typeof a === 'object') {
                var cfg = a || {};
                var previo = $(el).data('wspDropdown');
                $(el).data('wspDropdown', cfg);
                if (esMultiselect(el)) iniciarMultiselect(el, cfg);
                else if (!previo && cfg.onChange) {
                    el.addEventListener('change', function () { avisarCambio(el); });
                }
                return;
            }
            if (esMultiselect(el) && !el._wspIniciado) iniciarMultiselect(el, {});

            if (a === 'clear') {
                if (esMultiselect(el)) { el._wspVal = []; dibujarMultiselect(el); }
                else if (el.multiple) { Array.prototype.forEach.call(el.options, function (o) { o.selected = false; }); }
                else el.selectedIndex = el.querySelector('option[value=""]') ? 0 : -1;
                avisarCambio(el);
            } else if (a === 'set selected') {
                var vals = [].concat(b);
                if (esMultiselect(el)) {
                    vals.forEach(function (v) { v = String(v); if (el._wspVal.indexOf(v) < 0) el._wspVal.push(v); });
                    dibujarMultiselect(el);
                } else if (el.multiple) {
                    Array.prototype.forEach.call(el.options, function (o) {
                        if (vals.map(String).indexOf(o.value) >= 0) o.selected = true;
                    });
                } else {
                    el.value = String(vals[0]);
                }
                avisarCambio(el);
            } else if (a === 'refresh') {
                if (esMultiselect(el)) dibujarMultiselect(el);
            } else if (a === 'restore defaults') {
                if (esMultiselect(el)) { el._wspVal = []; dibujarMultiselect(el); }
                else if (el.multiple) { Array.prototype.forEach.call(el.options, function (o) { o.selected = false; }); }
                else {
                    var def = el.querySelector('option[selected]') || el.options[0];
                    if (def) el.value = def.value;
                }
            }
        });
    };

    /* ---------------- checkbox ---------------- */
    function entradaCheckbox(el) {
        return el.tagName === 'INPUT' ? el : el.querySelector('input[type="checkbox"]');
    }

    $.fn.checkbox = function (a) {
        if (a === 'is checked') {
            var i0 = this.length && entradaCheckbox(this[0]);
            return !!(i0 && i0.checked);
        }
        return this.each(function () {
            var input = entradaCheckbox(this);
            if (!input) return;
            if (a === undefined || typeof a === 'object') {
                var cfg = a || {};
                if (this._wspCheckbox) return;
                this._wspCheckbox = true;
                input.addEventListener('change', function () {
                    if (cfg.onChange) cfg.onChange.call(input);
                    if (input.checked && cfg.onChecked) cfg.onChecked.call(input);
                    if (!input.checked && cfg.onUnchecked) cfg.onUnchecked.call(input);
                });
                return;
            }
            var marcar = null;
            if (a === 'set checked' || a === 'check') marcar = true;
            else if (a === 'set unchecked' || a === 'uncheck') marcar = false;
            else if (a === 'toggle') marcar = !input.checked;
            if (marcar !== null && input.checked !== marcar) {
                input.checked = marcar;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    /* ---------------- form (validación mínima) ---------------- */
    function valoresFormulario(form) {
        var out = {};
        Array.prototype.forEach.call(form.elements, function (el) {
            if (!el.name) return;
            if (el.type === 'checkbox') { if (el.checked) out[el.name] = 'on'; }
            else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
            else if (el.tagName === 'SELECT' && el.multiple) out[el.name] = valoresSelect(el);
            else out[el.name] = el.value;
        });
        form.querySelectorAll('.wsp-multiselect').forEach(function (ms) {
            var oculto = ms.querySelector('input[type="hidden"][name]');
            if (oculto && ms._wspVal) out[oculto.name] = ms._wspVal.slice();
        });
        return out;
    }

    function vacio(v) { return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0); }

    function cumple(regla, v) {
        var t = regla.type;
        if (t === 'empty') return !vacio(v);
        if (t === 'url') { try { new URL(v); return true; } catch (e) { return false; } }
        var m;
        if ((m = /^integer\[(-?\d*)\.\.(-?\d*)\]$/.exec(t))) {
            if (!/^-?\d+$/.test(String(v))) return false;
            var n = parseInt(v, 10);
            return (m[1] === '' || n >= +m[1]) && (m[2] === '' || n <= +m[2]);
        }
        if (t.indexOf('regExp[') === 0) {
            return new RegExp(t.slice(7, t.lastIndexOf(']'))).test(String(v));
        }
        return true;
    }

    function validar(cfg, valores) {
        var campos = cfg.fields || {};
        for (var k in campos) {
            var def = campos[k];
            var v = valores[def.identifier || k];
            if (def.optional && vacio(v)) continue;
            for (var i = 0; i < (def.rules || []).length; i++) {
                if (!cumple(def.rules[i], v)) return def.rules[i].prompt || 'Revisa los campos del formulario';
            }
        }
        return null;
    }

    $.fn.form = function (a) {
        return this.each(function () {
            var form = this;
            if (a === 'reset') {
                form.reset();
                form.querySelectorAll('.wsp-multiselect').forEach(function (ms) {
                    if (ms._wspVal) { ms._wspVal = []; dibujarMultiselect(ms); }
                });
                return;
            }
            if (a === undefined || typeof a === 'object') {
                var cfg = a || {};
                $(form).off('submit.wspform').on('submit.wspform', function (e) {
                    var valores = valoresFormulario(form);
                    var error = validar(cfg, valores);
                    if (error) {
                        e.preventDefault();
                        if (cfg.onFailure) cfg.onFailure.call(form, [error], valores);
                        else boxToast(error, 'error');
                        return;
                    }
                    if (cfg.onSuccess) cfg.onSuccess.call(form, e, valores);
                });
            }
        });
    };
})(jQuery);
