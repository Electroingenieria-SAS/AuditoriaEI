// =====================================================
// SISTEMA DE NOTIFICACIONES PREMIUM - AISLADO POR USUARIO
// =====================================================

(function(){

  const MAX_HISTORIAL = 50;

  const ICONOS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const TITULOS_DEFECTO = {
    success: '¡Listo!',
    error: 'Ocurrió un error',
    warning: 'Atención',
    info: 'Información'
  };

  const DURACION_MS = 4200;

  // 1. OBTENER IDENTIFICADOR ÚNICO DEL USUARIO ACTUAL
  function obtenerClaveUsuario() {
    let usuarioActual = 'invitado';
    try {
      if (window.usuarioLogueado && window.usuarioLogueado.usuario) {
        usuarioActual = String(window.usuarioLogueado.usuario).toLowerCase().trim();
      } else {
        const sesion = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
        if (sesion.usuario) {
          usuarioActual = String(sesion.usuario).toLowerCase().trim();
        }
      }
    } catch {
      usuarioActual = 'invitado';
    }
    return `notificaciones_${usuarioActual}`;
  }

  // 2. MOTOR DE AUDIO NATIVO
  let audioCtx = null;

  function reproducirSonidoNotificacion(tipo = 'info') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const ahora = audioCtx.currentTime;
      const configSonido = {
        success: [
          { f: 523.25, d: 0.08, t: 0 },
          { f: 659.25, d: 0.12, t: 0.08 },
          { f: 1046.50, d: 0.25, t: 0.18 }
        ],
        warning: [
          { f: 440.00, d: 0.12, t: 0 },
          { f: 554.37, d: 0.20, t: 0.10 }
        ],
        error: [
          { f: 311.13, d: 0.15, t: 0 },
          { f: 233.08, d: 0.28, t: 0.12 }
        ],
        info: [
          { f: 587.33, d: 0.09, t: 0 },
          { f: 880.00, d: 0.18, t: 0.08 }
        ]
      };

      const notas = configSonido[tipo] || configSonido.info;
      notas.forEach(nota => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = tipo === 'error' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(nota.f, ahora + nota.t);

        gain.gain.setValueAtTime(0.001, ahora + nota.t);
        gain.gain.exponentialRampToValueAtTime(0.18, ahora + nota.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ahora + nota.t + nota.d);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(ahora + nota.t);
        osc.stop(ahora + nota.t + nota.d);
      });
    } catch (e) {
      console.warn('Audio no disponible:', e);
    }
  }

  // 3. INYECTAR CONTENEDORES
  function asegurarContenedores(){
    if(!document.getElementById('notifStack')){
      const stack = document.createElement('div');
      stack.id = 'notifStack';
      document.body.appendChild(stack);
    }

    if(!document.getElementById('notifModalOverlay')){
      const overlay = document.createElement('div');
      overlay.id = 'notifModalOverlay';
      overlay.innerHTML =
        '<div class="notif-modal-box" id="notifModalBox">' +
          '<div class="notif-modal-icono" id="notifModalIcono">❓</div>' +
          '<h2 id="notifModalTitulo">Confirmar</h2>' +
          '<p id="notifModalMensaje"></p>' +
          '<div id="notifModalCampoWrap"></div>' +
          '<div class="notif-modal-botones">' +
            '<button class="notif-btn-cancelar" id="notifBtnCancelar" type="button">Cancelar</button>' +
            '<button class="notif-btn-aceptar" id="notifBtnAceptar" type="button">Aceptar</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
    }
  }

  // 4. PERSISTENCIA INDEPENDIENTE POR USUARIO
  function obtenerHistorial(){
    try {
      const key = obtenerClaveUsuario();
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function guardarHistorial(lista){
    try {
      const key = obtenerClaveUsuario();
      localStorage.setItem(key, JSON.stringify(lista.slice(0, MAX_HISTORIAL)));
    } catch(e) {
      console.warn('No se pudo guardar el historial:', e);
    }
  }

  window.actualizarContadorCampana = function(){
    const contador = document.getElementById('contadorNotificaciones') || document.getElementById('notificacionesCount');
    if(!contador) return;

    const lista = obtenerHistorial();
    const noLeidas = lista.filter(n => !n.leida).length;

    contador.innerText = noLeidas;
    contador.style.display = noLeidas > 0 ? 'inline-flex' : 'none';
  };

  // 5. TOAST VISUAL
  function toast(tipo, mensaje, titulo){
    asegurarContenedores();
    reproducirSonidoNotificacion(tipo);

    const stack = document.getElementById('notifStack');
    if(!stack) return;

    const el = document.createElement('div');
    el.className = 'notif-toast notif-' + tipo;
    el.innerHTML =
      '<div class="notif-icono">' + (ICONOS[tipo] || 'ℹ️') + '</div>' +
      '<div class="notif-texto">' +
        '<div class="notif-titulo">' + (titulo || TITULOS_DEFECTO[tipo] || 'Notificación') + '</div>' +
        '<div class="notif-mensaje"></div>' +
      '</div>' +
      '<button class="notif-cerrar" type="button">✕</button>' +
      '<div class="notif-barra" style="animation-duration:' + DURACION_MS + 'ms"></div>';

    el.querySelector('.notif-mensaje').innerText = mensaje || '';
    stack.appendChild(el);

    function cerrar(){
      el.classList.add('notif-out');
      setTimeout(function(){
        if(el.parentNode) el.parentNode.removeChild(el);
      }, 350);
    }

    el.querySelector('.notif-cerrar').addEventListener('click', cerrar);
    const timeoutId = setTimeout(cerrar, DURACION_MS);

    el.addEventListener('mouseenter', function(){
      clearTimeout(timeoutId);
      const barra = el.querySelector('.notif-barra');
      if(barra) barra.style.animationPlayState = 'paused';
    });
  }

  // 6. CREAR NOTIFICACIÓN (PUENTE GLOBAL)
  window.crearNotificacion = function(mensaje, tipo, titulo){
    tipo = tipo || 'info';
    titulo = titulo || (tipo === 'success' ? 'Éxito' : tipo === 'error' ? 'Error' : 'Notificación del Sistema');

    try {
      const lista = obtenerHistorial();
      const nueva = {
        id: Date.now(),
        titulo: titulo,
        mensaje: String(mensaje || ''),
        tipo: tipo,
        leida: false,
        fecha: new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      };

      lista.unshift(nueva);
      guardarHistorial(lista);
      window.actualizarContadorCampana();

      if(typeof window.renderNotificaciones === 'function'){
        window.renderNotificaciones();
      }

      window.dispatchEvent(new CustomEvent('nuevaNotificacion', { detail: nueva }));
    } catch(err) {
      console.error('Error registrando notificación:', err);
    }

    toast(tipo, mensaje, titulo);
  };

  // 7. MARCAR COMO LEÍDA UNA O TODAS (SOLO PARA EL USUARIO ACTUAL)
  window.marcarNotificacionLeida = function(id) {
    const lista = obtenerHistorial();
    const actualizada = lista.map(n => n.id === id ? { ...n, leida: true } : n);
    guardarHistorial(actualizada);
    window.actualizarContadorCampana();
    if(typeof window.renderNotificaciones === 'function') window.renderNotificaciones();
  };

  window.marcarTodasNotificacionesLeidas = function() {
    const lista = obtenerHistorial();
    const actualizada = lista.map(n => ({ ...n, leida: true }));
    guardarHistorial(actualizada);
    window.actualizarContadorCampana();
    if(typeof window.renderNotificaciones === 'function') window.renderNotificaciones();
  };

  // 8. RENDERIZADO DEL PANEL DESPLEGABLE DE NOTIFICACIONES
  window.renderNotificaciones = function () {
    const contenedor = document.getElementById('listaNotificaciones') || document.getElementById('notificacionesBody');
    if (!contenedor) return;

    const lista = obtenerHistorial();
    if (lista.length === 0) {
      contenedor.innerHTML = `<div style="text-align:center; padding:24px; color:#94a3b8; font-size:12px;">No tienes notificaciones registradas.</div>`;
      return;
    }

    contenedor.innerHTML = lista.map(n => `
      <div onclick="window.marcarNotificacionLeida(${n.id})" style="padding:12px 14px; border-bottom:1px solid #f1f5f9; background:${n.leida ? '#ffffff' : '#f0f9ff'}; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition:background 0.2s;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:12.5px; color:#0f172a;">${n.titulo}</strong>
          <span style="font-size:10.5px; color:#94a3b8;">${n.fecha}</span>
        </div>
        <p style="margin:0; font-size:12px; color:#475569; line-height:1.4;">${n.mensaje}</p>
      </div>
    `).join('');
  };

  // 9. API PÚBLICA MODALES (CONFIRM / PROMPT)
  window.Notif = {
    success: function(m, t){ toast('success', m, t); },
    error:   function(m, t){ toast('error', m, t); },
    warning: function(m, t){ toast('warning', m, t); },
    info:    function(m, t){ toast('info', m, t); },

    confirm: function(mensaje, titulo){
      asegurarContenedores();
      reproducirSonidoNotificacion('warning');
      return new Promise(resolve => {
        const overlay = document.getElementById('notifModalOverlay');
        const box = document.getElementById('notifModalBox');
        box.style.setProperty('--notif-color', '#ef4444');
        box.style.setProperty('--notif-bg', '#fef2f2');

        document.getElementById('notifModalIcono').innerText = '⚠️';
        document.getElementById('notifModalTitulo').innerText = titulo || '¿Confirmar acción?';
        document.getElementById('notifModalMensaje').innerText = mensaje || '';
        document.getElementById('notifModalCampoWrap').innerHTML = '';

        const btnCancel = document.getElementById('notifBtnCancelar');
        const btnOk = document.getElementById('notifBtnAceptar');
        btnCancel.style.display = 'inline-block';
        btnCancel.innerText = 'Cancelar';
        btnOk.innerText = 'Continuar';

        overlay.classList.add('active');

        function limpiar() {
          overlay.classList.remove('active');
          btnOk.removeEventListener('click', onOk);
          btnCancel.removeEventListener('click', onCancel);
        }
        function onOk() { limpiar(); resolve(true); }
        function onCancel() { limpiar(); resolve(false); }

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
      });
    },

    prompt: function(mensaje, titulo, valorInicial, opciones){
      asegurarContenedores();
      return new Promise(resolve => {
        const overlay = document.getElementById('notifModalOverlay');
        const box = document.getElementById('notifModalBox');
        box.style.setProperty('--notif-color', '#2563eb');
        box.style.setProperty('--notif-bg', '#eff6ff');

        document.getElementById('notifModalIcono').innerText = '✏️';
        document.getElementById('notifModalTitulo').innerText = titulo || 'Ingreso de datos';
        document.getElementById('notifModalMensaje').innerText = mensaje || '';

        const wrap = document.getElementById('notifModalCampoWrap');
        wrap.innerHTML = '';

        let input;
        if(opciones && Array.isArray(opciones)) {
          input = document.createElement('select');
          opciones.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op;
            opt.innerText = op;
            if(op === valorInicial) opt.selected = true;
            input.appendChild(opt);
          });
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.value = valorInicial || '';
        }
        wrap.appendChild(input);

        const btnCancel = document.getElementById('notifBtnCancelar');
        const btnOk = document.getElementById('notifBtnAceptar');
        btnCancel.style.display = 'inline-block';
        btnOk.innerText = 'Guardar';

        overlay.classList.add('active');
        setTimeout(() => input.focus(), 100);

        function limpiar() {
          overlay.classList.remove('active');
          btnOk.removeEventListener('click', onOk);
          btnCancel.removeEventListener('click', onCancel);
        }
        function onOk() { const val = input.value; limpiar(); resolve(val); }
        function onCancel() { limpiar(); resolve(null); }

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
      });
    }
  };

  window.notifAlert = function(m){
    const t = String(m).toLowerCase();
    const tipo = t.includes('error') || t.includes('no se pudo') ? 'error' : t.includes('correct') || t.includes('éxito') ? 'success' : 'warning';
    toast(tipo, m);
  };

  window.mostrarNotificacion = function(t, m, tipo){
    toast(tipo || 'info', m, t);
  };

  // Inicializar estado del usuario actual
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      asegurarContenedores();
      window.actualizarContadorCampana();
    });
  } else {
    asegurarContenedores();
    window.actualizarContadorCampana();
  }

})();
