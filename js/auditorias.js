// ==========================================================
// AUDITORIAS.JS
// Módulo de Auditorías — arquitectura modular
//
// Este archivo se carga una única vez por el loader del
// dashboard (js/dashboard.js -> cargarModulo), por lo tanto
// TODO el módulo vive en este único archivo. Para mantenerlo
// ordenado se divide en bloques claramente delimitados:
//
//   1. Limpieza / bootstrap
//   2. Estado interno del módulo
//   3. Utilidades genéricas
//   4. Historial + Notificaciones (capa unificada)
//   5. Documentos temporales (formulario de creación)
//   6. Storage: subir / eliminar / reemplazar documentos
//   7. CRUD Auditorías (crear, listar, render, filtrar)
//   8. Modal "Ver documentos"
//   9. Modal "Editar auditoría" (edición integral)
//  10. Modal "Detalle de auditoría"
//  11. Eliminar auditoría / editar estado rápido
//  12. Permisos
//  13. Inicialización del módulo
// ==========================================================


// ==========================================================
// 1. LIMPIEZA / BOOTSTRAP
// ==========================================================
// El módulo puede recargarse varias veces (SPA sin recarga de
// página), así que se limpian intervalos y funciones globales
// previas antes de volver a declararlas.

if (window.refreshAuditoriasInterval) {
    clearInterval(window.refreshAuditoriasInterval);
}

[
    "renderAuditorias",
    "eliminarAuditoria",
    "editarEstado",
    "iniciarRefreshAuditorias",
    "verDocumentos",
    "abrirEditarAuditoria",
    "verDetalleAuditoria",
    "descargarDocumento",
    "cargarAuditorias",
    "filtrarAuditorias",
    "eliminarDocumentoTemporal"
].forEach(function (nombre) {
    delete window[nombre];
});


// ==========================================================
// 2. ESTADO INTERNO DEL MÓDULO
// ==========================================================

const AUDITORIAS_BUCKET = "auditorias";
const AUDITORIAS_TABLA = "auditorias";
const DOCUMENTOS_TABLA = "auditoria_documentos";
const EXTENSIONES_PERMITIDAS = ["pdf", "xlsx", "xls"];

// Cache de la última consulta (usada por el buscador/filtro)
let auditoriasCache = [];

// Documentos seleccionados en el formulario de CREACIÓN
// (aún no subidos a Storage)
let documentosSeleccionados = [];

// Snapshot de la auditoría que se está editando actualmente,
// se usa para poder comparar "antes" vs "después" y así
// registrar un historial detallado de los cambios.
let auditoriaEnEdicion = null;


// ==========================================================
// 3. UTILIDADES GENÉRICAS
// ==========================================================

function obtenerElemento(id) {
    return document.getElementById(id);
}

function obtenerValor(id) {
    const el = obtenerElemento(id);
    return el ? el.value : "";
}

function asignarValor(id, valor) {
    const el = obtenerElemento(id);
    if (el) el.value = valor ?? "";
}

function obtenerExtension(nombreArchivo) {
    return nombreArchivo.split(".").pop().toLowerCase();
}

function extensionValida(nombreArchivo) {
    return EXTENSIONES_PERMITIDAS.includes(obtenerExtension(nombreArchivo));
}

function formatearFecha(fecha) {
    return fecha ? new Date(fecha).toLocaleDateString("es-CO") : "-";
}

function claseEstado(estado) {
    switch (estado) {
        case "Pendiente": return "estado-pendiente";
        case "En proceso": return "estado-proceso";
        case "Finalizada": return "estado-finalizada";
        default: return "estado-pendiente";
    }
}

function abrirModal(id) {
    const modal = obtenerElemento(id);
    if (modal) modal.classList.add("active");
}

function cerrarModal(id) {
    const modal = obtenerElemento(id);
    if (modal) modal.classList.remove("active");
}

// Cierra un modal al hacer click fuera de su contenido y
// registra el botón "cerrar" (✕), evitando repetir el mismo
// patrón de eventos en cada modal.
function configurarCierreModal(modalId, botonCerrarId) {
    const modal = obtenerElemento(modalId);
    const boton = obtenerElemento(botonCerrarId);

    if (boton) {
        boton.onclick = function () {
            cerrarModal(modalId);
        };
    }

    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) {
                cerrarModal(modalId);
            }
        });
    }
}

function manejarErrorSupabase(error, mensajeUsuario) {
    console.error(error);
    window.mostrarNotificacion
        ? window.mostrarNotificacion("Error", mensajeUsuario || error.message, "error")
        : notifAlert(mensajeUsuario || error.message);
}


// ==========================================================
// 4. HISTORIAL + NOTIFICACIONES (capa unificada)
// ==========================================================
// Toda acción relevante del módulo pasa por esta única función
// para no duplicar la lógica de "guardar historial" + "avisar
// al usuario" en cada flujo (crear, editar, eliminar, etc).
//
//   accion       -> "CREAR" | "EDITAR" | "ELIMINAR"
//   descripcion  -> texto que se guarda en la tabla `historial`
//   opciones:
//     mensajeCampana -> texto de la campanita de notificaciones
//                       (por defecto usa la misma descripción)
//     popup           -> { titulo, tipo } para mostrar el modal
//                       global de notificación (success/error/info)

async function registrarEvento(accion, descripcion, opciones = {}) {
    try {
        if (typeof window.guardarHistorial === "function") {
            await window.guardarHistorial(accion, "AUDITORIAS", descripcion);
        }

        if (typeof window.crearNotificacion === "function") {
            window.crearNotificacion(opciones.mensajeCampana || descripcion);
        }

        if (opciones.popup && typeof window.mostrarNotificacion === "function") {
            window.mostrarNotificacion(
                opciones.popup.titulo || "Auditorías",
                descripcion,
                opciones.popup.tipo || "success"
            );
        }
    } catch (error) {
        // El historial/notificación nunca debe romper el flujo principal
        console.error("No fue posible registrar el evento:", error);
    }
}

// Genera los mensajes de historial a partir de la comparación
// entre los datos anteriores y los nuevos de una auditoría.
function generarCambios(anterior, nuevo, huboDocumentoNuevo) {
    const cambios = [];

    const campos = [
        { clave: "tipo", etiqueta: "el tipo" },
        { clave: "nombre", etiqueta: "el nombre" },
        { clave: "responsable", etiqueta: "el responsable" },
        { clave: "proceso", etiqueta: "el proceso" },
        { clave: "fecha", etiqueta: "la fecha" },
        { clave: "observaciones", etiqueta: "las observaciones" }
    ];

    campos.forEach(function (campo) {
        const valorAnterior = (anterior[campo.clave] || "").toString().trim();
        const valorNuevo = (nuevo[campo.clave] || "").toString().trim();

        if (valorAnterior !== valorNuevo) {
            cambios.push(`Se modificó ${campo.etiqueta}.`);
        }
    });

    if ((anterior.estado || "") !== (nuevo.estado || "")) {
        cambios.push(`Se cambió el estado de "${anterior.estado}" a "${nuevo.estado}".`);
    }

    if (huboDocumentoNuevo) {
        cambios.push("Se reemplazó el documento adjunto.");
    }

    return cambios;
}


// ==========================================================
// 5. DOCUMENTOS TEMPORALES (formulario de creación)
// ==========================================================

const btnGuardarAuditoria = obtenerElemento("guardarAuditoria");
const btnAgregarDocumento = obtenerElemento("btnAgregarDocumento");
const documentoInput = obtenerElemento("documentoInput");
const listaDocumentos = obtenerElemento("listaDocumentos");

if (btnGuardarAuditoria) {
    btnGuardarAuditoria.onclick = guardarAuditoria;
}

if (btnAgregarDocumento) {
    btnAgregarDocumento.onclick = function () {
        documentoInput.click();
    };
}

if (documentoInput) {
    documentoInput.onchange = agregarDocumentos;
}

function agregarDocumentos(e) {
    const archivos = [...e.target.files];

    archivos.forEach(function (archivo) {
        if (!extensionValida(archivo.name)) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Archivo no válido", "Solo se permiten archivos PDF o Excel.", "warning")
                : notifAlert("Solo se permiten archivos PDF o Excel.");
            return;
        }

        documentosSeleccionados.push(archivo);
    });

    renderDocumentos();
    documentoInput.value = "";
}

function renderDocumentos() {
    if (!listaDocumentos) return;

    if (documentosSeleccionados.length === 0) {
        listaDocumentos.innerHTML = `
            <div class="documento-vacio">
                📄 Ningún documento agregado.
            </div>
        `;
        return;
    }

    listaDocumentos.innerHTML = documentosSeleccionados.map(function (doc, index) {
        const extension = obtenerExtension(doc.name).toUpperCase();

        return `
            <div class="documento-item">
                <div class="documento-info">
                    <div class="documento-nombre">📄 ${doc.name}</div>
                    <div class="documento-tipo">
                        ${extension} · ${(doc.size / 1024).toFixed(1)} KB
                    </div>
                </div>
                <div class="documento-acciones">
                    <button class="btn-eliminar" onclick="eliminarDocumentoTemporal(${index})">🗑</button>
                </div>
            </div>
        `;
    }).join("");
}

window.eliminarDocumentoTemporal = function (index) {
    documentosSeleccionados.splice(index, 1);
    renderDocumentos();
};

function limpiarDocumentos() {
    documentosSeleccionados = [];
    renderDocumentos();
}


// ==========================================================
// 6. STORAGE: SUBIR / ELIMINAR / REEMPLAZAR DOCUMENTOS
// ==========================================================
// Estas funciones son el corazón de la gestión documental y
// son usadas tanto en la creación como en la edición, evitando
// duplicar lógica de Storage + tabla `auditoria_documentos`.

function generarRutaStorage(auditoriaId, nombreArchivo) {
    const nombreStorage = Date.now() + "_" + nombreArchivo;
    return `${auditoriaId}/${nombreStorage}`;
}

// Sube un archivo físico a Storage y crea su registro en BD.
// Devuelve { error } si algo falla, o { data } si todo sale bien.
async function subirDocumento(auditoriaId, archivo) {
    const rutaStorage = generarRutaStorage(auditoriaId, archivo.name);

    const subida = await window.supabaseClient
        .storage
        .from(AUDITORIAS_BUCKET)
        .upload(rutaStorage, archivo);

    if (subida.error) {
        return { error: subida.error };
    }

    const registro = await window.supabaseClient
        .from(DOCUMENTOS_TABLA)
        .insert([{
            auditoria_id: auditoriaId,
            nombre_archivo: archivo.name,
            ruta_storage: rutaStorage,
            tipo_archivo: obtenerExtension(archivo.name).toUpperCase(),
            tamano: archivo.size
        }])
        .select()
        .single();

    if (registro.error) {
        return { error: registro.error };
    }

    return { data: registro.data };
}

// Obtiene TODOS los documentos vigentes de una auditoría.
async function obtenerDocumentosDeAuditoria(auditoriaId) {
    return window.supabaseClient
        .from(DOCUMENTOS_TABLA)
        .select("*")
        .eq("auditoria_id", auditoriaId)
        .order("id");
}

// Elimina del Storage y de la tabla todos los documentos
// indicados. Se usa para garantizar la regla de negocio de
// "un único documento vigente" antes de subir uno nuevo.
async function eliminarDocumentos(documentos) {
    if (!documentos || documentos.length === 0) return;

    const rutas = documentos.map(function (doc) {
        return doc.ruta_storage;
    });

    await window.supabaseClient
        .storage
        .from(AUDITORIAS_BUCKET)
        .remove(rutas);

    const ids = documentos.map(function (doc) {
        return doc.id;
    });

    await window.supabaseClient
        .from(DOCUMENTOS_TABLA)
        .delete()
        .in("id", ids);
}

// Reemplaza el/los documento(s) vigentes de una auditoría por
// uno nuevo: elimina lo anterior (Storage + BD) y sube el
// archivo nuevo. Devuelve { error } o { data }.
async function reemplazarDocumento(auditoriaId, archivoNuevo) {
    const { data: documentosActuales, error: errorConsulta } =
        await obtenerDocumentosDeAuditoria(auditoriaId);

    if (errorConsulta) {
        return { error: errorConsulta };
    }

    const subida = await subirDocumento(auditoriaId, archivoNuevo);

    if (subida.error) {
        return { error: subida.error };
    }

    // Solo se elimina lo anterior DESPUÉS de confirmar que el
    // nuevo documento quedó subido y registrado correctamente,
    // así nunca se pierde el archivo si algo falla a mitad de camino.
    await eliminarDocumentos(documentosActuales);

    return { data: subida.data };
}


// ==========================================================
// 7. CRUD AUDITORÍAS
// ==========================================================

async function guardarAuditoria() {
    try {
        if (!window.tienePermiso("auditorias", "crear")) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Sin permisos", "No tiene permisos para crear auditorías.", "warning")
                : notifAlert("No tiene permisos.");
            return;
        }

        const tipo = obtenerValor("tipoInput");
        const nombre = obtenerValor("nombreInput").trim();
        const proceso = obtenerValor("procesoInput").trim();
        const responsable = obtenerValor("responsableInput").trim();
        const estado = obtenerValor("estadoInput");
        const fecha = obtenerValor("fechaInput");
        const observaciones = obtenerValor("observacionesInput").trim();

        if (!tipo || !nombre || !proceso || !responsable || !fecha) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Datos incompletos", "Complete todos los campos obligatorios.", "warning")
                : notifAlert("Complete todos los campos obligatorios.");
            return;
        }

        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .insert([{ tipo, nombre, proceso, responsable, estado, fecha, observaciones }])
            .select()
            .single();

        if (error) {
            manejarErrorSupabase(error, "Error guardando la auditoría.");
            return;
        }

        const auditoriaId = data.id;

        for (const archivo of documentosSeleccionados) {
            const resultado = await subirDocumento(auditoriaId, archivo);

            if (resultado.error) {
                manejarErrorSupabase(resultado.error, "Error subiendo documento: " + resultado.error.message);
                return;
            }
        }

        await registrarEvento(
            "CREAR",
            `Nueva auditoría registrada: ${nombre}.`,
            { popup: { titulo: "Auditoría creada", tipo: "success" } }
        );

        limpiarFormulario();
        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Ocurrió un error inesperado.");
    }
}

function limpiarFormulario() {
    asignarValor("tipoInput", "");
    asignarValor("nombreInput", "");
    asignarValor("procesoInput", "");
    asignarValor("responsableInput", "");
    asignarValor("estadoInput", "Pendiente");
    asignarValor("fechaInput", "");
    asignarValor("observacionesInput", "");
    limpiarDocumentos();
}

window.cargarAuditorias = async function () {
    try {
        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            return;
        }

        auditoriasCache = data || [];
        window.renderAuditorias(auditoriasCache);
    } catch (error) {
        console.error(error);
    }
};

window.renderAuditorias = function (lista = auditoriasCache) {
    try {
        const body = obtenerElemento("auditoriasBody");
        if (!body) return;

        if (!lista || lista.length === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:30px;">
                        No existen auditorías registradas.
                    </td>
                </tr>
            `;
            return;
        }

        const puedeEditar = window.tienePermiso("auditorias", "editar");
        const puedeEliminar = window.tienePermiso("auditorias", "eliminar");

        body.innerHTML = lista.map(function (item) {
            return `
                <tr>
                    <td>${item.tipo}</td>
                    <td>${item.nombre}</td>
                    <td>${item.responsable}</td>
                    <td><span class="${claseEstado(item.estado)}">${item.estado}</span></td>
                    <td>${formatearFecha(item.fecha)}</td>
                    <td>
                        <div class="acciones-tabla">
                            ${puedeEditar ? `
                                <button class="btn-ver" title="Ver detalle" onclick="verDetalleAuditoria(${item.id})">👁️</button>
                                <button class="btn-primary" title="Documentos" onclick="verDocumentos(${item.id})">📁</button>
                                <button class="btn-editar" title="Editar" onclick="abrirEditarAuditoria(${item.id})">✏️</button>
                            ` : ""}
                            ${puedeEliminar ? `
                                <button class="btn-eliminar" title="Eliminar" onclick="eliminarAuditoria(${item.id})">🗑️</button>
                            ` : ""}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (error) {
        console.error(error);
    }
};

window.filtrarAuditorias = function () {
    const input = obtenerElemento("buscarAuditoria");
    if (!input) return;

    const texto = input.value.toLowerCase().trim();

    if (texto === "") {
        window.renderAuditorias(auditoriasCache);
        return;
    }

    const campos = ["tipo", "nombre", "proceso", "responsable", "estado", "fecha"];

    const resultado = auditoriasCache.filter(function (item) {
        return campos.some(function (campo) {
            return String(item[campo] || "").toLowerCase().includes(texto);
        });
    });

    window.renderAuditorias(resultado);
};


// ==========================================================
// 8. MODAL "VER DOCUMENTOS"
// ==========================================================

window.verDocumentos = async function (id) {
    try {
        const lista = obtenerElemento("listaDocumentosModal");
        if (!lista) return;

        lista.innerHTML = "";

        const { data, error } = await obtenerDocumentosDeAuditoria(id);

        if (error) {
            manejarErrorSupabase(error, "Error consultando documentos.");
            return;
        }

        if (!data || data.length === 0) {
            lista.innerHTML = `
                <p style="text-align:center;padding:20px;">
                    No existen documentos para esta auditoría.
                </p>
            `;
            abrirModal("modalDocumentos");
            return;
        }

        lista.innerHTML = data.map(function (doc) {
            return `
                <div class="documento-storage">
                    <div>
                        <strong>📄 ${doc.nombre_archivo}</strong>
                        <br>
                        ${doc.tipo_archivo}
                    </div>
                    <div class="acciones-documento">
                        <button class="btn-primary" onclick="descargarDocumento('${doc.ruta_storage}')">
                            📥 Descargar
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        abrirModal("modalDocumentos");
    } catch (error) {
        console.error("Error inesperado:", error);
    }
};

window.descargarDocumento = async function (ruta) {
    try {
        const { data, error } = await window.supabaseClient
            .storage
            .from(AUDITORIAS_BUCKET)
            .createSignedUrl(ruta, 60);

        if (error) {
            manejarErrorSupabase(error, "No fue posible generar el enlace de descarga.");
            return;
        }

        window.open(data.signedUrl, "_blank");
    } catch (error) {
        console.error(error);
    }
};

configurarCierreModal("modalDocumentos", "cerrarModalDocumentos");


// ==========================================================
// 9. MODAL "EDITAR AUDITORÍA" (edición integral)
// ==========================================================
// Único punto de edición: datos generales + documento.
// Flujo al guardar (ver guardarCambiosAuditoria):
//   1. Actualizar tabla `auditorias`
//   2. Si hay archivo nuevo -> reemplazarDocumento()
//   3. Registrar historial (granular, por campo modificado)
//   4. Notificar
//   5. Cerrar modal + recargar tabla

window.abrirEditarAuditoria = async function (id) {
    try {
        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            manejarErrorSupabase(error, "No fue posible cargar la auditoría.");
            return;
        }

        // Se guarda el estado original para poder comparar
        // después y construir el historial de cambios.
        auditoriaEnEdicion = data;

        asignarValor("editarAuditoriaId", data.id);
        asignarValor("editarTipo", data.tipo);
        asignarValor("editarNombre", data.nombre);
        asignarValor("editarResponsable", data.responsable);
        asignarValor("editarProceso", data.proceso);
        asignarValor("editarEstado", data.estado);
        asignarValor("editarFecha", data.fecha);
        asignarValor("editarObservaciones", data.observaciones || "");

        const inputDocumento = obtenerElemento("editarDocumento");
        if (inputDocumento) inputDocumento.value = "";

        abrirModal("modalEditarAuditoria");
    } catch (error) {
        console.error(error);
    }
};

configurarCierreModal("modalEditarAuditoria", "cerrarEditarAuditoria");

const guardarEdicionAuditoria = obtenerElemento("guardarEdicionAuditoria");
if (guardarEdicionAuditoria) {
    guardarEdicionAuditoria.onclick = guardarCambiosAuditoria;
}

async function guardarCambiosAuditoria() {
    if (!auditoriaEnEdicion) return;

    // Evita doble click mientras se procesa la edición
    if (guardarEdicionAuditoria) guardarEdicionAuditoria.disabled = true;

    try {
        const id = Number(obtenerValor("editarAuditoriaId"));

        const datosNuevos = {
            tipo: obtenerValor("editarTipo"),
            nombre: obtenerValor("editarNombre").trim(),
            responsable: obtenerValor("editarResponsable").trim(),
            proceso: obtenerValor("editarProceso").trim(),
            estado: obtenerValor("editarEstado"),
            fecha: obtenerValor("editarFecha"),
            observaciones: obtenerValor("editarObservaciones").trim()
        };

        if (!datosNuevos.tipo || !datosNuevos.nombre || !datosNuevos.proceso ||
            !datosNuevos.responsable || !datosNuevos.fecha) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Datos incompletos", "Complete todos los campos obligatorios.", "warning")
                : notifAlert("Complete todos los campos obligatorios.");
            return;
        }

        const inputDocumento = obtenerElemento("editarDocumento");
        const archivoNuevo = inputDocumento && inputDocumento.files[0];

        if (archivoNuevo && !extensionValida(archivoNuevo.name)) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Archivo no válido", "Solo se permiten archivos PDF o Excel.", "warning")
                : notifAlert("Solo se permiten archivos PDF o Excel.");
            return;
        }

        // 1. Actualizar tabla `auditorias`
        const { error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .update(datosNuevos)
            .eq("id", id);

        if (error) {
            manejarErrorSupabase(error, "Error actualizando la auditoría.");
            return;
        }

        // 2. Reemplazar documento si el usuario seleccionó uno nuevo
        if (archivoNuevo) {
            const resultado = await reemplazarDocumento(id, archivoNuevo);

            if (resultado.error) {
                manejarErrorSupabase(resultado.error, "Error reemplazando el documento: " + resultado.error.message);
                return;
            }
        }

        // 3 y 4. Historial + notificaciones (granular por campo)
        const cambios = generarCambios(auditoriaEnEdicion, datosNuevos, Boolean(archivoNuevo));

        if (cambios.length === 0) {
            await registrarEvento(
                "EDITAR",
                `Se editó la auditoría "${datosNuevos.nombre}" sin cambios detectados.`,
                { popup: { titulo: "Auditoría actualizada", tipo: "info" } }
            );
        } else {
            for (const cambio of cambios) {
                await registrarEvento("EDITAR", `${cambio} (Auditoría: ${datosNuevos.nombre})`);
            }

            window.mostrarNotificacion
                ? window.mostrarNotificacion("Auditoría actualizada", "Los cambios se guardaron correctamente.", "success")
                : notifAlert("Información actualizada correctamente.");
        }

        // 5. Cerrar modal + recargar tabla
        cerrarModal("modalEditarAuditoria");
        if (inputDocumento) inputDocumento.value = "";
        auditoriaEnEdicion = null;

        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Ocurrió un error inesperado editando la auditoría.");
    } finally {
        if (guardarEdicionAuditoria) guardarEdicionAuditoria.disabled = false;
    }
}


// ==========================================================
// 10. MODAL "DETALLE DE AUDITORÍA"
// ==========================================================

window.verDetalleAuditoria = async function (id) {
    try {
        if (!obtenerElemento("modalDetalleAuditoria")) {
            console.error("No existe #modalDetalleAuditoria");
            return;
        }

        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            manejarErrorSupabase(error, "No fue posible cargar la auditoría.");
            return;
        }

        const setText = function (elId, valor) {
            const el = obtenerElemento(elId);
            if (el) el.textContent = valor;
        };

        setText("detalleTipo", data.tipo || "-");
        setText("detalleEstado", data.estado || "-");
        setText("detalleNombre", data.nombre || "-");
        setText("detalleResponsable", data.responsable || "-");
        setText("detalleProceso", data.proceso || "-");
        setText("detalleFecha", formatearFecha(data.fecha));

        const estadoEl = obtenerElemento("detalleEstado");
        if (estadoEl) {
            estadoEl.className = "";
            estadoEl.classList.add(claseEstado(data.estado));
        }

        const observacionesEl = obtenerElemento("detalleObservaciones");
        if (observacionesEl) {
            observacionesEl.textContent =
                data.observaciones && data.observaciones.trim() !== ""
                    ? data.observaciones
                    : "Sin observaciones registradas.";
        }

        const docsEl = obtenerElemento("detalleDocumentos");
        if (docsEl) {
            docsEl.innerHTML = `
                <div class="detalle-vacio">
                    Abra "Documentos" en la tabla para ver los archivos adjuntos.
                </div>
            `;
        }

        abrirModal("modalDetalleAuditoria");
    } catch (error) {
        manejarErrorSupabase(error, "Ocurrió un error.");
    }
};

configurarCierreModal("modalDetalleAuditoria", "cerrarDetalleAuditoria");


// ==========================================================
// 11. ELIMINAR AUDITORÍA / EDITAR ESTADO RÁPIDO
// ==========================================================

window.eliminarAuditoria = async function (id) {
    try {
        if (!window.tienePermiso("auditorias", "eliminar")) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Sin permisos", "No tiene permisos para eliminar auditorías.", "warning")
                : notifAlert("No tiene permisos.");
            return;
        }

        const confirmar = await Notif.confirm("Esta acción también eliminará sus documentos adjuntos.\nEsta acción no se puede deshacer.", "¿Eliminar esta auditoría?");
        if (!confirmar) return;

        // Se eliminan primero los documentos (Storage + BD) para
        // no dejar archivos huérfanos en el bucket.
        const { data: documentos } = await obtenerDocumentosDeAuditoria(id);
        await eliminarDocumentos(documentos);

        const { error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .delete()
            .eq("id", Number(id));

        if (error) {
            manejarErrorSupabase(error, "Error eliminando la auditoría.");
            return;
        }

        await registrarEvento(
            "ELIMINAR",
            "Se eliminó una auditoría.",
            { popup: { titulo: "Auditoría eliminada", tipo: "success" } }
        );

        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Ocurrió un error eliminando la auditoría.");
    }
};

// Atajo rápido para cambiar solo el estado desde la tabla,
// sin abrir el modal completo de edición.
window.editarEstado = async function (id) {
    try {
        if (!window.tienePermiso("auditorias", "editar")) {
            window.mostrarNotificacion
                ? window.mostrarNotificacion("Sin permisos", "No tiene permisos para editar auditorías.", "warning")
                : notifAlert("No tiene permisos.");
            return;
        }

        const nuevoEstado = await Notif.prompt("Seleccione el nuevo estado de la auditoría.", "Cambiar estado", null, ["Pendiente", "En proceso", "Finalizada"]);
        if (!nuevoEstado) return;

        const { error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .update({ estado: nuevoEstado })
            .eq("id", Number(id));

        if (error) {
            manejarErrorSupabase(error, "Error actualizando el estado.");
            return;
        }

        await registrarEvento(
            "EDITAR",
            `Se cambió el estado de la auditoría a "${nuevoEstado}".`,
            { popup: { titulo: "Estado actualizado", tipo: "success" } }
        );

        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Ocurrió un error actualizando el estado.");
    }
};


// ==========================================================
// 12. PERMISOS
// ==========================================================

function aplicarPermisosAuditorias() {
    if (!window.tienePermiso("auditorias", "crear") && btnGuardarAuditoria) {
        btnGuardarAuditoria.style.display = "none";
    }
}


// ==========================================================
// 13. INICIALIZACIÓN DEL MÓDULO
// ==========================================================

function cargarFechaActual() {
    const fecha = obtenerElemento("fechaInput");
    if (fecha && fecha.value === "") {
        fecha.value = new Date().toISOString().split("T")[0];
    }
}

window.iniciarRefreshAuditorias = function () {
    if (window.refreshAuditoriasInterval) {
        clearInterval(window.refreshAuditoriasInterval);
    }

    window.refreshAuditoriasInterval = setInterval(function () {
        if (obtenerElemento("auditoriasBody")) {
            window.cargarAuditorias();
        }
    }, 5000);
};

(function inicializarModuloAuditorias() {
    aplicarPermisosAuditorias();
    cargarFechaActual();
    renderDocumentos();
    window.cargarAuditorias();
    window.iniciarRefreshAuditorias();

    const buscarAuditoria = obtenerElemento("buscarAuditoria");
    if (buscarAuditoria) {
        buscarAuditoria.addEventListener("input", window.filtrarAuditorias);
    }
})();
