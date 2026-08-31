// =====================================================
// SISTEMA DE NOTIFICACIONES PREMIUM - GLOBAL (CON SONIDO)
// =====================================================

(function(){

  const STORAGE_KEY = 'notificaciones';
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

  // ===================================================
  // 1. MOTOR DE AUDIO NATIVO (WEB AUDIO API)
  // ===================================================
  let audioCtx = null;

  function reproducirSonidoNotificacion(tipo = 'info') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioCtx) {
        audioCtx = new AudioContext();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const ahora = audioCtx.currentTime;

      // Configuraciones armónicas según el tipo de alerta
      const configSonido = {
        success: [
          { f: 523.25, d: 0.08, t: 0 },     // C5
          { f: 659.25, d: 0.12, t: 0.08 },  // E5
          { f: 1046.50, d: 0.25, t: 0.18 }  // C6 (Tono brillante de éxito)
        ],
        warning: [
          { f: 440.00, d: 0.12, t: 0 },     // A4
          { f: 554.37, d: 0.20, t: 0.10 }   // C#5
        ],
        error: [
          { f: 311.13, d: 0.15, t: 0 },     // Eb4
          { f: 233.08, d: 0.28, t: 0.12 }   // Bb3 (Tono grave de advertencia)
        ],
        info: [
          { f: 587.33, d: 0.09, t: 0 },     // D5
          { f: 880.00, d: 0.18, t: 0.08 }   // A5 (Campana moderna)
        ]
      };

      const notas = configSonido[tipo] || configSonido.info;

      notas.forEach(nota => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = tipo === 'error' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(nota.f, ahora + nota.t);

        // Curva de volumen suave (Fade In / Fade Out)
        gain.gain.setValueAtTime(0.001, ahora + nota.t);
        gain.gain.exponentialRampToValueAtTime(0.18, ahora + nota.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ahora + nota.t + nota.d);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(ahora + nota.t);
        osc.stop(ahora + nota.t + nota.d);
      });

    } catch (e) {
      console.warn('El navegador restringió la reproducción de audio automática:', e);
    }
  }

  // ===================================================
  // 2. INYECTAR CONTENEDORES SI NO EXISTEN
  // ===================================================
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

    if(!document.getElementById('notifPremiumCSS')){
      const link = document.createElement('link');
      link.id = 'notifPremiumCSS';
      link.rel = 'stylesheet';

      const enSubcarpeta = window.location.pathname.includes('/modules/');
      link.href = (enSubcarpeta ? '../css/' : 'css/') + 'notificaciones-premium.css';

      document.head.appendChild(link);
    }
  }

  // ===================================================
  // 3. PERSISTENCIA EN LOCALSTORAGE & CAMPANA ERP
  // ===================================================
  function obtenerHistorial(){
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function guardarHistorial(lista){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista.slice(0, MAX_HISTORIAL)));
    } catch(e) {
      console.warn('No se pudo guardar el historial de notificaciones:', e);
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

  // ===================================================
  // 4. TOAST VISUAL + AUDIO
  // ===================================================
  function toast(tipo, mensaje, titulo){
    asegurarContenedores();

    // Disparar sonido según el tipo
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
        if(el.parentNode){
          el.parentNode.removeChild(el);
        }
      }, 350);
    }

    el.querySelector('.notif-cerrar').addEventListener('click', cerrar);

    const timeoutId = setTimeout(cerrar, DURACION_MS);

    el.addEventListener('mouseenter', function(){
      clearTimeout(timeoutId);
      const barra = el.querySelector('.notif-barra');
      if(barra){ barra.style.animationPlayState = 'paused'; }
    });
  }

  // ===================================================
  // 5. CREAR NOTIFICACIÓN (PUENTE CAMPANA + TOAST + AUDIO)
  // ===================================================
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

    // Disparar toast y sonido
    toast(tipo, mensaje, titulo);
  };

  // ===================================================
  // 6. MODALES BASE (CONFIRM & PROMPT)
  // ===================================================
  function abrirModal(config){
    asegurarContenedores();
    reproducirSonidoNotificacion('warning');

    return new Promise(function(resolve){
      const overlay = document.getElementById('notifModalOverlay');
      const icono = document.getElementById('notifModalIcono');
      const titulo = document.getElementById('notifModalTitulo');
      const mensaje = document.getElementById('notifModalMensaje');
      const campoWrap = document.getElementById('notifModalCampoWrap');
      const btnCancelar = document.getElementById('notifBtnCancelar');
      const btnAceptar = document.getElementById('notifBtnAceptar');
      const box = document.getElementById('notifModalBox');

      box.style.setProperty('--notif-color', config.color || '#2563eb');
      box.style.setProperty('--notif-bg', config.bg || '#eff6ff');

      icono.innerText = config.icono || '❓';
      titulo.innerText = config.titulo || 'Confirmar';
      mensaje.innerText = config.mensaje || '';

      campoWrap.innerHTML = '';

      let campo = null;

      if(config.tipoInput){
        if(config.tipoInput === 'select' && config.opciones){
          campo = document.createElement('select');
          config.opciones.forEach(function(op){
            const opt = document.createElement('option');
            opt.value = op;
            opt.innerText = op;
            if(op === config.valorInicial) opt.selected = true;
            campo.appendChild(opt);
          });
        }
        else{
          campo = document.createElement('input');
          campo.type = config.tipoInput === 'password' ? 'password' : 'text';
          campo.value = config.valorInicial || '';
          campo.placeholder = config.placeholder || '';
        }
        campoWrap.appendChild(campo);
      }

      btnCancelar.style.display = config.soloAceptar ? 'none' : 'inline-block';
      btnAceptar.innerText = config.textoAceptar || 'Aceptar';
      btnCancelar.innerText = config.textoCancelar || 'Cancelar';

      overlay.classList.add('active');

      if(campo){
        setTimeout(function(){ campo.focus(); if(campo.select){ campo.select(); } }, 150);
      }
      else{
        setTimeout(function(){ btnAceptar.focus(); }, 150);
      }

      function limpiar(){
        overlay.classList.remove('active');
        btnAceptar.removeEventListener('click', onAceptar);
        btnCancelar.removeEventListener('click', onCancelar);
        overlay.removeEventListener('keydown', onKeyDown);
      }

      function onAceptar(){
        const valor = campo ? campo.value : true;
        limpiar();
        resolve(valor);
      }

      function onCancelar(){
        limpiar();
        resolve(config.tipoInput ? null : false);
      }

      function onKeyDown(e){
        if(e.key === 'Enter'){
          onAceptar();
        }
        if(e.key === 'Escape'){
          onCancelar();
        }
      }

      btnAceptar.addEventListener('click', onAceptar);
      btnCancelar.addEventListener('click', onCancelar);
      overlay.addEventListener('keydown', onKeyDown);
    });
  }

  // ===================================================
  // 7. API PÚBLICA & COMPATIBILIDAD
  // ===================================================
  window.Notif = {
    success: function(mensaje, titulo){ toast('success', mensaje, titulo); },
    error:   function(mensaje, titulo){ toast('error', mensaje, titulo); },
    warning: function(mensaje, titulo){ toast('warning', mensaje, titulo); },
    info:    function(mensaje, titulo){ toast('info', mensaje, titulo); },

    confirm: function(mensaje, titulo){
      return abrirModal({
        mensaje: mensaje,
        titulo: titulo || '¿Estás seguro?',
        icono: '⚠️',
        color: '#ef4444',
        bg: '#fef2f2',
        textoAceptar: 'Sí, continuar',
        textoCancelar: 'Cancelar'
      });
    },

    prompt: function(mensaje, titulo, valorInicial, opciones){
      return abrirModal({
        mensaje: mensaje,
        titulo: titulo || 'Ingrese un valor',
        icono: '✏️',
        color: '#2563eb',
        bg: '#eff6ff',
        tipoInput: opciones ? 'select' : 'text',
        opciones: opciones,
        valorInicial: valorInicial || '',
        textoAceptar: 'Guardar',
        textoCancelar: 'Cancelar'
      });
    }
  };

  window.notifAlert = function(mensaje){
    let tipo = 'info';
    const texto = String(mensaje).toLowerCase();

    if(texto.includes('error') || texto.includes('❌') || texto.includes('no se pudo') || texto.includes('inválid') || texto.includes('invalid') || texto.includes('incorrect') || texto.includes('faltante') || texto.includes('debe ') || texto.includes('requerid')){
      tipo = 'error';
    }
    else if(texto.includes('correctamente') || texto.includes('exitosa') || texto.includes('exitoso') || texto.includes('guardad') || texto.includes('actualizad') || texto.includes('eliminad') || texto.includes('creado') || texto.includes('registrad') || texto.includes('✅')){
      tipo = 'success';
    }
    else if(texto.includes('cuidado') || texto.includes('advertencia') || texto.includes('⚠') || texto.includes('atención') || texto.includes('atencion')){
      tipo = 'warning';
    }

    toast(tipo, mensaje);
  };

  window.mostrarNotificacion = function(titulo, mensaje, tipo){
    tipo = tipo || 'info';
    if(!ICONOS[tipo]) tipo = 'info';
    toast(tipo, mensaje, titulo);
  };

  // Inicialización automática
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      asegurarContenedores();
      window.actualizarContadorCampana();
    });
  }
  else{
    asegurarContenedores();
    window.actualizarContadorCampana();
  }

})();
