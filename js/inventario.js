// ========================================
// LIMPIAR VARIABLES ANTERIORES
// ========================================

delete window.renderInventario;
delete window.renderHistorial;
delete window.actualizarKPIs;
delete window.eliminarProducto;
delete window.eliminarRegistro;
delete window.filtrarHistorial;

// ========================================
// VARIABLES GLOBALES
// ========================================

window.inventario =

JSON.parse(

  localStorage.getItem(
    'inventario'
  )

) || [];

window.productoActual = null;

// ========================================
// ELEMENTOS HTML
// ========================================

var excelFile =
document.getElementById(
  'excelFile'
);

var reiniciarInventarioBtn =
document.getElementById(
  'reiniciarInventario'
);

var buscarBtn =
document.getElementById(
  'buscarBtn'
);

var guardarConteoBtn =
document.getElementById(
  'guardarConteo'
);

var exportarExcelBtn =
document.getElementById(
  'exportarExcel'
);

var buscadorInventario =
document.getElementById(
  'buscadorInventario'
);

// ========================================
// EVENTOS
// ========================================

if(excelFile){

  excelFile.onchange =
  leerExcel;

}

if(reiniciarInventarioBtn){

  reiniciarInventarioBtn.onclick =
  reiniciarInventario;

}

if(buscarBtn){

  buscarBtn.onclick =
  buscarProducto;

}

if(guardarConteoBtn){

  guardarConteoBtn.onclick =
  registrarConteo;

}

if(exportarExcelBtn){

  exportarExcelBtn.onclick =
  exportarExcel;

}

if(buscadorInventario){

  buscadorInventario.oninput =
  filtrarInventario;

}

// ========================================
// LEER EXCEL
// ========================================

function leerExcel(e){

  try{

    if(

      !window.tienePermiso(
        'inventario',
        'crear'
      )

    ){

      alert(
        'No tiene permisos'
      );

      return;

    }

    const file =

    e.target.files[0];

    if(!file){

      return;

    }

    const reader =

    new FileReader();

    reader.onload = async function(event){

      try{

        const data =

        new Uint8Array(
          event.target.result
        );

        const workbook =

        XLSX.read(

          data,

          {
            type:'array'
          }

        );

        const hoja =

        workbook.Sheets[
          workbook.SheetNames[0]
        ];

        // ========================================
        // CONVERTIR EXCEL
        // ========================================

      const inventarioExcel =

XLSX.utils.sheet_to_json(
    hoja
);

console.log(inventarioExcel[0]);

        if(

          !inventarioExcel ||

          inventarioExcel.length === 0

        ){

          alert(
            'El archivo está vacío'
          );

          return;

        }

       // ========================================
// GUARDAR EN SUPABASE
// ========================================

const { error: eliminarError } =

await window.supabaseClient

.from("inventario")

.delete()

.neq("id", 0);

if(eliminarError){

    console.error(eliminarError);

    alert("Error limpiando el inventario.");

    return;

}

const registros = inventarioExcel.map(function(item){

    return{

        codigo: String(item.codigo || "").trim(),

        producto: String(item.producto || "").trim(),

        ubicacion: String(item.ubicacion || "").trim(),

        stock: Number(item.stock || 0)

    };

});

const { error: insertarError } =

await window.supabaseClient

.from("inventario")

.insert(registros);

if(insertarError){

    console.error(insertarError);

    alert("Error guardando el inventario.");

    return;

}

window.inventario = registros;

window.renderInventario();

alert("Inventario cargado correctamente.");

              }

      catch(error){

        console.error(
          "Error leyendo Excel:",
          error
        );

      }

    };

    reader.readAsArrayBuffer(file);

  }

  catch(error){

    console.error(
      "Error leerExcel:",
      error
    );

  }

}

// ========================================
// CARGAR INVENTARIO
// ========================================

window.cargarInventario = async function(){

  try{

    const { data, error } =

    await window.supabaseClient

    .from("inventario")

    .select("*")

    .order("codigo");

    if(error){

      console.error(error);

      return;

    }

    window.inventario = data || [];

    window.renderInventario();

  }

  catch(error){

    console.error(error);

  }

};
// ========================================
// RENDER INVENTARIO
// ========================================

window.renderInventario = function(datos){

  const inventarioData =

  datos ||

  window.inventario ||

  [];

  const body =

  document.getElementById(
    'inventarioBody'
  );

  if(!body){

    return;

  }

  body.innerHTML = '';

  // ========================================
  // SIN DATOS
  // ========================================

  if(inventarioData.length === 0){

    body.innerHTML =

    '<tr>' +

    '<td colspan="5">' +

    'No hay inventario cargado' +

    '</td>' +

    '</tr>';

    return;

  }

  let html = '';

  inventarioData.forEach(function(item){

    html +=

    '<tr>' +

      '<td>' +
      (item.codigo || '-') +
      '</td>' +

      '<td>' +
      (item.producto || '-') +
      '</td>' +

      '<td>' +
      (item.ubicacion || '-') +
      '</td>' +

      '<td>' +
      (item.stock || 0) +
      '</td>' +

      

      '<td>' +

      (

        window.tienePermiso(
          'inventario',
          'eliminar'
        )

        ?

        '<button ' +

        'class="btn-eliminar" ' +

        'onclick="eliminarProducto(\'' +

        item.codigo +

        '\')">' +

        'Eliminar' +

        '</button>'

        :

        '-'

      )

      +

      '</td>' +

    '</tr>';

  });

  body.innerHTML = html;

};

  // ========================================
// ELIMINAR PRODUCTO
// ========================================

window.eliminarProducto = function(codigo){

  try{

    if(

      !window.tienePermiso(
        'inventario',
        'eliminar'
      )

    ){

      alert(
        'No tiene permisos'
      );

      return;

    }

    const confirmar = confirm(
      '¿Eliminar producto?'
    );

    if(!confirmar){

      return;

    }

    window.inventario =

    window.inventario.filter(

      function(item){

        return String(item.codigo) !== String(codigo);

      }

    );

    localStorage.setItem(

      'inventario',

      JSON.stringify(
        window.inventario
      )

    );

    window.renderInventario();

    if(
      typeof window.actualizarKPIs === 'function'
    ){
      window.actualizarKPIs();

      if(typeof window.refrescarDashboardSiActivo === "function"){
        window.refrescarDashboardSiActivo();
      }
    }

    alert(
      'Producto eliminado'
    );

  }

  catch(error){

    console.log(
      'Error eliminarProducto:',
      error
    );

  }

};



// ========================================
// BUSCAR PRODUCTO
// ========================================

function buscarProducto(){

  try{

    if(

      !window.tienePermiso(
        'inventario',
        'ver'
      )

    ){

      alert(
        'No tiene permisos'
      );

      return;

    }

    const codigoInput =

    document.getElementById(
      'codigoInput'
    );

    if(!codigoInput){

      return;

    }

    const codigo =

    codigoInput.value
    .trim();

    if(!codigo){

      alert(
        'Digite un código'
      );

      return;

    }

 // ========================================
// BUSCAR TODOS LOS REGISTROS DEL CÓDIGO
// ========================================

const registros =

(window.inventario || [])

.filter(function(item){

    return String(item.codigo).trim() === String(codigo).trim();

});

if(registros.length === 0){

    alert(
      'Producto no encontrado'
    );

    return;

}

// ========================================
// SUMAR STOCK TOTAL
// ========================================

const stockTotal =

registros.reduce(function(total,item){

    return total + Number(item.stock || 0);

},0);

// ========================================
// GUARDAR PRODUCTO ACTUAL
// ========================================

window.productoActual = {

    codigo: registros[0].codigo,

    producto: registros[0].producto,

    ubicacion: registros[0].ubicacion,

    stock: stockTotal,

    registros: registros.length

};

// ========================================
// MOSTRAR INFORMACIÓN
// ========================================

actualizarTexto(
  'codigoProducto',
  window.productoActual.codigo || '-'
);

actualizarTexto(
  'nombreProducto',
  window.productoActual.producto || '-'
);

actualizarTexto(
  'ubicacionProducto',
  window.productoActual.ubicacion || '-'
);

actualizarTexto(
  'stockProducto',
  window.productoActual.stock + ' (' +
  window.productoActual.registros +
  ' registros)'
);

  }

  catch(error){

    console.log(
      'Error buscarProducto:',
      error
    );

  }

}

function registrarConteo(){

  try{

    // ========================================
    // VALIDAR PERMISO
    // ========================================

    if(

      !window.tienePermiso(
        'inventario',
        'editar'
      )

    ){

      alert(
        'No tiene permisos'
      );

      return;

    }

    // ========================================
    // VALIDAR PRODUCTO
    // ========================================

    if(!window.productoActual){

      alert(
        'Busque un producto'
      );

      return;

    }

    // ========================================
    // INPUT CONTEO
    // ========================================

    const conteoInput =

    document.getElementById(
      'conteoFisico'
    );

    if(!conteoInput){

      alert(
        'No se encontró el campo conteo'
      );

      return;

    }

    // ========================================
    // VALORES
    // ========================================

    const fisico = Number(
      conteoInput.value
    );

    if(isNaN(fisico)){

      alert(
        'Ingrese un valor válido'
      );

      return;

    }

    const sistema = Number(
      window.productoActual.stock || 0
    );

    const diferencia =
    fisico - sistema;

    // ========================================
    // RESULTADO
    // ========================================

    actualizarTexto(
      'resultadoTexto',
      diferencia
    );

    // ========================================
    // HISTORIAL
    // ========================================

    let historial =

    JSON.parse(

      localStorage.getItem(
        'historial'
      )

    ) || [];

    const index =

    historial.findIndex(

      function(item){

        return String(
          item.codigo
        ) === String(
          window.productoActual.codigo
        );

      }

    );

    const nuevoRegistro = {

      codigo:
      window.productoActual.codigo,

      producto:
      window.productoActual.producto,

      sistema:
      sistema,

      fisico:
      fisico,

      diferencia:
      diferencia

    };

    // ========================================
    // ACTUALIZAR O CREAR
    // ========================================

    if(index >= 0){

      historial[index] =
      nuevoRegistro;

    }

    else{

      historial.push(
        nuevoRegistro
      );

    }

    // ========================================
    // GUARDAR
    // ========================================

    localStorage.setItem(

      'historial',

      JSON.stringify(
        historial
      )

    );

    // ========================================
    // ACTUALIZAR
    // ========================================

    if(

      typeof window.renderHistorial ===
      'function'

    ){

      window.renderHistorial();

    }

    if(

      typeof window.actualizarKPIs ===
      'function'

    ){

      window.actualizarKPIs();

    if(typeof window.refrescarDashboardSiActivo === "function"){
      window.refrescarDashboardSiActivo();
    }

      if(typeof window.refrescarDashboardSiActivo === "function"){
        window.refrescarDashboardSiActivo();
      }

    }

    alert(
      'Conteo guardado'
    );

  }

  catch(error){

    console.log(
      'Error registrarConteo:',
      error
    );

  }

}

// ========================================
// RENDER HISTORIAL
// ========================================

window.renderHistorial = function(filtro){

  try{

    let historial =

    JSON.parse(

      localStorage.getItem(
        'historial'
      )

    ) || [];

    // ========================================
    // FILTROS
    // ========================================

    if(filtro === 'exactos'){

      historial = historial.filter(

        item => item.diferencia === 0

      );

    }

    if(filtro === 'faltantes'){

      historial = historial.filter(

        item => item.diferencia < 0

      );

    }

    if(filtro === 'sobrantes'){

      historial = historial.filter(

        item => item.diferencia > 0

      );

    }

    const body =

    document.getElementById(
      'historialBody'
    );

    if(!body){

      return;

    }

    body.innerHTML = '';

    // ========================================
    // SIN DATOS
    // ========================================

    if(historial.length === 0){

      body.innerHTML =

      '<tr>' +

      '<td colspan="6">' +

      'No hay conteos registrados' +

      '</td>' +

      '</tr>';

      return;

    }

    // ========================================
    // HTML
    // ========================================

    let html = '';

    historial.forEach(function(item){

      html +=

      '<tr>' +

      '<td>' +
      (item.codigo || '-') +
      '</td>' +

      '<td>' +
      (item.producto || '-') +
      '</td>' +

      '<td>' +
      (item.sistema || 0) +
      '</td>' +

      '<td>' +
      (item.fisico || 0) +
      '</td>' +

      '<td>' +
      (item.diferencia || 0) +
      '</td>' +

      '<td>' +

      (

        window.tienePermiso(
          'inventario',
          'eliminar'
        )

        ?

        '<button class="btn-eliminar" onclick="window.eliminarRegistro(\'' +

        item.codigo +

        '\')">Eliminar</button>'

        :

        '-'

      ) +

      '</td>' +

      '</tr>';

    });

    body.innerHTML = html;

  }

  catch(error){

    console.log(
      'Error renderHistorial:',
      error
    );

  }

};

// ========================================
// ELIMINAR REGISTRO
// ========================================

window.eliminarRegistro = function(codigo){

  try{

    if(

      !window.tienePermiso(
        'inventario',
        'eliminar'
      )

    ){

      alert(
        'No tiene permisos'
      );

      return;

    }

    let historial =

    JSON.parse(

      localStorage.getItem(
        'historial'
      )

    ) || [];

    historial = historial.filter(

      item =>

      String(item.codigo) !==
      String(codigo)

    );

    localStorage.setItem(

      'historial',

      JSON.stringify(
        historial
      )

    );

    window.renderHistorial();

    window.actualizarKPIs();

    if(typeof window.refrescarDashboardSiActivo === "function"){
      window.refrescarDashboardSiActivo();
    }

  }

  catch(error){

    console.log(
      'Error eliminarRegistro:',
      error
    );

  }

};

// ========================================
// FILTRAR HISTORIAL
// ========================================

window.filtrarHistorial = function(tipo){

  if(

    typeof window.renderHistorial ===
    'function'

  ){

    window.renderHistorial(tipo);

  }

};

// ========================================
// KPIS
// ========================================

window.actualizarKPIs = function(){

  try{

    const historial =

    JSON.parse(

      localStorage.getItem(
        'historial'
      )

    ) || [];

    let exactos = 0;
    let faltantes = 0;
    let sobrantes = 0;

    // ========================================
    // VARIABLES EXACTITUD GLOBAL
    // ========================================

    let totalSistema = 0;
    let totalDiferencias = 0;

    historial.forEach(function(item){

      const sistema =
      Number(item.sistema || 0);

      const fisico =
      Number(item.fisico || 0);

      const diferencia =
      Math.abs(fisico - sistema);

      // ========================================
      // KPIs
      // ========================================

      if(fisico === sistema){
        exactos++;
      }

      if(fisico < sistema){
        faltantes++;
      }

      if(fisico > sistema){
        sobrantes++;
      }

      // ========================================
      // ACUMULAR PARA EXACTITUD GLOBAL
      // ========================================

      totalSistema += sistema;

      totalDiferencias += diferencia;

    });

    const totalConteos =
    historial.length;

    // ========================================
    // CALCULAR EXACTITUD GLOBAL
    // ========================================

    let exactitudGeneral = '0.00';

    if(totalSistema > 0){

      exactitudGeneral = (

        (
          1 -

          (
            totalDiferencias /
            totalSistema
          )

        ) * 100

      ).toFixed(2);

      // Evitar porcentajes negativos
      if(Number(exactitudGeneral) < 0){

        exactitudGeneral = '0.00';

      }

    }

    // ========================================
    // ACTUALIZAR KPIs
    // ========================================

    actualizarTexto(
      'kpiTotal',
      totalConteos
    );

    actualizarTexto(
      'kpiExactos',
      exactos
    );

    actualizarTexto(
      'kpiFaltantes',
      faltantes
    );

    actualizarTexto(
      'kpiSobrantes',
      sobrantes
    );

    actualizarTexto(
      'kpiExactitud',
      exactitudGeneral + '%'
    );

  }

  catch(error){

    console.log(
      'Error actualizarKPIs:',
      error
    );

  }

};

// ========================================
// FILTRAR INVENTARIO
// ========================================

function filtrarInventario(){

  try{

    const texto =

    (
      buscadorInventario?.value || ''
    )

    .toLowerCase();

    const filtrados =

    window.inventario.filter(

      function(item){

        return (

          String(
            item.codigo || ''
          )

          .toLowerCase()

          .includes(texto)

          ||

          String(
            item.producto || ''
          )

          .toLowerCase()

          .includes(texto)

        );

      }

    );

    window.renderInventario(
      filtrados
    );

  }

  catch(error){

    console.log(error);

  }

}

// ========================================
// EXPORTAR EXCEL
// ========================================

function exportarExcel(){

  try{

    const historial =

    JSON.parse(

      localStorage.getItem(
        'historial'
      )

    ) || [];

    if(historial.length === 0){

      alert(
        'No hay datos'
      );

      return;

    }

    const worksheet =

    XLSX.utils.json_to_sheet(
      historial
    );

    const workbook =

    XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(

      workbook,
      worksheet,
      'Conteos'

    );

    XLSX.writeFile(

      workbook,
      'inventario.xlsx'

    );

  }

  catch(error){

    console.log(error);

  }

}

// ========================================
// REINICIAR INVENTARIO
// ========================================

async function reiniciarInventario(){

  try{

    if(
      !window.tienePermiso(
        'inventario',
        'eliminar'
      )
    ){

      alert('No tiene permisos');
      return;

    }

    const confirmar = confirm(
      '¿Eliminar todo el inventario e historial?'
    );

    if(!confirmar){
      return;
    }

    // ==============================
    // ELIMINAR INVENTARIO SUPABASE
    // ==============================

    const { error } =

    await window.supabaseClient

    .from("inventario")

    .delete()

    .neq("id",0);

    if(error){

      console.error(error);

      alert(
        "Error eliminando el inventario."
      );

      return;

    }

    // ==============================
    // LIMPIAR VARIABLES
    // ==============================

    window.inventario = [];

    localStorage.removeItem("historial");

    // ==============================
    // ACTUALIZAR PANTALLA
    // ==============================

    window.renderInventario();

    window.renderHistorial();

    window.actualizarKPIs();

    if(typeof window.refrescarDashboardSiActivo === "function"){
      window.refrescarDashboardSiActivo();
    }

    actualizarTexto(
      "resultadoTexto",
      "-"
    );

    alert(
      "Inventario reiniciado correctamente."
    );

  }

  catch(error){

    console.error(error);

  }

}
// ========================================
// HELPERS
// ========================================

function actualizarTexto(id,valor){

  const elemento =

  document.getElementById(id);

  if(elemento){

    elemento.innerText =
    valor;

  }

}

// ========================================
// PERMISOS
// ========================================

function aplicarPermisosInventario(){

  if(

    !window.tienePermiso(
      'inventario',
      'crear'
    )

  ){

    if(excelFile){

      excelFile.style.display =
      'none';

    }

  }

  if(

    !window.tienePermiso(
      'inventario',
      'editar'
    )

  ){

    if(guardarConteoBtn){

      guardarConteoBtn.style.display =
      'none';

    }

  }

  if(

    !window.tienePermiso(
      'inventario',
      'eliminar'
    )

  ){

    if(reiniciarInventarioBtn){

      reiniciarInventarioBtn.style.display =
      'none';

    }

  }

}

// =====================================
// ABRIR MODAL NOVEDAD
// =====================================

window.abrirModalNovedad = function(){

  const modal = document.getElementById(
    'modalNovedadInventario'
  );

  if(modal){

    modal.classList.add(
      'active'
    );

  }

};

// =====================================
// CERRAR MODAL NOVEDAD
// =====================================

window.cerrarModalNovedad = function(){

  const modal = document.getElementById(
    'modalNovedadInventario'
  );

  if(modal){

    modal.classList.remove(
      'active'
    );

  }

};

// =====================================
// DASHBOARD INVENTARIO
// =====================================

window.dashboardCharts =
window.dashboardCharts || {};

window.cargarChartJS = function(callback){

  if(window.Chart){

    callback();

    return;

  }

  const existente =
  document.getElementById(
    'chartjs-cdn'
  );

  if(existente){

    existente.addEventListener(
      'load',
      callback
    );

    return;

  }

  const script =
  document.createElement(
    'script'
  );

  script.id = 'chartjs-cdn';

  script.src =
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';

  script.onload = callback;

  document.head.appendChild(
    script
  );

};

window.abrirDashboardInventario = function(){

  const modal =
  document.getElementById(
    'modalDashboardInventario'
  );

  if(modal){

    modal.classList.add(
      'active'
    );

  }

  window.cargarChartJS(
    function(){

      window.actualizarDashboardInventario();

    }

  );

};

window.cerrarDashboardInventario = function(){

  const modal =
  document.getElementById(
    'modalDashboardInventario'
  );

  if(modal){

    modal.classList.remove(
      'active'
    );

  }

};

window.actualizarDashboardInventario = function(){

  try{

    const inventario =
    window.inventario || [];

    const historial =
    JSON.parse(

      localStorage.getItem(
        'historial'
      )

    ) || [];

    // ========================================
    // TOTAL DE CODIGOS UNICOS CARGADOS
    // ========================================

    const codigosUnicos = {};

    inventario.forEach(function(item){

      const cod =
      String(item.codigo || '')
      .trim();

      if(cod){

        codigosUnicos[cod] = true;

      }

    });

    const totalCargados =
    Object.keys(codigosUnicos).length;

    const inventariados =
    historial.length;

    let pendientes =
    totalCargados - inventariados;

    if(pendientes < 0){

      pendientes = 0;

    }

    // ========================================
    // EXACTOS / FALTANTES / SOBRANTES
    // ========================================

    let exactos = 0;
    let faltantes = 0;
    let sobrantes = 0;

    let totalSistema = 0;
    let totalDiferencias = 0;

    historial.forEach(function(item){

      const sistema =
      Number(item.sistema || 0);

      const fisico =
      Number(item.fisico || 0);

      const diferencia =
      fisico - sistema;

      if(diferencia === 0){

        exactos++;

      }
      else if(diferencia < 0){

        faltantes++;

      }
      else{

        sobrantes++;

      }

      totalSistema += sistema;

      totalDiferencias +=
      Math.abs(diferencia);

    });

    const avance =
    totalCargados > 0 ?
    ((inventariados/totalCargados)*100).toFixed(1) :
    '0.0';

    let exactitud = '0.00';

    if(totalSistema > 0){

      exactitud = (

        (
          1 -
          (totalDiferencias/totalSistema)
        ) * 100

      ).toFixed(2);

      if(Number(exactitud) < 0){

        exactitud = '0.00';

      }

    }

    // ========================================
    // PINTAR KPIS DASHBOARD
    // ========================================

    actualizarTexto('dashTotalCargados', totalCargados);
    actualizarTexto('dashInventariados', inventariados);
    actualizarTexto('dashPendientes', pendientes);
    actualizarTexto('dashAvance', avance + '%');
    actualizarTexto('dashExactos', exactos);
    actualizarTexto('dashFaltantes', faltantes);
    actualizarTexto('dashSobrantes', sobrantes);
    actualizarTexto('dashExactitud', exactitud + '%');

    // ========================================
    // BITACORA
    // ========================================

    const body =
    document.getElementById(
      'dashboardHistorialBody'
    );

    if(body){

      if(historial.length === 0){

        body.innerHTML =

        '<tr>' +
        '<td colspan="6">' +
        'No hay conteos registrados' +
        '</td>' +
        '</tr>';

      }
      else{

        let html = '';

        historial.forEach(function(item){

          const diferencia =
          Number(item.diferencia || 0);

          let estadoClase = 'badge-ok';
          let estadoTexto = 'OK';

          if(diferencia < 0){

            estadoClase = 'badge-faltante';
            estadoTexto = 'Faltante';

          }
          else if(diferencia > 0){

            estadoClase = 'badge-sobrante';
            estadoTexto = 'Sobrante';

          }

          html +=

          '<tr>' +

            '<td>' + (item.codigo || '-') + '</td>' +
            '<td>' + (item.producto || '-') + '</td>' +
            '<td>' + (item.sistema || 0) + '</td>' +
            '<td>' + (item.fisico || 0) + '</td>' +
            '<td>' + diferencia + '</td>' +
            '<td><span class="badge-estado ' + estadoClase + '">' + estadoTexto + '</span></td>' +

          '</tr>';

        });

        body.innerHTML = html;

      }

    }

    // ========================================
    // GRAFICAS
    // ========================================

    if(window.Chart){

      renderChartAvanceInventario(
        inventariados,
        pendientes
      );

      renderChartResultadosInventario(
        exactos,
        faltantes,
        sobrantes
      );

    }

  }

  catch(error){

    console.log(
      'Error actualizarDashboardInventario:',
      error
    );

  }

};

function renderChartAvanceInventario(inventariados, pendientes){

  const canvas =
  document.getElementById(
    'chartAvanceInventario'
  );

  if(!canvas){

    return;

  }

  if(window.dashboardCharts.avance){

    window.dashboardCharts.avance.destroy();

  }

  window.dashboardCharts.avance =

  new window.Chart(canvas, {

    type: 'doughnut',

    data: {

      labels: ['Inventariados', 'Pendientes'],

      datasets: [{

        data: [inventariados, pendientes],

        backgroundColor: ['#2563eb', '#e2e8f0'],

        borderWidth: 0

      }]

    },

    options: {

      responsive: true,

      plugins: {

        legend: {
          position: 'bottom'
        }

      }

    }

  });

}

function renderChartResultadosInventario(exactos, faltantes, sobrantes){

  const canvas =
  document.getElementById(
    'chartResultadosInventario'
  );

  if(!canvas){

    return;

  }

  if(window.dashboardCharts.resultados){

    window.dashboardCharts.resultados.destroy();

  }

  window.dashboardCharts.resultados =

  new window.Chart(canvas, {

    type: 'bar',

    data: {

      labels: ['Exactos', 'Faltantes', 'Sobrantes'],

      datasets: [{

        label: 'Conteos',

        data: [exactos, faltantes, sobrantes],

        backgroundColor: ['#10b981', '#ef4444', '#facc15'],

        borderRadius: 8

      }]

    },

    options: {

      responsive: true,

      plugins: {

        legend: {
          display: false
        }

      },

      scales: {

        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }

      }

    }

  });

}

// ========================================
// REFRESCAR DASHBOARD SI ESTA ABIERTO
// ========================================

window.refrescarDashboardSiActivo = function(){

  const modal =
  document.getElementById(
    'modalDashboardInventario'
  );

  if(

    modal &&
    modal.classList.contains('active') &&
    window.Chart

  ){

    window.actualizarDashboardInventario();

  }

};

// =====================================
// ABRIR SIESA
// =====================================

window.abrirSiesa = function () {
    window.open(
        "https://siesaerp05.siesacloud.com/~~App12/",
        "_blank"
    );
};

// =====================================
// GUARDAR NOVEDAD INVENTARIO
// =====================================

var guardarNovedadBtn =
document.getElementById(
  'guardarNovedadBtn'
);

if(guardarNovedadBtn){

  guardarNovedadBtn.onclick =
  async function(){

    try{

      const codigo =
      document.getElementById(
        'novedadCodigo'
      ).value.trim();

      const material =
      document.getElementById(
        'novedadMaterial'
      ).value.trim();

      const stockSistema =
      document.getElementById(
        'novedadSistema'
      ).value;

      const conteoFisico =
      document.getElementById(
        'novedadFisico'
      ).value;

      const tipo =
      document.getElementById(
        'novedadTipo'
      ).value;

      const observacion =
      document.getElementById(
        'novedadObservacion'
      ).value.trim();

      if(
        !codigo ||
        !material ||
        !observacion
      ){

        alert(
          'Complete todos los campos obligatorios'
        );

        return;

      }

      const usuarioLogueado =

      JSON.parse(

        localStorage.getItem(
          'usuarioLogueado'
        )

      );

      const response =

      await window.supabaseClient

      .from(
        'novedades_inventario'
      )

      .insert([{

        codigo:
        codigo,

        material:
        material,

        stock_sistema:
        Number(stockSistema),

        conteo_fisico:
        Number(conteoFisico),

        tipo_novedad:
        tipo,

        observacion:
        observacion,

        usuario:
        usuarioLogueado?.usuario || 'Sistema'

      }]);

      if(response.error){

        console.log(
          response.error
        );

        alert(
          response.error.message
        );

        return;

      }

      alert(
        'Novedad registrada correctamente'
      );

      if(typeof renderNovedades === 'function'){

        await renderNovedades();

      }

      cerrarModalNovedad();

    }

    catch(error){

      console.log(error);

      alert(
        error.message
      );

    }

  };

}

// =====================================
// RENDER NOVEDADES INVENTARIO
// =====================================

window.renderNovedades = async function(){

  try{

    const body =
    document.getElementById(
      'novedadesBody'
    );

    if(!body){
      return;
    }

    const response =

    await window.supabaseClient

    .from('novedades_inventario')

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

    const data =
    response.data || [];

    body.innerHTML = '';

    if(data.length === 0){

      body.innerHTML =

      '<tr>' +

      '<td colspan="8">' +

      'No hay novedades registradas' +

      '</td>' +

      '</tr>';

      return;

    }

    data.forEach(function(item){

  body.innerHTML +=

  '<tr>' +

  '<td>' +
  new Date(
    item.created_at
  ).toLocaleString('es-CO') +
  '</td>' +

  '<td>' +
  item.codigo +
  '</td>' +

  '<td>' +
  item.material +
  '</td>' +

  '<td>' +
  item.tipo_novedad +
  '</td>' +

  '<td>' +
  item.stock_sistema +
  '</td>' +

  '<td>' +
  item.conteo_fisico +
  '</td>' +

  '<td>' +
item.usuario +
'</td>' +

'<td>' +

'<button class="btn-primary" onclick="verObservacion(`' +
(item.observacion || '') +
'`)">' +

'👁️' +

'</button>' +

'</td>' +

'<td>' +

'<button class="btn-eliminar" onclick="eliminarNovedad(' +
item.id +
')">' +

'🗑️' +

'</button>' +

'</td>' +

  '</tr>';

});

  }

  catch(error){

    console.log(
      'Error renderNovedades:',
      error
    );

  }

};


// =====================================
// ELIMINAR NOVEDAD
// =====================================

window.eliminarNovedad = async function(id){

  try{

    const confirmar = confirm(
      '¿Eliminar novedad?'
    );

    if(!confirmar){

      return;

    }

    const response =

    await window.supabaseClient

    .from(
      'novedades_inventario'
    )

    .delete()

    .eq(
      'id',
      Number(id)
    );

    if(response.error){

      alert(
        response.error.message
      );

      return;

    }

    await window.renderNovedades();

    alert(
      'Novedad eliminada'
    );

  }

  catch(error){

    console.log(error);

  }

};

// =====================================
// DIFERENCIA AUTOMATICA NOVEDAD
// =====================================

window.calcularDiferenciaNovedad = function(){

  const sistema = Number(
    document.getElementById(
      'novedadSistema'
    )?.value || 0
  );

  const fisico = Number(
    document.getElementById(
      'novedadFisico'
    )?.value || 0
  );

  const diferencia =
  fisico - sistema;

  const campo =

  document.getElementById(
    'novedadDiferencia'
  );

  const tipo =

  document.getElementById(
    'novedadTipo'
  );

  if(!campo){
    return;
  }

  campo.value = diferencia;

  campo.style.fontWeight =
  '700';

  campo.style.fontSize =
  '18px';

  if(diferencia < 0){

    campo.style.color =
    '#dc3545';

    if(tipo){
      tipo.value =
      'Faltante';
    }

  }

  else if(diferencia > 0){

    campo.style.color =
    '#28a745';

    if(tipo){
      tipo.value =
      'Sobrante';
    }

  }

  else{

    campo.style.color =
    '#0d6efd';

  }

};

// =====================================
// VER OBSERVACION
// =====================================

window.verObservacion = function(texto){

  document.getElementById(
    'textoObservacion'
  ).innerText = texto;

  document
  .getElementById(
    'modalObservacion'
  )
  .classList.add(
    'active'
  );

};

window.cerrarObservacion = function(){

  document
  .getElementById(
    'modalObservacion'
  )
  .classList.remove(
    'active'
  );

};


// ========================================
// INICIO
// ========================================

aplicarPermisosInventario();

window.cargarInventario();

window.renderHistorial();

window.actualizarKPIs();

if(
  typeof window.renderNovedades ===
  'function'
){
  window.renderNovedades();
}
