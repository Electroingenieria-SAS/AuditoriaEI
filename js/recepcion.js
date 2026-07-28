

// ======================
// VARIABLES GLOBALES
// ======================

window.refreshRecepcion = null;

window.recepcionGestionando = null;





// ======================
// BOTON GUARDAR
// ======================

window.guardarRecepcionBtn =
document.getElementById(
  'guardarRecepcion'
);
// ======================
// EVENTO BOTON
// ======================

if(window.guardarRecepcionBtn){

 window.guardarRecepcionBtn.addEventListener(

    'click',

    guardarRecepcion

  );

}

// ======================
// CREAR NOTIFICACION
// ======================

window.crearNotificacion = function(mensaje){

  try{

    let notificaciones =

    JSON.parse(

      localStorage.getItem(
        'notificaciones'
      )

    ) || [];





    const nuevaNotificacion = {

      id:
      Date.now(),

      mensaje:
      mensaje,

      leida:
      false,

      fecha:
      new Date()
      .toLocaleString('es-CO')

    };





    notificaciones.unshift(
      nuevaNotificacion
    );





    localStorage.setItem(

      'notificaciones',

      JSON.stringify(
        notificaciones
      )

    );





    const contador =

    document.getElementById(
      'contadorNotificaciones'
    );





    if(contador){

      contador.innerText =
      notificaciones.length;

    }





    if(

      typeof window.renderNotificaciones ===
      'function'

    ){

      window.renderNotificaciones();

    }





    window.dispatchEvent(

      new CustomEvent(

        'nuevaNotificacion',

        {

          detail:
          nuevaNotificacion

        }

      )

    );

  }

  catch(error){

    console.log(error);

  }

};





// ======================
// GUARDAR RECEPCION
// ======================

async function guardarRecepcion(){

  try{

    if(

      !window.tienePermiso(
        'recepcion',
        'crear'
      )

    ){

      notifAlert(
        'No tiene permisos'
      );

      return;

    }
    const proveedor =

    document.getElementById(
      'proveedorInput'
    ).value.trim();
    const material =

    document.getElementById(
      'materialInput'
    ).value.trim();
    const tipoRecepcion =

    document.getElementById(
      'tipoRecepcionInput'
    ).value;
    const cantidad =

    Number(

      document.getElementById(
        'cantidadInput'
      ).value

    );

    const revisadas =

    Number(

      document.getElementById(
        'revisadasInput'
      ).value

    );





    const novedades =

    Number(

      document.getElementById(
        'novedadesInput'
      ).value

    );





    const faltantes =

    Number(

      document.getElementById(
        'faltantesInput'
      ).value

    );





    const observacion =

    document.getElementById(
      'observacionInput'
    ).value.trim();





    const estado =

    document.getElementById(
      'estadoRecepcionInput'
    ).value;





    const pdfFile =

    document.getElementById(
      'pdfInput'
    ).files[0];





    if(

      !proveedor ||
      !material ||
      !cantidad ||
      !revisadas

    ){

  mostrarAlerta(
  '¡Ups! 😕',
  'Debes completar todos los campos'
);

      return;

    }





    const porcentajeRevisado =

    (
      revisadas /
      cantidad
    ) * 100;





    let pdfUrl = '';





    // ======================
    // SUBIR PDF
    // ======================

    if(pdfFile){

      const nombreArchivo =

      Date.now() +
      '_' +
      pdfFile.name;





      const subida =

      await window.supabaseClient

      .storage

      .from(
        'recepciones-pdf'
      )

      .upload(

        nombreArchivo,

        pdfFile

      );





      if(subida.error){

        console.log(
          subida.error
        );

        notifAlert(
          'Error subiendo PDF'
        );

        return;

      }





      const urlData =

      window.supabaseClient

      .storage

      .from(
        'recepciones-pdf'
      )

      .getPublicUrl(
        nombreArchivo
      );





      pdfUrl =
      urlData.data.publicUrl;

    }





    // ======================
    // INSERTAR
    // ======================

    const response =

    await window.supabaseClient

    .from('recepciones')

    .insert([

  {

    proveedor:
    proveedor,

    material:
    material,

    tipo_recepcion:
    tipoRecepcion,

    cantidad:
    cantidad,

    revisadas:
    revisadas,

    novedades:
    novedades,

    faltantes:
    faltantes,

    porcentaje_revisado:
    porcentajeRevisado.toFixed(1),

    observacion:
    observacion,

    comentario_validacion:
    '',

    seguimiento:
    '',

    estado:
    estado,

    novedad_original:
    estado,

    pdf_url:
    pdfUrl,

    usuario_recepcion:
    window.usuarioLogueado.usuario ||

    'Usuario',

    created_at:
    new Date().toISOString()

  }

]);




    if(response.error){

      console.log(
        response.error
      );

      notifAlert(
        'Error guardando recepción'
      );

      return;

    }





    // ======================
    // NOTIFICACION
    // ======================

window.crearNotificacion(

`📦 Nueva recepción registrada

Proveedor:
${proveedor}

Material:
${material}

Tipo:
${tipoRecepcion}

Cantidad:
${cantidad}

Estado:
${estado}`

);

await window.renderRecepciones();

await window.actualizarKPIsRecepcion();

await window.actualizarDashboardRecepcion();

limpiarFormulario();

notifAlert(
  'Recepción guardada correctamente'
);

  } // ← ESTA LLAVE FALTABA

  catch(error){

    console.log(error);

  }

}





// ======================
// RENDER RECEPCIONES
// ======================

window.renderRecepciones = async function(){

  try{

    const body =

    document.getElementById(
      'recepcionesBody'
    );

    if(!body){

      return;

    }

    const response =

    await window.supabaseClient

    .from('recepciones')

    .select('*')

    .order(

      'id',

      {

        ascending:false

      }

    );





    if(response.error){

      console.log(
        response.error
      );

      return;

    }





    const recepciones =
    response.data || [];





    body.innerHTML = '';





    let html = '';


const usuarioActual =

window.usuarioLogueado?.usuario?.toLowerCase() || '';

const puedeGestionar =

usuarioActual === 'admin' ||
usuarioActual === 'auditor' ||
usuarioActual === 'lider' ||
usuarioActual === 'compras';

const puedeEliminar =

usuarioActual === 'admin' ||

usuarioActual === 'auditor';


    recepciones.forEach(function(item){

      let estadoClass = '';





      if(item.estado === 'Pendiente'){

        estadoClass =
        'estado-pendiente';

      }

      else if(item.estado === 'En Gestión Compras'){

        estadoClass =
        'estado-revision';

      }

      else if(item.estado === 'Esperando Proveedor'){

        estadoClass =
        'estado-revision';

      }

      else{

        estadoClass =
        'estado-cerrado';

      }





      html += `

      <tr>

        <td>
          ${item.proveedor || '-'}
        </td>

        <td>
          ${item.material || '-'}
        </td>

        <td>
          ${item.tipo_recepcion || '-'}
        </td>

        <td>
          ${item.cantidad || 0}
        </td>

        <td>
          ${item.porcentaje_revisado || 0}%
        </td>

        <td>
          ${item.novedades || 0}
        </td>

        <td>

  <span class="${estadoClass}">
    ${item.novedad_original || item.estado}
  </span>

</td>

<td>

  <span class="${estadoClass}">
    ${item.estado}
  </span>

</td>

        <td>

          ${new Date(
            item.created_at
          ).toLocaleString('es-CO')}

        </td>

        <td>

          <div class="acciones-tabla-mini">

            ${

              item.pdf_url

              ?

              `

            <button
  class="btn-mini btn-seguimiento-mini
  ${!puedeGestionar ? 'btn-bloqueado' : ''}"
  title="${
    puedeGestionar
    ? 'Seguimiento'
    : 'Solo Compras, Auditor y Admin'
  }"
  ${
    puedeGestionar
    ? `onclick="window.validarRecepcion(${item.id})"`
    : ''
  }
>

  📋

</button>

              `

              :

              ''

            }

            <button
              class="btn-mini btn-observacion-mini"
              title="Ver Observación"
              onclick="window.verObservacion(\`${item.observacion || ''}\`)"
            >

              👁️

            </button>
${
  item.pdf_url
  ?
  `
  <button
    class="btn-mini btn-pdf-mini"
    title="Ver PDF"
    onclick="window.open('${item.pdf_url}','_blank')"
  >
    📄
  </button>
  `
  :
  ''
}

            </button>

           <button
  class="btn-mini btn-eliminar-mini
  ${!puedeEliminar ? 'btn-bloqueado' : ''}"
  title="${
    puedeEliminar
    ? 'Eliminar'
    : 'Solo Admin y Auditor'
  }"
  ${
    puedeEliminar
    ? `onclick="eliminarRecepcion(${item.id})"`
    : ''
  }
>

  🗑️

</button>

          </div>

        </td>

      </tr>

      `;

    });





    body.innerHTML =
    html;

  }

  catch(error){

    console.log(error);

  }

};





// ======================
// MODAL GESTION
// ======================

window.validarRecepcion = async function(id){

  try{

    window.recepcionGestionando =
    Number(id);





    const modal =

    document.getElementById(
      'modalGestion'
    );





    const timeline =

    document.getElementById(
      'timelineSeguimiento'
    );





    const comentarioInput =

    document.getElementById(
      'gestionComentarioInput'
    );





    const estadoInput =

    document.getElementById(
      'gestionEstadoInput'
    );





    comentarioInput.value = '';

console.log(
'ID RECEPCION:',
window.recepcionGestionando
);

    const consulta =

    await window.supabaseClient

    .from('recepciones')

    .select('*')

    .eq(

      'id',

      Number(id)

    )

    .single();





    if(consulta.error){

      console.log(
        consulta.error
      );

      return;

    }





    const recepcion =
    consulta.data;





    estadoInput.value =
    recepcion.estado || 'Pendiente';





    timeline.innerHTML = '';





    if(

      !recepcion.seguimiento ||

      recepcion.seguimiento.trim() === ''

    ){

      timeline.innerHTML =

      `

      <div class="sin-notificaciones">

        Sin seguimiento registrado

      </div>

      `;

    }

    else{

      const bloques =

      recepcion.seguimiento

      .split('━━━━━━━━━━━━━━━━━━')

      .reverse();

bloques.forEach(function(item){

  if(item.trim() === ''){
    return;
  }

  let badgeClass = 'estado-default';
  let estadoTexto = 'Seguimiento';

  if(item.includes('Pendiente')){
    badgeClass = 'estado-pendiente-badge';
    estadoTexto = 'Pendiente';
  }

  else if(item.includes('En Gestión Compras')){
    badgeClass = 'estado-gestion-badge';
    estadoTexto = 'En Gestión Compras';
  }

  else if(item.includes('Contactando Proveedor')){
    badgeClass = 'estado-contacto-badge';
    estadoTexto = 'Contactando Proveedor';
  }

  else if(item.includes('Esperando Respuesta')){
    badgeClass = 'estado-espera-badge';
    estadoTexto = 'Esperando Respuesta';
  }

  else if(item.includes('Solucionado')){
    badgeClass = 'estado-solucionado-badge';
    estadoTexto = 'Solucionado';
  }

  else if(item.includes('Cerrado')){
    badgeClass = 'estado-cerrado-badge';
    estadoTexto = 'Cerrado';
  }

  timeline.innerHTML += `

  <div class="timeline-item">

      <div class="timeline-top">

          <span class="timeline-badge ${badgeClass}">
              ${estadoTexto}
          </span>

      </div>

      <div class="timeline-comentario">

          ${item.replace(/\n/g,'<br>')}

      </div>

  </div>

  `;

});
      

    }





    modal.classList.add(
      'active'
    );

  }

  catch(error){

    console.log(error);

  }

};





// ======================
// CERRAR MODAL
// ======================

window.cerrarModalGestion = function(){

  const modal =

  document.getElementById(
    'modalGestion'
  );





  if(modal){

    modal.classList.remove(
      'active'
    );

  }

};





// ======================
// GUARDAR GESTION
// ======================

window.guardarGestionBtn =
document.getElementById(
  'guardarGestionBtn'
);

if(window.guardarGestionBtn){

  window.guardarGestionBtn.onclick =

  async function(){

    try{

      const comentario =

      document.getElementById(
        'gestionComentarioInput'
      ).value.trim();

      const estado =

      document.getElementById(
        'gestionEstadoInput'
      ).value;

      if(comentario === ''){

        notifAlert(
          'Ingrese comentario'
        );

        return;

      }

      if(!window.recepcionGestionando){

        notifAlert(
          'No se encontró la recepción.'
        );

        return;

      }

      // ======================
      // CONSULTAR RECEPCION
      // ======================

      const consulta =

      await window.supabaseClient

      .from('recepciones')

      .select('*')

      .eq(
        'id',
        Number(
          window.recepcionGestionando
        )
      )

      .single();

      if(consulta.error){

        console.log(
          consulta.error
        );

        notifAlert(
          'Error consultando recepción'
        );

        return;

      }

      const recepcion =
      consulta.data;

      const fecha =

      new Date()
      .toLocaleString(
        'es-CO'
      );

      let seguimiento =

      recepcion.seguimiento || '';

      seguimiento +=

`
━━━━━━━━━━━━━━━━━━

📅 ${fecha}

👤 Usuario:
${window.usuarioLogueado.usuario}

🏷️ Estado:
${estado}

📝 Comentario:
${comentario}
`;

      // ======================
      // ACTUALIZAR
      // ======================

      const update =

      await window.supabaseClient

      .from('recepciones')

      .update({

        estado:
        estado,

        comentario_validacion:
        comentario,

        seguimiento:
        seguimiento

        // IMPORTANTE:
        // NO TOCAR novedad_original

      })

      .eq(
        'id',
        Number(
          window.recepcionGestionando
        )
      );

      if(update.error){

        console.log(
          update.error
        );

        notifAlert(
          'Error actualizando gestión'
        );

        return;

      }

      // ======================
      // NOTIFICACION
      // ======================

      window.crearNotificacion(

`🛒 Compras actualizó seguimiento

Estado:
${estado}

Comentario:
${comentario}`

      );

      // ======================
      // REFRESCAR
      // ======================

      await window.renderRecepciones();

      await window.actualizarKPIsRecepcion();

      await window.actualizarDashboardRecepcion();

      // ======================
      // CERRAR MODAL
      // ======================

      window.cerrarModalGestion();

    }

    catch(error){

      console.log(error);

    }

  };

}
// ======================
// ELIMINAR RECEPCION
// ======================

window.eliminarRecepcion = async function(id){

  try{

    const confirmar = await Notif.confirm(
      'Esta acción no se puede deshacer.',
      '¿Eliminar recepción?'
    );





    if(!confirmar){

      return;

    }





    await window.supabaseClient

    .from('recepciones')

    .delete()

    .eq(

      'id',

      Number(id)

    );
await window.renderRecepciones();

await window.actualizarKPIsRecepcion();

await window.actualizarDashboardRecepcion();

  }

  catch(error){

    console.log(error);

  }

};





// ======================
// ACTUALIZAR KPIS
// ======================

window.actualizarKPIsRecepcion = async function(){

  try{

    const response =

    await window.supabaseClient

    .from('recepciones')

    .select('*');





    const recepciones =
    response.data || [];





    const kpiRecepciones =

    document.getElementById(
      'kpiRecepciones'
    );





    const kpiRevisado =

    document.getElementById(
      'kpiRevisado'
    );





    const kpiNovedades =

    document.getElementById(
      'kpiNovedades'
    );





    const kpiFaltantes =

    document.getElementById(
      'kpiFaltantes'
    );





    if(kpiRecepciones){

      kpiRecepciones.innerText =
      recepciones.length;

    }





    if(recepciones.length > 0){

      const ultima =
      recepciones[0];





      if(kpiRevisado){

        kpiRevisado.innerText =

        ultima.porcentaje_revisado + '%';

      }





      if(kpiNovedades){

        kpiNovedades.innerText =

        ultima.novedades || 0;

      }





      if(kpiFaltantes){

        kpiFaltantes.innerText =

        ultima.faltantes || 0;

      }

    }

  }

  catch(error){

    console.log(error);

  }

};





// ======================
// AUTO REFRESH
// ======================

window.iniciarRefreshRecepcion = function(){

  if(window.refreshRecepcion){

    clearInterval(
      window.refreshRecepcion
    );

  }





  window.refreshRecepcion =

  setInterval(async function(){

  await window.renderRecepciones();

await window.actualizarKPIsRecepcion();

await window.actualizarDashboardRecepcion();

  },5000);

};





// ======================
// LIMPIAR FORMULARIO
// ======================

function limpiarFormulario(){

  document.getElementById(
    'proveedorInput'
  ).value = '';

  document.getElementById(
    'materialInput'
  ).value = '';

  document.getElementById(
    'cantidadInput'
  ).value = '';

  document.getElementById(
    'revisadasInput'
  ).value = '';

  document.getElementById(
    'novedadesInput'
  ).value = '';

  document.getElementById(
    'faltantesInput'
  ).value = '';

  document.getElementById(
    'observacionInput'
  ).value = '';

  document.getElementById(
    'pdfInput'
  ).value = '';

}





// ======================
// VER OBSERVACION
// ======================

window.verObservacion = function(observacion){

  const modal = document.getElementById(
    'modalObservacion'
  );

  const contenido = document.getElementById(
    'contenidoObservacion'
  );

  contenido.innerText =
  observacion || 'Sin observaciones registradas';

  modal.classList.add('active');

};

window.cerrarModalObservacion = function(){

  document
  .getElementById('modalObservacion')
  .classList.remove('active');

};


window.mostrarAlerta = function(
  titulo,
  mensaje
){

  document.getElementById(
    'tituloAlerta'
  ).innerText = titulo;

  document.getElementById(
    'mensajeAlerta'
  ).innerText = mensaje;

  document.getElementById(
    'modalAlerta'
  ).classList.add(
    'active'
  );

};

window.cerrarAlerta = function(){

  document.getElementById(
    'modalAlerta'
  ).classList.remove(
    'active'
  );

};


// ======================
// DASHBOARD RECEPCION
// ======================

window.actualizarDashboardRecepcion =
async function(){

  try{

    const response =

    await window.supabaseClient

    .from('recepciones')

    .select('*');

    if(response.error){

      console.log(response.error);

      return;

    }

    const datos =
    response.data || [];

    const resumenMeses = {};

    datos.forEach(function(item){

      const fecha =
      new Date(item.created_at);

      const mes =

      fecha.toLocaleString(
        'es-CO',
        {
          month:'long'
        }
      );

      if(!resumenMeses[mes]){

        resumenMeses[mes] = {

          recepciones:0,

          faltantes:0,

          sobrantes:0,

          danados:0,

          total:0

        };

      }

      // ======================
      // TOTAL RECEPCIONES
      // ======================

      resumenMeses[mes]
      .recepciones++;

      // ======================
      // NOVEDAD ORIGINAL
      // ======================

      const novedad =

      (
        item.novedad_original ||
        item.estado ||
        ''
      )

      .toString()

      .toLowerCase()

      .trim();

      // DEBUG
      console.log(
        'NOVEDAD:',
        novedad
      );

      // ======================
      // FALTANTES
      // ======================

      if(
        novedad.includes(
          'faltante'
        )
      ){

        resumenMeses[mes]
        .faltantes++;

      }

      // ======================
      // SOBRANTES
      // ======================

      if(
        novedad.includes(
          'sobrante'
        )
      ){

        resumenMeses[mes]
        .sobrantes++;

      }

      // ======================
      // DAÑADOS
      // ======================

      if(
        novedad.includes(
          'dañado'
        ) ||

        novedad.includes(
          'danado'
        )
      ){

        resumenMeses[mes]
        .danados++;

      }

      // ======================
      // TOTAL NOVEDADES
      // ======================

      if(

        novedad.includes(
          'faltante'
        ) ||

        novedad.includes(
          'sobrante'
        ) ||

        novedad.includes(
          'dañado'
        ) ||

        novedad.includes(
          'danado'
        )

      ){

        resumenMeses[mes]
        .total++;

      }

    });

    const body =

    document.getElementById(
      'dashboardRecepcionBody'
    );

    if(!body){

      return;

    }

    body.innerHTML = '';

    Object.keys(resumenMeses)

    .forEach(function(mes){

      const item =
      resumenMeses[mes];

      body.innerHTML += `

      <tr>

        <td>${mes}</td>

        <td>${item.recepciones}</td>

        <td>${item.faltantes}</td>

        <td>${item.sobrantes}</td>

        <td>${item.danados}</td>

        <td>${item.total}</td>

      </tr>

      `;

    });

  }

  catch(error){

    console.log(
      'Error Dashboard:',
      error
    );

  }

};

// ======================
// DASHBOARD EJECUTIVO
// ======================

document.addEventListener(
'click',
function(e){

if(
  e.target &&
  e.target.id ===
  'descargarDashboardRecepcion'
){

  window.open(

    'modules/dashboard-recepcion.html',

    '_blank'

  );

}

});

// ======================
// INICIO
// ======================

window.renderRecepciones();

window.actualizarKPIsRecepcion();

window.actualizarDashboardRecepcion();

window.iniciarRefreshRecepcion();
