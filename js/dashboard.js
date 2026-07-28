 
// ======================
// VALIDAR SUPABASE
// ======================

if(!window.supabase){

  notifAlert(
    'Supabase no cargó correctamente'
  );

  throw new Error(
    'Supabase no cargó correctamente'
  );

} 





// ======================
// EVITAR DUPLICAR
// ======================

if(typeof window.dashboardCargado === 'undefined'){

window.dashboardCargado = true;





// ======================
// CREAR CLIENTE
// ======================

if(!window.supabaseClient){

  const supabaseUrl =
  'https://hurxdjoiafkjoyrmyhbd.supabase.co';

  const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnhkam9pYWZram95cm15aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzgxMTMsImV4cCI6MjA5NTMxNDExM30.Z6fRiWft3eSEVNZbWflmcvVcHAJTAEA37tPdp4LRnTg';

  window.supabaseClient =

  window.supabase.createClient(

    supabaseUrl,
    supabaseKey

  );

}





// ======================
// USUARIO
// ======================

window.usuarioLogueado =

JSON.parse(

  localStorage.getItem(
    'usuarioLogueado'
  )

);





// ======================
// VALIDAR SESION
// ======================

if(!window.usuarioLogueado){

  window.location.href =
  'index.html';

}





// ======================
// VARIABLES
// ======================

const mainContent =

document.getElementById(
  'mainContent'
);





const dashboardOriginal =

mainContent
? mainContent.innerHTML
: '';





window.permisosUsuario =

window.permisosUsuario || {};





// ======================
// MOSTRAR USUARIO
// ======================

const usuarioNombre =

document.getElementById(
  'usuarioNombre'
);





if(usuarioNombre){

  usuarioNombre.innerText =

  window.usuarioLogueado.usuario +

  ' | ' +

  window.usuarioLogueado.rol;

}





// ======================
// VALIDAR PERMISOS
// ======================

window.tienePermiso = function(

  modulo,
  accion

){

  if(

    window.usuarioLogueado &&
    window.usuarioLogueado.rol === 'admin'

  ){

    return true;

  }

  if(

    !window.permisosUsuario ||

    !window.permisosUsuario[modulo]

  ){

    return false;

  }

  return Boolean(

    window.permisosUsuario[modulo][accion]

  );

};





// ======================
// MOSTRAR / OCULTAR
// ======================

function mostrarElemento(id){

  const elemento =

  document.getElementById(id);

  if(elemento){

    elemento.style.display = '';

  }

}





function ocultarElemento(id){

  const elemento =

  document.getElementById(id);

  if(elemento){

    elemento.style.display = 'none';

  }

}





function mostrarCard(id){

  const card =

  document.getElementById(id);

  if(card){

    card.style.display = '';

  }

}





function ocultarCard(id){

  const card =

  document.getElementById(id);

  if(card){

    card.style.display = 'none';

  }

}





// ======================
// VALIDAR MODULOS
// ======================

function validarModulo(modulo){

  const menu =
  modulo + 'Menu';





  const card =
  'card' +

  modulo.charAt(0)
  .toUpperCase() +

  modulo.slice(1);





  if(

    window.tienePermiso(
      modulo,
      'ver'
    )

  ){

    mostrarElemento(menu);

    mostrarCard(card);

  }

  else{

    ocultarElemento(menu);

    ocultarCard(card);

  }

}





// ======================
// APLICAR PERMISOS
// ======================

async function aplicarPermisos(){

  try{

    if(

      window.usuarioLogueado.rol ===
      'admin'

    ){

      [
    'inventario',
    'recepcion',
    'auditorias',
    'confiabilidad',
    'usuarios',
    'historial'
].forEach(validarModulo);

      return;

    }





    const response =

    await window.supabaseClient

    .from('permisos')

    .select('*')

    .eq(

      'usuario',

      window.usuarioLogueado.usuario

    );





    if(response.error){

      console.log(
        response.error
      );

      return;

    }





    const permisos =
    response.data || [];





    window.permisosUsuario = {};





    permisos.forEach(function(item){

      window.permisosUsuario[
        item.modulo
      ] = {

        ver:
        item.ver,

        crear:
        item.crear,

        editar:
        item.editar,

        eliminar:
        item.eliminar

      };

    });





    [

      'inventario',
      'recepcion',
      'auditorias',
     'confiabilidad',
      'usuarios',
      'historial'

    ].forEach(validarModulo);

  }

  catch(error){

    console.log(error);

  }

}





// ======================
// GUARDAR HISTORIAL
// ======================

window.guardarHistorial = async function(

  accion,
  modulo,
  descripcion

){

  try{

    await window.supabaseClient

    .from('historial')

    .insert([

      {

        usuario:
        window.usuarioLogueado.usuario,

        accion:
        accion,

        modulo:
        modulo,

        descripcion:
        descripcion

      }

    ]);

  }

  catch(error){

    console.log(error);

  }

};





// ======================
// RENDER NOTIFICACIONES
// ======================

window.renderNotificaciones = function(){

  const lista =

  document.getElementById(
    'listaNotificaciones'
  );





  const contador =

  document.getElementById(
    'contadorNotificaciones'
  );





  if(!lista){

    return;

  }





  const notificaciones =

  JSON.parse(

    localStorage.getItem(
      'notificaciones'
    )

  ) || [];





  lista.innerHTML = '';





  // ======================
  // CONTADOR
  // ======================

  const noLeidas =

  notificaciones.filter(function(item){

    return item.leida !== true;

  });





  if(contador){

    contador.innerText =
    noLeidas.length;

  }





  // ======================
  // VACIO
  // ======================

  if(notificaciones.length === 0){

    lista.innerHTML =

    '<p class="sin-notificaciones">' +

    'No hay notificaciones' +

    '</p>';

    return;

  }





  // ======================
  // MOSTRAR
  // ======================
notificaciones.forEach(function(item){

  lista.innerHTML +=

  '<div class="notificacion-item" onclick="mostrarModulo(\'recepcion\')">' +

    '<p>' +

    item.mensaje +

    '</p>' +

    '<span>' +

    item.fecha +

    '</span>' +

  '</div>';

});
};

// ======================
// LIMPIAR NOTIFICACIONES
// ======================

window.limpiarNotificaciones = function(){

  localStorage.removeItem(
    'notificaciones'
  );

  window.renderNotificaciones();

};





// ======================
// CAMPANA
// ======================

const campanaBtn =

document.getElementById(
  'campanaBtn'
);





const panelNotificaciones =

document.getElementById(
  'panelNotificaciones'
);





if(campanaBtn){

  campanaBtn.onclick = function(e){

    e.stopPropagation();





    // ======================
    // ABRIR / CERRAR PANEL
    // ======================

    if(panelNotificaciones){

      panelNotificaciones.classList.toggle(
        'active'
      );

    }





    // ======================
    // MARCAR LEIDAS
    // ======================

    let notificaciones =

    JSON.parse(

      localStorage.getItem(
        'notificaciones'
      )

    ) || [];





    notificaciones =

    notificaciones.map(function(item){

      item.leida = true;

      return item;

    });





    localStorage.setItem(

      'notificaciones',

      JSON.stringify(
        notificaciones
      )

    );





    window.renderNotificaciones();

  };

}





// ======================
// CERRAR AFUERA
// ======================

document.addEventListener(

  'click',

  function(e){

    if(

      panelNotificaciones &&

      !panelNotificaciones.contains(
        e.target
      ) &&

      e.target !== campanaBtn

    ){

      panelNotificaciones.classList.remove(
        'active'
      );

    }

  }

);





// ======================
// EVENTO NOTIFICACIONES
// ======================

window.addEventListener(

  'nuevaNotificacion',

  function(){

    window.renderNotificaciones();

  }

);





// ======================
// MOSTRAR MODULO
// ======================

window.mostrarModulo = function(modulo){

  const contenido =

  document.getElementById(
    'mainContent'
  );





  if(!contenido){

    return;

  }





 if(modulo === 'dashboard'){

  contenido.innerHTML =
  dashboardOriginal;

  setTimeout(async function(){

    aplicarPermisos();

    window.renderNotificaciones();

    await cargarKPIsDashboard();

    window.iniciarSlider();

  },100);

  return;

}




  cargarModulo(

    contenido,

    'modules/' + modulo + '.html',

    modulo + 'Script',

    'js/' + modulo + '.js?v=' + Date.now()

  );

}





// ======================
// CARGAR MODULO
// ======================

function cargarModulo(

  contenido,
  htmlPath,
  scriptId,
  scriptSrc

){

  fetch(htmlPath)

  .then(function(res){

    return res.text();

  })

.then(async function(html){

  contenido.innerHTML =
  html;

  await cargarScript(

    scriptId,
    scriptSrc

  );

  // ======================
  // REINICIALIZAR MODULOS
  // ======================

  if(
    typeof window.inicializarInventario ===
    'function'
  ){

    window.inicializarInventario();

  }

})
  .catch(function(error){

    console.log(error);

  });

}





// ======================
// CARGAR SCRIPT
// ======================

function cargarScript(id, src){

  return new Promise((resolve, reject) => {

    const anterior =
    document.getElementById(id);

    if(anterior){
      anterior.remove();
    }

    const script =
    document.createElement('script');

    script.src = src;
    script.id = id;

    script.onload = () => {

      console.log(
        'Script cargado:',
        id
      );

      resolve();

    };

    script.onerror = () => {

      console.log(
        'Error cargando:',
        src
      );

      reject();

    };

    document.body.appendChild(
      script
    );

  });

}

// ======================
// AUTO REFRESH
// ======================

window.iniciarAutoRefresh = function(){

  if(window.autoRefreshSistema){

    clearInterval(
      window.autoRefreshSistema
    );

  }





  window.autoRefreshSistema =

  setInterval(async function(){

    try{

      if(

        typeof window.renderNotificaciones ===
        'function'

      ){

        window.renderNotificaciones();

      }





      if(

        typeof window.renderRecepciones ===
        'function'

      ){

        await window.renderRecepciones();

      }





      if(

        typeof window.actualizarKPIsRecepcion ===
        'function'

      ){

        await window.actualizarKPIsRecepcion();

      }





      if(

        typeof window.renderAuditorias ===
        'function'

      ){

        await window.renderAuditorias();

      }





      if(

        typeof window.renderHistorialSistema ===
        'function'

      ){

        await window.renderHistorialSistema();

      }





      if(

        typeof window.renderInventario ===
        'function'

      ){

        window.renderInventario();

      }





      if(

        typeof window.actualizarKPIs ===
        'function'

      ){

        window.actualizarKPIs();

      }

    }

    catch(error){

      console.log(
        'Error auto refresh:',
        error
      );

    }

  },5000);

};





// ======================
// CERRAR SESION
// ======================

function cerrarSesion(){

  localStorage.removeItem(
    'usuarioLogueado'
  );

  window.location.href =
  'index.html';

}





// ======================
// BOTON CERRAR
// ======================

const cerrarSesionBtn =

document.getElementById(
  'cerrarSesionBtn'
);





if(cerrarSesionBtn){

  cerrarSesionBtn.onclick =
  cerrarSesion;

}





// ======================
// ACTIVAR MENU
// ======================

function activarMenu(id,modulo){

  const elemento =

  document.getElementById(id);





  if(elemento){

    elemento.onclick = function(){

      mostrarModulo(
        modulo
      );

    };

  }

}





// ======================
// MENUS
// ======================

activarMenu(
  'dashboardMenu',
  'dashboard'
);

activarMenu(
  'inventarioMenu',
  'inventario'
);

activarMenu(
  'recepcionMenu',
  'recepcion'
);

activarMenu(
  'auditoriasMenu',
  'auditorias'
);
activarMenu(
  'confiabilidadMenu',
  'confiabilidad'
);
activarMenu(
  'usuariosMenu',
  'usuarios'
);






// ======================
// CARDS
// ======================

document.addEventListener(

  'click',

  function(e){

    const card =

    e.target.closest(
      '.quick-card'
    );





    if(!card){

      return;

    }





    if(card.id === 'cardInventario'){

      mostrarModulo(
        'inventario'
      );

    }

    else if(card.id === 'cardRecepcion'){

      mostrarModulo(
        'recepcion'
      );

    }

    else if(card.id === 'cardAuditorias'){

      mostrarModulo(
        'auditorias'
      );

    }

    else if(card.id === 'cardUsuarios'){

      mostrarModulo(
        'usuarios'
      );

    }

    else if(card.id === 'cardHistorial'){

      mostrarModulo(
        'historial'
      );

    }

  }

);

// ======================
// KPI DASHBOARD
// ======================

async function cargarKPIsDashboard(){

  console.log(
    'Cargando KPIs Dashboard'
  );

  try{

    // RECEPCIONES

   const recepcionesResult =

await window.supabaseClient

.from('recepciones')

.select('*',{

  count:'exact',

  head:true

});

console.log(
  'Recepciones Count:',
  recepcionesResult.count
);

console.log(
  'Recepciones Error:',
  recepcionesResult.error
);

    document.getElementById(
      'heroRecepciones'
    ).innerText =

    recepcionesResult.count || 0;



    // AUDITORIAS

    const auditoriasResult =

    await window.supabaseClient

    .from('auditorias')

    .select('*',{

      count:'exact',

      head:true

    });

    console.log(
  'Auditorias Count:',
  auditoriasResult.count
);

console.log(
  'Auditorias Error:',
  auditoriasResult.error
);

    document.getElementById(
      'heroAuditorias'
    ).innerText =

    auditoriasResult.count || 0;



   // ALERTAS ACTIVAS

const alertasResult =

await window.supabaseClient

.from('recepciones')
.select('estado');

let alertas = 0;

if(alertasResult.data){

  alertas =

  alertasResult.data.filter(function(item){

    const estado =

    (
      item.estado || ''
    )
    .toLowerCase()
    .trim();

    return (

      estado !== 'solucionado' &&
      estado !== 'cerrado'

    );

  }).length;

}

document.getElementById(
  'heroNovedades'
).innerText = alertas;

  }

  catch(error){

    console.log(
      'Error KPI Dashboard:',
      error
    );

  }

}

// ======================
// REALTIME ERP
// ======================

function iniciarRealtimeERP(){

if(window.realtimeERPActivo){
return;
}

window.realtimeERPActivo = true;

window.supabaseClient

.channel('erp-realtime')

// ======================
// RECEPCIONES
// ======================

.on(
'postgres_changes',
{
event: '*',
schema: 'public',
table: 'recepciones'
},
async () => {

  console.log('Realtime Recepciones');

  await cargarKPIsDashboard();

  if(typeof window.renderRecepciones === 'function'){
    await window.renderRecepciones();
  }

  if(typeof window.actualizarKPIsRecepcion === 'function'){
    await window.actualizarKPIsRecepcion();
  }

}

)

// ======================
// AUDITORIAS
// ======================

.on(
'postgres_changes',
{
event: '*',
schema: 'public',
table: 'auditorias'
},
async () => {

  console.log('Realtime Auditorias');

  await cargarKPIsDashboard();

  if(typeof window.renderAuditorias === 'function'){
    await window.renderAuditorias();
  }

}

)

// ======================
// USUARIOS
// ======================

.on(
'postgres_changes',
{
event: '*',
schema: 'public',
table: 'usuarios'
},
async () => {

  console.log('Realtime Usuarios');

  if(typeof window.renderUsuarios === 'function'){
    await window.renderUsuarios();
  }

}

)

// ======================
// SEGUIMIENTO RECEPCION
// ======================

.on(
'postgres_changes',
{
event: '*',
schema: 'public',
table: 'seguimiento_recepcion'
},
async () => {

  console.log('Realtime Seguimiento');

  await cargarKPIsDashboard();

  if(typeof window.renderRecepciones === 'function'){
    await window.renderRecepciones();
  }

}

)

// ======================
// SUSCRIPCION
// ======================

.subscribe((status) => {

console.log(
  'Realtime ERP:',
  status
);

});

}


// ======================
// INICIO
// ======================

aplicarPermisos();

window.renderNotificaciones();

cargarKPIsDashboard();

iniciarRealtimeERP();




// ======================
// SLIDER HERO
// ======================

window.slideActual = 0;
window.sliderInterval = null;

window.iniciarSlider = function(){

  const slides =
  document.querySelectorAll(
    '.hero-slide'
  );

  if(slides.length === 0){
    return;
  }

  if(window.sliderInterval){
    clearInterval(
      window.sliderInterval
    );
  }

  window.slideActual = 0;

  slides.forEach(function(slide){

    slide.classList.remove(
      'active'
    );

  });

  slides[0].classList.add(
    'active'
  );

  window.sliderInterval =

  setInterval(function(){

    window.slideSiguiente();

  },5000);

};

window.slideSiguiente = function(){

  const slides =
  document.querySelectorAll(
    '.hero-slide'
  );

  if(slides.length === 0){
    return;
  }

  slides[
    window.slideActual
  ].classList.remove(
    'active'
  );

  window.slideActual++;

  if(
    window.slideActual >= slides.length
  ){
    window.slideActual = 0;
  }

  slides[
    window.slideActual
  ].classList.add(
    'active'
  );

};

window.slideAnterior = function(){

  const slides =
  document.querySelectorAll(
    '.hero-slide'
  );

  if(slides.length === 0){
    return;
  }

  slides[
    window.slideActual
  ].classList.remove(
    'active'
  );

  window.slideActual--;

  if(
    window.slideActual < 0
  ){
    window.slideActual =
    slides.length - 1;
  }

  slides[
    window.slideActual
  ].classList.add(
    'active'
  );

};

setTimeout(function(){

  window.iniciarSlider();

},500);

  }
