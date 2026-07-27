// ==========================================
// AUDITORIAS.JS
// PARTE 1
// Inicialización y Registro
// ==========================================

// ============================
// LIMPIAR INTERVALOS
// ============================

if (window.refreshAuditoriasInterval) {

    clearInterval(window.refreshAuditoriasInterval);

}

// ============================
// LIMPIAR FUNCIONES GLOBALES
// ============================

delete window.renderAuditorias;
delete window.eliminarAuditoria;
delete window.editarEstado;
delete window.iniciarRefreshAuditorias;
delete window.verDocumentos;

// ============================
// VARIABLES
// ============================

const btnGuardarAuditoria =
document.getElementById("guardarAuditoria");

const btnAgregarDocumento =
document.getElementById("btnAgregarDocumento");

const documentoInput =
document.getElementById("documentoInput");

const listaDocumentos =
document.getElementById("listaDocumentos");

// ============================
// DOCUMENTOS TEMPORALES
// ============================

let documentosSeleccionados = [];

// ============================
// CACHE DE AUDITORÍAS
// ============================

let auditoriasCache = [];
// ============================
// EVENTOS
// ============================

if(btnGuardarAuditoria){

    btnGuardarAuditoria.onclick = guardarAuditoria;

}

if(btnAgregarDocumento){

    btnAgregarDocumento.onclick = function(){

        documentoInput.click();

    };

}

if(documentoInput){

    documentoInput.onchange = agregarDocumentos;

}

// ======================================
// AGREGAR DOCUMENTOS
// ======================================

function agregarDocumentos(e){

    const archivos = [...e.target.files];

    archivos.forEach(function(archivo){

        const extension =
        archivo.name
        .split(".")
        .pop()
        .toLowerCase();

        if(

            extension !== "pdf" &&
            extension !== "xlsx" &&
            extension !== "xls"

        ){

            alert(

                "Solo se permiten archivos PDF o Excel."

            );

            return;

        }

        documentosSeleccionados.push(archivo);

    });

    renderDocumentos();

    documentoInput.value = "";

}

// ======================================
// RENDER DOCUMENTOS
// ======================================

function renderDocumentos(){

    if(!listaDocumentos){

        return;

    }

    listaDocumentos.innerHTML = "";

    if(documentosSeleccionados.length===0){

        listaDocumentos.innerHTML=

        `
        <div class="documento-vacio">

            📄 Ningún documento agregado.

        </div>
        `;

        return;

    }

    documentosSeleccionados.forEach(function(doc,index){

        const extension =
        doc.name.split(".").pop().toUpperCase();

        listaDocumentos.innerHTML +=

        `
        <div class="documento-item">

            <div class="documento-info">

                <div class="documento-nombre">

                    📄 ${doc.name}

                </div>

                <div class="documento-tipo">

                    ${extension}

                    ·

                    ${(doc.size/1024).toFixed(1)} KB

                </div>

            </div>

            <div class="documento-acciones">

                <button

                    class="btn-eliminar"

                    onclick="eliminarDocumentoTemporal(${index})"

                >

                    🗑

                </button>

            </div>

        </div>

        `;

    });

}

// ======================================
// ELIMINAR DOCUMENTO TEMPORAL
// ======================================

window.eliminarDocumentoTemporal=function(index){

    documentosSeleccionados.splice(index,1);

    renderDocumentos();

}

async function guardarAuditoria(){

    try{

        if(
            !window.tienePermiso(
                "auditorias",
                "crear"
            )
        ){

            alert("No tiene permisos.");

            return;

        }

        const tipo =
        document.getElementById("tipoInput").value;

        const nombre =
        document.getElementById("nombreInput").value.trim();

        const proceso =
        document.getElementById("procesoInput").value.trim();

        const responsable =
        document.getElementById("responsableInput").value.trim();

        const estado =
        document.getElementById("estadoInput").value;

        const fecha =
        document.getElementById("fechaInput").value;

        const observaciones =
        document.getElementById("observacionesInput").value.trim();

        if(
            !tipo ||
            !nombre ||
            !proceso ||
            !responsable ||
            !fecha
        ){

            alert("Complete todos los campos obligatorios.");

            return;

        }

        //==============================
        // CREAR AUDITORÍA
        //==============================

        const {

            data,

            error

        } =

        await window.supabaseClient

        .from("auditorias")

        .insert([{

            tipo,
            nombre,
            proceso,
            responsable,
            estado,
            fecha,
            observaciones

        }])

        .select()

        .single();

        if(error){

            console.log(error);

            alert("Error guardando la auditoría.");

            return;

        }

        const auditoriaId = data.id;

        //==============================
        // SUBIR DOCUMENTOS
        //==============================

        for(const archivo of documentosSeleccionados){

            const nombreStorage =

                Date.now() +

                "_" +

                archivo.name;

            const rutaStorage =

                auditoriaId +

                "/" +

                nombreStorage;

            const subida =

            await window.supabaseClient

            .storage

            .from("auditorias")

            .upload(

                rutaStorage,

                archivo

            );

          if(subida.error){

    console.error(subida.error);

    alert("Error subiendo archivo:\n\n" + subida.error.message);

    return;

}

            const extension =

            archivo.name

            .split(".")

            .pop()

            .toUpperCase();

            const guardarDocumento =

            await window.supabaseClient

            .from("auditoria_documentos")

            .insert([{

                auditoria_id: auditoriaId,

                nombre_archivo: archivo.name,

                ruta_storage: rutaStorage,

                tipo_archivo: extension,

                tamano: archivo.size

            }]);
if(guardarDocumento.error){

    console.error(guardarDocumento.error);

    alert("Error guardando documento:\n\n" + guardarDocumento.error.message);

    return;

}

        }

        //==============================
        // HISTORIAL
        //==============================

        if(typeof guardarHistorial === "function"){

            await guardarHistorial(

                "CREAR",

                "AUDITORIAS",

                "Nueva auditoría: " +

                nombre

            );

        }

limpiarFormulario();

await window.cargarAuditorias();

alert("Auditoría registrada correctamente.");

}

catch(error){

    console.log(error);

    alert("Ocurrió un error inesperado.");

}

}

// ======================================
// LIMPIAR FORMULARIO
// ======================================

function limpiarFormulario(){

    document.getElementById("tipoInput").value="";

    document.getElementById("nombreInput").value="";

    document.getElementById("procesoInput").value="";

    document.getElementById("responsableInput").value="";

    document.getElementById("estadoInput").value="Pendiente";

    document.getElementById("fechaInput").value="";

    document.getElementById("observacionesInput").value="";

limpiarDocumentos();

}
// ============================
// CARGAR AUDITORÍAS
// ============================

window.cargarAuditorias = async function(){

    try{

        const { data, error } =

        await window.supabaseClient

        .from("auditorias")

        .select("*")

        .order("created_at",{

            ascending:false

        });

        if(error){

            console.error(error);

            return;

        }

        auditoriasCache = data || [];

        window.renderAuditorias(auditoriasCache);

    }

    catch(error){

        console.error(error);

    }

};
// ============================
// RENDER AUDITORÍAS
// ============================

window.renderAuditorias = function(lista = auditoriasCache){

    try{

        const body =
        document.getElementById("auditoriasBody");

        if(!body){

            return;

        }

        body.innerHTML = "";

        if(!lista || lista.length === 0){

            body.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:30px;">
                        No existen auditorías registradas.
                    </td>
                </tr>
            `;

            return;

        }

        let html = "";

        lista.forEach(function(item){

            let estadoClass = "";

            switch(item.estado){

                case "Pendiente":

                    estadoClass = "estado-pendiente";

                    break;

                case "En proceso":

                    estadoClass = "estado-proceso";

                    break;

                case "Finalizada":

                    estadoClass = "estado-finalizada";

                    break;

                default:

                    estadoClass = "estado-pendiente";

            }

          html += `
<tr>

    <td>${item.tipo}</td>

    <td>${item.nombre}</td>

    <td>${item.responsable}</td>

    <td>
        <span class="${estadoClass}">
            ${item.estado}
        </span>
    </td>

    <td>
        ${new Date(item.fecha).toLocaleDateString("es-CO")}
    </td>

    <td>
        <div class="acciones-tabla">

            ${window.tienePermiso("auditorias","editar") ? `
                <button
                    class="btn-ver"
                    title="Ver detalle"
                    onclick="verDetalleAuditoria(${item.id})">
                    👁️
                </button>

                <button
                    class="btn-primary"
                    title="Documentos"
                    onclick="verDocumentos(${item.id})">
                    📁
                </button>

                <button
                    class="btn-editar"
                    title="Editar"
                    onclick="editarEstado(${item.id})">
                    ✏️
                </button>
            ` : ""}

            ${window.tienePermiso("auditorias","eliminar") ? `
                <button
                    class="btn-eliminar"
                    title="Eliminar"
                    onclick="eliminarAuditoria(${item.id})">
                    🗑️
                </button>
            ` : ""}

        </div>
    </td>

</tr>
`;

        });

        body.innerHTML = html;

    }

    catch(error){

        console.error(error);

    }

};

// ============================
// FILTRAR AUDITORÍAS
// ============================

window.filtrarAuditorias = function(){

    const input =
    document.getElementById("buscarAuditoria");

    if(!input){

        return;

    }

    const texto =
    input.value
    .toLowerCase()
    .trim();

    if(texto === ""){

        window.renderAuditorias(auditoriasCache);

        return;

    }

    const resultado =

    auditoriasCache.filter(function(item){

        return (

            String(item.tipo || "")
            .toLowerCase()
            .includes(texto)

            ||

            String(item.nombre || "")
            .toLowerCase()
            .includes(texto)

            ||

            String(item.proceso || "")
            .toLowerCase()
            .includes(texto)

            ||

            String(item.responsable || "")
            .toLowerCase()
            .includes(texto)

            ||

            String(item.estado || "")
            .toLowerCase()
            .includes(texto)

            ||

            String(item.fecha || "")
            .toLowerCase()
            .includes(texto)

        );

    });

    window.renderAuditorias(resultado);

};


// ============================
// VER DOCUMENTOS
// ============================

window.verDocumentos = async function(id){

    console.log("========== VER DOCUMENTOS ==========");
    console.log("ID Auditoría:", id);

    try{

        const modal =
        document.getElementById("modalDocumentos");

        const lista =
        document.getElementById("listaDocumentosModal");

        console.log("Modal:", modal);
        console.log("Lista:", lista);

        if(!modal){

            console.error("No existe #modalDocumentos");

            return;

        }

        if(!lista){

            console.error("No existe #listaDocumentosModal");

            return;

        }

        lista.innerHTML = "";

        const { data, error } =

        await window.supabaseClient

        .from("auditoria_documentos")

        .select("*")

        .eq("auditoria_id", id)

        .order("id");

        console.log("Respuesta Supabase:", data);

        console.log("Error:", error);

        if(error){

            console.error(error);

            alert("Error consultando documentos.");

            return;

        }

        if(!data || data.length === 0){

            lista.innerHTML = `

                <p style="text-align:center;padding:20px;">

                    No existen documentos para esta auditoría.

                </p>

            `;

            console.log("Abriendo modal sin documentos...");

            modal.classList.add("active");

            return;

        }

        data.forEach(function(doc){

    lista.innerHTML += `

        <div class="documento-storage">

            <div>

                <strong>

                    📄 ${doc.nombre_archivo}

                </strong>

                <br>

                ${doc.tipo_archivo}

            </div>

            <div
                class="acciones-documento"
            >

                <button

                    class="btn-primary"

                    onclick="descargarDocumento('${doc.ruta_storage}')"

                >

                    📥 Descargar

                </button>

                <button

                    class="btn-warning"

                    onclick="actualizarDocumento(${doc.id})"

                >

                    📤 Subir nuevo documento

                </button>

            </div>

        </div>

    `;

});

        console.log("Abriendo modal con documentos...");

        modal.classList.add("active");

    }

    catch(error){

        console.error("Error inesperado:", error);

    }

}

// ============================
// ELIMINAR AUDITORÍA
// ============================

window.eliminarAuditoria = async function (id) {

    try {

        if (

            !window.tienePermiso(

                "auditorias",

                "eliminar"

            )

        ) {

            alert("No tiene permisos.");

            return;

        }

        const confirmar = confirm(

            "¿Eliminar esta auditoría?"

        );

        if (!confirmar) return;

        const { error } = await window.supabaseClient

            .from("auditorias")

            .delete()

            .eq("id", Number(id));

        if (error) {

            console.log(error);

            return;

        }

        if (typeof guardarHistorial === "function") {

            await guardarHistorial(

                "ELIMINAR",

                "AUDITORIAS",

                "Se eliminó una auditoría."

            );

        }

        await window.cargarAuditorias();

    }

    catch (error) {

        console.log(error);

    }

};

// ============================
// EDITAR ESTADO
// ============================

window.editarEstado = async function (id) {

    try {

        if (

            !window.tienePermiso(

                "auditorias",

                "editar"

            )

        ) {

            alert("No tiene permisos.");

            return;

        }

        const nuevoEstado = prompt(

            "Nuevo estado:\n\nPendiente\nEn proceso\nFinalizada"

        );

        if (!nuevoEstado) return;

        const { error } = await window.supabaseClient

            .from("auditorias")

            .update({

                estado: nuevoEstado

            })

            .eq("id", Number(id));

        if (error) {

            console.log(error);

            return;

        }

        if (typeof guardarHistorial === "function") {

            await guardarHistorial(

                "EDITAR",

                "AUDITORIAS",

                "Se actualizó el estado de una auditoría."

            );

        }

        await window.cargarAuditorias();

    }

    catch (error) {

        console.log(error);

    }

};

// ============================
// PERMISOS
// ============================

function aplicarPermisosAuditorias() {

    if (

        !window.tienePermiso(

            "auditorias",

            "crear"

        )

    ) {

        if (btnGuardarAuditoria) {

            btnGuardarAuditoria.style.display = "none";

        }

    }

}

// ============================
// CARGAR FECHA ACTUAL
// ============================

function cargarFechaActual() {

    const fecha =

    document.getElementById("fechaInput");

    if (!fecha) return;

    if (fecha.value === "") {

        const hoy = new Date();

        fecha.value =

        hoy.toISOString().split("T")[0];

    }

}

// ============================
// LIMPIAR DOCUMENTOS
// ============================

function limpiarDocumentos() {

    documentosSeleccionados = [];

    renderDocumentos();

}

// ============================
// DESCARGAR DOCUMENTO
// ============================

window.descargarDocumento = async function(ruta){

    try{

        console.log("================================");
        console.log("Ruta recibida:", ruta);

        const { data, error } =

        await window.supabaseClient

        .storage

        .from("auditorias")

        .createSignedUrl(ruta,60);

        console.log("DATA:", data);
        console.log("ERROR:", error);

        if(error){

            console.error(error);

            alert(error.message);

            return;

        }

        console.log("URL FIRMADA:", data.signedUrl);

        window.open(
            data.signedUrl,
            "_blank"
        );

    }

    catch(error){

        console.error(error);

    }

};

const cerrarModalDocumentos =
document.getElementById("cerrarModalDocumentos");

if(cerrarModalDocumentos){

    cerrarModalDocumentos.onclick = function(){

        document
            .getElementById("modalDocumentos")
            .classList.remove("active");

    };

}

// ============================
// SELECCIONAR DOCUMENTO NUEVO
// ============================

window.actualizarDocumento = function(documentoId){

    const input = document.getElementById(
        "actualizarDocumentoInput"
    );

    if(!input){

        alert(
            "No se encontró el selector de archivos."
        );

        return;

    }

    input.value = "";

    input.dataset.documentoId = documentoId;

    input.click();

};

// ============================
// CAMBIO DE DOCUMENTO
// ============================

const actualizarDocumentoInput =
document.getElementById(
    "actualizarDocumentoInput"
);

if(actualizarDocumentoInput){

    actualizarDocumentoInput.onchange = async function(){

        const archivo = this.files[0];

        if(!archivo){

            return;

        }

        const documentoId = Number(
            this.dataset.documentoId
        );

        await subirNuevoDocumento(

            documentoId,

            archivo

        );

        this.value = "";

    };

}

// ============================
// SUBIR NUEVO DOCUMENTO
// ============================

async function subirNuevoDocumento(documentoId, archivo){

    try{

        //==============================
        // BUSCAR DOCUMENTO ACTUAL
        //==============================

        const { data: documento, error } =

        await window.supabaseClient

        .from("auditoria_documentos")

        .select("*")

        .eq("id", documentoId)

        .single();

        if(error){

            console.error(error);

            alert(error.message);

            return;

        }

        //==============================
        // GENERAR NUEVA RUTA
        //==============================

        const extension =

        archivo.name.split(".").pop().toUpperCase();

        const nombreStorage =

        Date.now() +

        "_" +

        archivo.name;

        const rutaNueva =

        documento.auditoria_id +

        "/" +

        nombreStorage;

        //==============================
        // SUBIR ARCHIVO
        //==============================

        const { data: subida, error: errorSubida } =

        await window.supabaseClient

        .storage

        .from("auditorias")

        .upload(

            rutaNueva,

            archivo,

            {

                upsert:false

            }

        );

        if(errorSubida){

            console.error(errorSubida);

            alert(errorSubida.message);

            return;

        }

        console.log("Archivo subido:", subida);

 //==============================
// ACTUALIZAR BASE DE DATOS
//==============================

console.log("==============");
console.log("documentoId:", documentoId);
console.log("archivo.name:", archivo.name);
console.log("rutaNueva:", rutaNueva);

const { error: errorUpdate } =

await window.supabaseClient

.from("auditoria_documentos")

.update({

    nombre_archivo: archivo.name,

    ruta_storage: rutaNueva,

    tipo_archivo: extension,

    tamano: archivo.size

})

.eq("id", documentoId);

if(errorUpdate){

    console.error(errorUpdate);

    alert(errorUpdate.message);

    return;

}

console.log("Documento actualizado.");

//==============================
// VERIFICAR REGISTRO
//==============================

const { data: verificar, error: errorVerificar } =

await window.supabaseClient

.from("auditoria_documentos")

.select("*")

.eq("id", documentoId)

.single();

console.log("Registro después del UPDATE:", verificar);
console.log("Error verificación:", errorVerificar);

//==============================
// RECARGAR DOCUMENTOS
//==============================

alert("Documento actualizado correctamente.");

await window.verDocumentos(
    documento.auditoria_id
);

}

catch(error){

    console.error(error);

    alert(error.message);

}

}



// ============================
// VER DETALLE AUDITORÍA
// ============================

window.verDetalleAuditoria = async function(id){

    try{

        const modal =
        document.getElementById("modalDetalleAuditoria");

        if(!modal){

            console.error("No existe #modalDetalleAuditoria");

            return;

        }

        const { data, error } = await window.supabaseClient

            .from("auditorias")

            .select("*")

            .eq("id", id)

            .single();

        if(error){

            console.error(error);

            alert("No fue posible cargar la auditoría.");

            return;

        }

        const setText = function(elId, valor){

            const el = document.getElementById(elId);

            if(el) el.textContent = valor;

        };

        setText("detalleTipo", data.tipo || "-");
        setText("detalleEstado", data.estado || "-");
        setText("detalleNombre", data.nombre || "-");
        setText("detalleResponsable", data.responsable || "-");
        setText("detalleProceso", data.proceso || "-");

        setText(
            "detalleFecha",
            data.fecha ? new Date(data.fecha).toLocaleDateString("es-CO") : "-"
        );

        const estadoEl = document.getElementById("detalleEstado");

        if(estadoEl){

            estadoEl.className = "";

            switch(data.estado){

                case "Pendiente":
                    estadoEl.classList.add("estado-pendiente");
                    break;

                case "En proceso":
                    estadoEl.classList.add("estado-proceso");
                    break;

                case "Finalizada":
                    estadoEl.classList.add("estado-finalizada");
                    break;

                default:
                    estadoEl.classList.add("estado-pendiente");

            }

        }

        const observacionesEl =
        document.getElementById("detalleObservaciones");

        if(observacionesEl){

            observacionesEl.textContent =
            data.observaciones && data.observaciones.trim() !== ""
                ? data.observaciones
                : "Sin observaciones registradas.";

        }

        const docsEl =
        document.getElementById("detalleDocumentos");

        if(docsEl){

            docsEl.innerHTML = `
                <div class="detalle-vacio">
                    Abra "Documentos" en la tabla para ver los archivos adjuntos.
                </div>
            `;

        }

        modal.classList.add("active");

    }

    catch(error){

        console.error(error);

        alert("Ocurrió un error.");

    }

};

const cerrarDetalleAuditoria =
document.getElementById("cerrarDetalleAuditoria");

if(cerrarDetalleAuditoria){

    cerrarDetalleAuditoria.onclick = function(){

        document
            .getElementById("modalDetalleAuditoria")
            .classList.remove("active");

    };

}

const modalDetalleAuditoriaEl =
document.getElementById("modalDetalleAuditoria");

if(modalDetalleAuditoriaEl){

    modalDetalleAuditoriaEl.addEventListener("click", function(e){

        if(e.target === modalDetalleAuditoriaEl){

            modalDetalleAuditoriaEl.classList.remove("active");

        }

    });

}
// ==========================================
// INICIALIZAR MÓDULO
// ==========================================

window.iniciarRefreshAuditorias = function(){

    if(window.refreshAuditoriasInterval){

        clearInterval(window.refreshAuditoriasInterval);

    }

    window.refreshAuditoriasInterval = setInterval(function(){

        if(document.getElementById("auditoriasBody")){

            window.cargarAuditorias();

        }

    },5000);

};

(function(){

    aplicarPermisosAuditorias();

    cargarFechaActual();

    renderDocumentos();

    window.cargarAuditorias();

    window.iniciarRefreshAuditorias();

    const buscarAuditoria =
    document.getElementById("buscarAuditoria");

    if(buscarAuditoria){

        buscarAuditoria.addEventListener(

            "input",

            window.filtrarAuditorias

        );

    }

})();
