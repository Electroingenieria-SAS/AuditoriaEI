// =====================================================
// SISTEMA DE NOTIFICACIONES PREMIUM - GLOBAL (PRO)
// Reemplaza alert() / confirm() / prompt() en TODOS los módulos.
//
// API:
//   Notif.success(mensaje, titulo)
//   Notif.error(mensaje, titulo)
//   Notif.warning(mensaje, titulo)
//   Notif.info(mensaje, titulo)
//   Notif.confirm(mensaje, titulo)                          -> Promise<boolean>
//   Notif.prompt(mensaje, titulo, valorInicial, opciones)   -> Promise<string|null>
//
// Métodos de Integración ERP:
//   window.crearNotificacion(mensaje, tipo, titulo)         -> Guarda en historial, actualiza campana y lanza Toast
//   window.mostrarNotificacion(titulo, mensaje, tipo)
//   window.notifAlert(mensaje)
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
  // 1. INYECTAR CONTENEDORES SI NO EXISTEN
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

    // Cargar el CSS premium automáticamente si no está en el head
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
  // 2. PERSISTENCIA EN LOCALSTORAGE & CAMPANA ERP
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
  // 3. TOAST VISUAL
  // ===================================================
  function toast(tipo, mensaje, titulo){
    asegurarContenedores();

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
  // 4. CREAR NOTIFICACIÓN (PUENTE CAMPANA + TOAST)
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
      console.error('Error registrando notificación en el historial:', err);
    }

    // Disparar toast visual
    toast(tipo, mensaje, titulo);
  };

  // ===================================================
  // 5. MODAL BASE (CONFIRM & PROMPT)
  // ===================================================
  function abrirModal(config){
    asegurarContenedores();

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
  // 6. API PÚBLICA
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

  // ===================================================
  // 7. COMPATIBILIDAD CON FUNCIONES GLOBALES
  // ===================================================
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
