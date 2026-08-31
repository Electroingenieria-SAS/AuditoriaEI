// ==========================================================
// AUDITORIAS.JS — Versión Robusta, Segura y Optimizada
// ==========================================================

// 1. LIMPIEZA / BOOTSTRAP
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
    "eliminarDocumentoTemporal",
    "eliminarDocumentoEdicionTemporal",
    "eliminarDocumentoAuditoria"
].forEach(nombre => delete window[nombre]);

// 2. ESTADO INTERNO DEL MÓDULO
const AUDITORIAS_BUCKET = "auditorias";
const AUDITORIAS_TABLA = "auditorias";
const DOCUMENTOS_TABLA = "auditoria_documentos";
const ADJUNTOS_AUDITORIA = window.AdjuntosCommon;
const PREFIJO_DRIVE = "drive::";

let auditoriasCache = [];
let documentosSeleccionados = [];
let documentosEdicionSeleccionados = [];
let auditoriaDocumentosModalId = null;
let auditoriaEnEdicion = null;
window.documentosAuditoriaModalCache = {};

// 3. UTILIDADES GENÉRICAS
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

// Sanitización XSS
function escaparHTML(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obtenerExtension(nombreArchivo) {
    return ADJUNTOS_AUDITORIA
        ? ADJUNTOS_AUDITORIA.obtenerExtension(nombreArchivo)
        : String(nombreArchivo || "").split(".").pop().toLowerCase();
}

function esRutaDrive(ruta) {
    return String(ruta || "").startsWith(PREFIJO_DRIVE);
}

function obtenerUrlDrive(ruta) {
    return esRutaDrive(ruta) ? String(ruta).slice(PREFIJO_DRIVE.length) : "";
}

function notificar(titulo, mensaje, tipo = "warning") {
    if (typeof window.mostrarNotificacion === "function") {
        window.mostrarNotificacion(titulo, mensaje, tipo);
    } else if (typeof notifAlert === "function") {
        notifAlert(mensaje);
    } else {
        alert(`${titulo}: ${mensaje}`);
    }
}

function formatearFecha(fecha) {
    if (!fecha) return "-";
    const [y, m, d] = String(fecha).split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return new Date(fecha).toLocaleDateString("es-CO");
}

function obtenerFechaLocal() {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, "0");
    const day = String(ahora.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

function configurarCierreModal(modalId, botonCerrarId) {
    const modal = obtenerElemento(modalId);
    const boton = obtenerElemento(botonCerrarId);

    if (boton) {
        boton.onclick = () => cerrarModal(modalId);
    }

    if (modal) {
        modal.onclick = function (e) {
            if (e.target === modal) cerrarModal(modalId);
        };
    }
}

function manejarErrorSupabase(error, mensajeUsuario) {
    console.error(error);
    notificar("Error de Operación", mensajeUsuario || error?.message || "Error inesperado", "error");
}

// 4. HISTORIAL Y AUDITORÍA
async function registrarEvento(accion, descripcion, opciones = {}) {
    try {
        if (typeof window.guardarHistorial === "function") {
            await window.guardarHistorial(accion, "AUDITORIAS", descripcion);
        }
        if (typeof window.crearNotificacion === "function") {
            window.crearNotificacion(opciones.mensajeCampana || descripcion);
        }
        if (opciones.popup) {
            notificar(opciones.popup.titulo || "Auditorías", descripcion, opciones.popup.tipo || "success");
        }
    } catch (error) {
        console.error("Fallo registrando historial:", error);
    }
}

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

    campos.forEach(c => {
        const vAnt = (anterior[c.clave] || "").toString().trim();
        const vNue = (nuevo[c.clave] || "").toString().trim();
        if (vAnt !== vNue) cambios.push(`Se modificó ${c.etiqueta}.`);
    });

    if ((anterior.estado || "") !== (nuevo.estado || "")) {
        cambios.push(`Se cambió el estado de "${anterior.estado}" a "${nuevo.estado}".`);
    }

    if (huboDocumentoNuevo) {
        cambios.push("Se agregaron nuevos soportes documentales.");
    }

    return cambios;
}

// 5. DOCUMENTOS Y GESTIÓN TEMPORAL
function agregarArchivosALista(archivos, destino, renderCallback) {
    const maxAdjuntos = ADJUNTOS_AUDITORIA?.MAX_ADJUNTOS || 10;

    for (const archivo of Array.from(archivos || [])) {
        if (destino.length >= maxAdjuntos) {
            notificar("Límite de soportes", `Solo puede adjuntar hasta ${maxAdjuntos} soportes.`);
            break;
        }

        if (ADJUNTOS_AUDITORIA) {
            const validacion = ADJUNTOS_AUDITORIA.validarArchivo(archivo);
            if (!validacion.valido) {
                notificar("Archivo inválido", validacion.mensaje);
                continue;
            }
        }

        const duplicado = destino.some(item => 
            item.tipo === "archivo" &&
            item.archivo.name === archivo.name &&
            item.archivo.size === archivo.size
        );

        if (!duplicado) {
            destino.push({
                tipo: "archivo",
                archivo,
                nombre: archivo.name,
                mime: archivo.type || "",
                tamano: archivo.size
            });
        }
    }
    renderCallback();
}

function agregarDriveALista(input, destino, renderCallback) {
    if (!input) return;
    const maxAdjuntos = ADJUNTOS_AUDITORIA?.MAX_ADJUNTOS || 10;
    if (destino.length >= maxAdjuntos) {
        notificar("Límite de soportes", `Solo puede adjuntar hasta ${maxAdjuntos} soportes.`);
        return;
    }

    const url = ADJUNTOS_AUDITORIA ? ADJUNTOS_AUDITORIA.normalizarDriveUrl(input.value) : input.value.trim();
    if (!url || !url.startsWith("https://")) {
        notificar("Enlace inválido", "Pegue un enlace válido de Google Drive/Docs que empiece por https://");
        return;
    }

    if (destino.some(i => i.url === url)) {
        notificar("Duplicado", "El enlace ya está en la lista.");
        return;
    }

    destino.push({
        tipo: "drive",
        nombre: ADJUNTOS_AUDITORIA ? ADJUNTOS_AUDITORIA.nombreEnlaceDrive(url, destino.length + 1) : `Enlace Drive #${destino.length + 1}`,
        url,
        mime: "text/uri-list",
        tamano: 0
    });

    input.value = "";
    renderCallback();
}

function htmlSoporteTemporal(soporte, index, funcionEliminar) {
    const visual = ADJUNTOS_AUDITORIA ? ADJUNTOS_AUDITORIA.tipoVisual(soporte) : { icono: "📄", etiqueta: "Archivo" };
    const meta = soporte.tipo === "drive"
        ? "Google Drive"
        : `${visual.etiqueta} · ${ADJUNTOS_AUDITORIA ? ADJUNTOS_AUDITORIA.formatearTamano(soporte.tamano) : (soporte.tamano + ' bytes')}`;

    return `
        <div class="adjunto-item">
            <div class="adjunto-item__info">
                <span class="adjunto-item__icono">${visual.icono}</span>
                <div class="adjunto-item__texto">
                    <span class="adjunto-item__nombre">${escaparHTML(soporte.nombre)}</span>
                    <span class="adjunto-item__meta">${escaparHTML(meta)}</span>
                </div>
            </div>
            <div class="adjunto-item__acciones">
                <button type="button" class="adjunto-btn adjunto-btn--eliminar" onclick="${funcionEliminar}(${index})">Quitar</button>
            </div>
        </div>`;
}

function renderDocumentos() {
    const lista = obtenerElemento("listaDocumentos");
    const contador = obtenerElemento("contadorDocumentosAuditoria");
    const maxAdjuntos = ADJUNTOS_AUDITORIA?.MAX_ADJUNTOS || 10;

    if (contador) contador.textContent = `${documentosSeleccionados.length} / ${maxAdjuntos}`;
    if (!lista) return;

    lista.innerHTML = documentosSeleccionados.length
        ? documentosSeleccionados.map((doc, idx) => htmlSoporteTemporal(doc, idx, "eliminarDocumentoTemporal")).join("")
        : '<div class="documento-vacio">📄 Ningún soporte agregado.</div>';
}

window.eliminarDocumentoTemporal = function (index) {
    documentosSeleccionados.splice(Number(index), 1);
    renderDocumentos();
};

function renderDocumentosEdicion() {
    const lista = obtenerElemento("listaDocumentosEdicion");
    const contador = obtenerElemento("contadorDocumentosEdicion");
    if (contador) contador.textContent = `${documentosEdicionSeleccionados.length} nuevos`;
    if (!lista) return;

    lista.innerHTML = documentosEdicionSeleccionados.length
        ? documentosEdicionSeleccionados.map((doc, idx) => htmlSoporteTemporal(doc, idx, "eliminarDocumentoEdicionTemporal")).join("")
        : '<div class="adjunto-vacio">No hay soportes nuevos seleccionados.</div>';
}

window.eliminarDocumentoEdicionTemporal = function (index) {
    documentosEdicionSeleccionados.splice(Number(index), 1);
    renderDocumentosEdicion();
};

function limpiarDocumentos() {
    documentosSeleccionados = [];
    const driveInput = obtenerElemento("driveLinkAuditoria");
    if (driveInput) driveInput.value = "";
    renderDocumentos();
}

function limpiarDocumentosEdicion() {
    documentosEdicionSeleccionados = [];
    const inputArchivo = obtenerElemento("editarDocumento");
    const inputDrive = obtenerElemento("driveLinkEdicionAuditoria");
    if (inputArchivo) inputArchivo.value = "";
    if (inputDrive) inputDrive.value = "";
    renderDocumentosEdicion();
}

// 6. STORAGE Y SUBIDAS PARALELAS
function generarRutaStorage(auditoriaId, nombreArchivo) {
    const limpio = String(nombreArchivo || "soporte")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
    const identificador = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `${auditoriaId}/${identificador}_${limpio}`;
}

async function subirDocumentoIndividual(auditoriaId, soporte) {
    if (soporte.tipo === "drive") {
        return window.supabaseClient
            .from(DOCUMENTOS_TABLA)
            .insert([{
                auditoria_id: auditoriaId,
                nombre_archivo: soporte.nombre,
                ruta_storage: PREFIJO_DRIVE + soporte.url,
                tipo_archivo: "DRIVE",
                tamano: 0
            }])
            .select()
            .single();
    }

    const archivo = soporte.archivo || soporte;
    const rutaStorage = generarRutaStorage(auditoriaId, archivo.name);
    
    const subida = await window.supabaseClient.storage
        .from(AUDITORIAS_BUCKET)
        .upload(rutaStorage, archivo, { upsert: false, contentType: archivo.type || undefined });

    if (subida.error) return { error: subida.error };

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
        await window.supabaseClient.storage.from(AUDITORIAS_BUCKET).remove([rutaStorage]);
        return { error: registro.error };
    }

    return { data: registro.data };
}

async function agregarSoportesDirectos(auditoriaId, soportes) {
    const { count, error } = await window.supabaseClient
        .from(DOCUMENTOS_TABLA)
        .select("id", { count: "exact", head: true })
        .eq("auditoria_id", auditoriaId);

    if (error) return { error };

    const maxAdjuntos = ADJUNTOS_AUDITORIA?.MAX_ADJUNTOS || 10;
    if ((count || 0) + soportes.length > maxAdjuntos) {
        return { error: new Error(`La auditoría excede el límite máximo de ${maxAdjuntos} soportes.`) };
    }

    // Subida en paralelo para máxima velocidad
    const promesas = soportes.map(soporte => subirDocumentoIndividual(auditoriaId, soporte));
    const resultados = await Promise.all(promesas);

    const fallos = resultados.filter(r => r.error);
    if (fallos.length > 0) {
        const exitosos = resultados.filter(r => r.data).map(r => r.data);
        if (exitosos.length) await eliminarDocumentos(exitosos);
        return { error: fallos[0].error };
    }

    return { data: resultados.map(r => r.data) };
}

async function obtenerDocumentosDeAuditoria(auditoriaId) {
    return window.supabaseClient
        .from(DOCUMENTOS_TABLA)
        .select("*")
        .eq("auditoria_id", auditoriaId)
        .order("id");
}

async function eliminarDocumentos(documentos) {
    if (!documentos || documentos.length === 0) return;

    const rutas = documentos
        .map(d => d.ruta_storage)
        .filter(ruta => ruta && !esRutaDrive(ruta));

    if (rutas.length) {
        await window.supabaseClient.storage.from(AUDITORIAS_BUCKET).remove(rutas);
    }

    const ids = documentos.map(d => d.id);
    await window.supabaseClient.from(DOCUMENTOS_TABLA).delete().in("id", ids);
}

// 7. CRUD PRINCIPAL (Creación y Renderizado)
async function guardarAuditoria() {
    const btnGuardar = obtenerElemento("guardarAuditoria");

    try {
        if (!window.tienePermiso?.("auditorias", "crear")) {
            notificar("Sin permisos", "No tiene permisos para crear auditorías.", "warning");
            return;
        }

        const tipo = obtenerValor("tipoInput");
        const nombre = obtenerValor("nombreInput").trim();
        const proceso = obtenerValor("procesoInput").trim();
        const responsable = obtenerValor("responsableInput").trim();
        const estado = obtenerValor("estadoInput") || "Pendiente";
        const fecha = obtenerValor("fechaInput");
        const observaciones = obtenerValor("observacionesInput").trim();

        if (!tipo || !nombre || !proceso || !responsable || !fecha) {
            notificar("Datos incompletos", "Complete todos los campos obligatorios.", "warning");
            return;
        }

        const minAdjuntos = ADJUNTOS_AUDITORIA?.MIN_ADJUNTOS || 1;
        if (documentosSeleccionados.length < minAdjuntos) {
            notificar("Soportes requeridos", `Debe agregar mínimo ${minAdjuntos} soporte para crear la auditoría.`);
            return;
        }

        if (btnGuardar) btnGuardar.disabled = true;

        // 1. Insertar auditoría
        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .insert([{ tipo, nombre, proceso, responsable, estado, fecha, observaciones }])
            .select()
            .single();

        if (error) {
            manejarErrorSupabase(error, "Error guardando la auditoría.");
            return;
        }

        // 2. Subir soportes
        const resSoportes = await agregarSoportesDirectos(data.id, documentosSeleccionados);
        if (resSoportes.error) {
            await window.supabaseClient.from(AUDITORIAS_TABLA).delete().eq("id", data.id);
            manejarErrorSupabase(resSoportes.error, "Error guardando soportes: " + resSoportes.error.message);
            return;
        }

        await registrarEvento("CREAR", `Nueva auditoría registrada: ${nombre}.`, {
            popup: { titulo: "Auditoría Creada", tipo: "success" }
        });

        limpiarFormulario();
        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Ocurrió un error general.");
    } finally {
        if (btnGuardar) btnGuardar.disabled = false;
    }
}

function limpiarFormulario() {
    asignarValor("tipoInput", "");
    asignarValor("nombreInput", "");
    asignarValor("procesoInput", "");
    asignarValor("responsableInput", "");
    asignarValor("estadoInput", "Pendiente");
    asignarValor("fechaInput", obtenerFechaLocal());
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

        // No sobreescribir la tabla si el usuario está realizando una búsqueda
        const buscarInput = obtenerElemento("buscarAuditoria");
        if (buscarInput && buscarInput.value.trim() !== "") {
            window.filtrarAuditorias();
        } else {
            window.renderAuditorias(auditoriasCache);
        }
    } catch (error) {
        console.error(error);
    }
};

window.renderAuditorias = function (lista = auditoriasCache) {
    const body = obtenerElemento("auditoriasBody");
    if (!body) return;

    if (!lista || lista.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#64748b;">No existen auditorías registradas.</td></tr>`;
        return;
    }

    const puedeEditar = window.tienePermiso?.("auditorias", "editar");
    const puedeEliminar = window.tienePermiso?.("auditorias", "eliminar");

    body.innerHTML = lista.map(item => `
        <tr>
            <td>${escaparHTML(item.tipo)}</td>
            <td><strong>${escaparHTML(item.nombre)}</strong></td>
            <td>${escaparHTML(item.responsable)}</td>
            <td><span class="${claseEstado(item.estado)}">${escaparHTML(item.estado)}</span></td>
            <td>${formatearFecha(item.fecha)}</td>
            <td>
                <div class="acciones-tabla">
                    <button class="btn-ver" title="Ver detalle" onclick="verDetalleAuditoria(${item.id})">👁️</button>
                    <button class="btn-primary" title="Documentos" onclick="verDocumentos(${item.id})">📁</button>
                    ${puedeEditar ? `<button class="btn-editar" title="Editar" onclick="abrirEditarAuditoria(${item.id})">✏️</button>` : ""}
                    ${puedeEliminar ? `<button class="btn-eliminar" title="Eliminar" onclick="eliminarAuditoria(${item.id})">🗑️</button>` : ""}
                </div>
            </td>
        </tr>
    `).join("");
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
    const resultado = auditoriasCache.filter(item => 
        campos.some(campo => String(item[campo] || "").toLowerCase().includes(texto))
    );

    window.renderAuditorias(resultado);
};

// 8. MODAL VER DOCUMENTOS
window.verDocumentos = async function (id) {
    try {
        const lista = obtenerElemento("listaDocumentosModal");
        const contador = obtenerElemento("contadorDocumentosModal");
        if (!lista) return;

        auditoriaDocumentosModalId = Number(id);
        lista.innerHTML = '<div class="adjunto-vacio">Cargando soportes...</div>';

        const { data, error } = await obtenerDocumentosDeAuditoria(id);
        if (error) {
            manejarErrorSupabase(error, "Error al consultar los soportes.");
            return;
        }

        const documentos = data || [];
        window.documentosAuditoriaModalCache = {};
        documentos.forEach(doc => { window.documentosAuditoriaModalCache[doc.id] = doc; });

        if (contador) contador.textContent = `${documentos.length} / ${ADJUNTOS_AUDITORIA?.MAX_ADJUNTOS || 10}`;

        const puedeEditar = window.tienePermiso?.("auditorias", "editar");
        const panelAgregar = obtenerElemento("btnAgregarArchivoModal")?.closest(".adjuntos-panel");
        if (panelAgregar) panelAgregar.style.display = puedeEditar ? "grid" : "none";

        if (documentos.length === 0) {
            lista.innerHTML = '<div class="adjunto-vacio">No existen soportes adjuntos.</div>';
        } else {
            lista.innerHTML = documentos.map(doc => {
                const esDrive = esRutaDrive(doc.ruta_storage);
                const mime = String(doc.tipo_archivo || "").toLowerCase();
                const visual = ADJUNTOS_AUDITORIA 
                    ? ADJUNTOS_AUDITORIA.tipoVisual({ tipo: esDrive ? "drive" : "archivo", mime, nombre: doc.nombre_archivo, tamano: doc.tamano })
                    : { icono: esDrive ? "🔗" : "📄", etiqueta: doc.tipo_archivo };

                const meta = esDrive ? "Google Drive" : `${visual.etiqueta}${doc.tamano ? " · " + (ADJUNTOS_AUDITORIA?.formatearTamano(doc.tamano) || '') : ""}`;

                return `
                    <div class="adjunto-item">
                        <div class="adjunto-item__info">
                            <span class="adjunto-item__icono">${visual.icono}</span>
                            <div class="adjunto-item__texto">
                                <span class="adjunto-item__nombre">${escaparHTML(doc.nombre_archivo)}</span>
                                <span class="adjunto-item__meta">${escaparHTML(meta)}</span>
                            </div>
                        </div>
                        <div class="adjunto-item__acciones">
                            <button type="button" class="adjunto-btn adjunto-btn--abrir" onclick="descargarDocumento(${doc.id})">Abrir</button>
                            ${puedeEditar ? `<button type="button" class="adjunto-btn adjunto-btn--eliminar" onclick="eliminarDocumentoAuditoria(${doc.id}, ${Number(id)})">Eliminar</button>` : ""}
                        </div>
                    </div>`;
            }).join("");
        }

        abrirModal("modalDocumentos");
    } catch (error) {
        manejarErrorSupabase(error, "Error consultando soportes.");
    }
};

window.descargarDocumento = async function (documentoId) {
    try {
        const doc = window.documentosAuditoriaModalCache[Number(documentoId)];
        if (!doc) {
            notificar("No encontrado", "No se localizó el documento seleccionado.");
            return;
        }

        if (esRutaDrive(doc.ruta_storage)) {
            window.open(obtenerUrlDrive(doc.ruta_storage), "_blank", "noopener,noreferrer");
            return;
        }

        const { data, error } = await window.supabaseClient.storage
            .from(AUDITORIAS_BUCKET)
            .createSignedUrl(doc.ruta_storage, 300);

        if (error) {
            manejarErrorSupabase(error, "No fue posible generar el enlace seguro.");
            return;
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
        manejarErrorSupabase(error, "Error al abrir el soporte.");
    }
};

window.eliminarDocumentoAuditoria = async function (documentoId, auditoriaId) {
    try {
        if (!window.tienePermiso?.("auditorias", "editar")) {
            notificar("Sin permisos", "No tiene permisos para eliminar soportes.");
            return;
        }

        const { count } = await window.supabaseClient
            .from(DOCUMENTOS_TABLA)
            .select("id", { count: "exact", head: true })
            .eq("auditoria_id", auditoriaId);

        const minAdjuntos = ADJUNTOS_AUDITORIA?.MIN_ADJUNTOS || 1;
        if ((count || 0) <= minAdjuntos) {
            notificar("Operación cancelada", `La auditoría debe conservar al menos ${minAdjuntos} soporte.`);
            return;
        }

        const doc = window.documentosAuditoriaModalCache[Number(documentoId)];
        if (!doc) return;

        const confirmar = window.Notif?.confirm 
            ? await window.Notif.confirm("El soporte se eliminará permanentemente.", "¿Eliminar soporte?")
            : window.confirm("¿Eliminar soporte definitivamente?");
        if (!confirmar) return;

        await eliminarDocumentos([doc]);
        await registrarEvento("ELIMINAR", `Se eliminó el soporte “${doc.nombre_archivo}” de la auditoría #${auditoriaId}.`);
        await window.verDocumentos(auditoriaId);
    } catch (error) {
        manejarErrorSupabase(error, "Error al eliminar el soporte.");
    }
};

// 9. EDICIÓN INTEGRAL DE AUDITORÍAS
window.abrirEditarAuditoria = async function (id) {
    try {
        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) {
            manejarErrorSupabase(error, "No fue posible cargar la auditoría.");
            return;
        }

        auditoriaEnEdicion = data;

        asignarValor("editarAuditoriaId", data.id);
        asignarValor("editarTipo", data.tipo);
        asignarValor("editarNombre", data.nombre);
        asignarValor("editarResponsable", data.responsable);
        asignarValor("editarProceso", data.proceso);
        asignarValor("editarEstado", data.estado);
        asignarValor("editarFecha", data.fecha);
        asignarValor("editarObservaciones", data.observaciones || "");

        limpiarDocumentosEdicion();
        abrirModal("modalEditarAuditoria");
    } catch (error) {
        console.error(error);
    }
};

async function guardarCambiosAuditoria() {
    if (!auditoriaEnEdicion) return;
    const btnGuardar = obtenerElemento("guardarEdicionAuditoria");

    if (btnGuardar) btnGuardar.disabled = true;

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

        if (!datosNuevos.tipo || !datosNuevos.nombre || !datosNuevos.proceso || !datosNuevos.responsable || !datosNuevos.fecha) {
            notificar("Datos incompletos", "Complete todos los campos obligatorios.", "warning");
            return;
        }

        // 1. Actualizar datos en BD
        const { error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .update(datosNuevos)
            .eq("id", id);

        if (error) {
            manejarErrorSupabase(error, "Error actualizando la auditoría.");
            return;
        }

        // 2. Subir soportes si se agregaron nuevos
        if (documentosEdicionSeleccionados.length > 0) {
            const resSoportes = await agregarSoportesDirectos(id, documentosEdicionSeleccionados);
            if (resSoportes.error) {
                manejarErrorSupabase(resSoportes.error, "Error subiendo soportes: " + resSoportes.error.message);
                return;
            }
        }

        // 3. Historial de cambios
        const cambios = generarCambios(auditoriaEnEdicion, datosNuevos, documentosEdicionSeleccionados.length > 0);
        if (cambios.length) {
            for (const c of cambios) {
                await registrarEvento("EDITAR", `${c} (Auditoría: ${datosNuevos.nombre})`);
            }
        }

        notificar("Actualización Exitosa", "Auditoría modificada correctamente.", "success");

        cerrarModal("modalEditarAuditoria");
        limpiarDocumentosEdicion();
        auditoriaEnEdicion = null;
        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Error editando auditoría.");
    } finally {
        if (btnGuardar) btnGuardar.disabled = false;
    }
}

// 10. DETALLE DE AUDITORÍA
window.verDetalleAuditoria = async function (id) {
    try {
        const { data, error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) {
            manejarErrorSupabase(error, "No fue posible cargar el detalle.");
            return;
        }

        const setText = (elId, val) => {
            const el = obtenerElemento(elId);
            if (el) el.textContent = val || "-";
        };

        setText("detalleTipo", data.tipo);
        setText("detalleEstado", data.estado);
        setText("detalleNombre", data.nombre);
        setText("detalleResponsable", data.responsable);
        setText("detalleProceso", data.proceso);
        setText("detalleFecha", formatearFecha(data.fecha));
        setText("detalleObservaciones", data.observaciones || "Sin observaciones registradas.");

        const estadoEl = obtenerElemento("detalleEstado");
        if (estadoEl) {
            estadoEl.className = "";
            estadoEl.classList.add(claseEstado(data.estado));
        }

        abrirModal("modalDetalleAuditoria");
    } catch (error) {
        manejarErrorSupabase(error, "Error consultando detalle.");
    }
};

// 11. ELIMINACIÓN Y CAMBIO RÁPIDO DE ESTADO
window.eliminarAuditoria = async function (id) {
    try {
        if (!window.tienePermiso?.("auditorias", "eliminar")) {
            notificar("Sin permisos", "No tiene permisos para eliminar auditorías.", "warning");
            return;
        }

        const confirmar = window.Notif?.confirm
            ? await window.Notif.confirm("Se eliminarán los registros y todos los documentos asociados.", "¿Eliminar auditoría?")
            : window.confirm("¿Eliminar auditoría y todos sus documentos?");

        if (!confirmar) return;

        const { data: documentos } = await obtenerDocumentosDeAuditoria(id);
        await eliminarDocumentos(documentos);

        const { error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .delete()
            .eq("id", Number(id));

        if (error) {
            manejarErrorSupabase(error, "Error eliminando el registro.");
            return;
        }

        await registrarEvento("ELIMINAR", "Se eliminó una auditoría.", {
            popup: { titulo: "Auditoría Eliminada", tipo: "success" }
        });

        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Error al eliminar la auditoría.");
    }
};

window.editarEstado = async function (id) {
    try {
        if (!window.tienePermiso?.("auditorias", "editar")) {
            notificar("Sin permisos", "No tiene permisos para editar estado.", "warning");
            return;
        }

        const nuevoEstado = window.Notif?.prompt 
            ? await window.Notif.prompt("Seleccione el estado:", "Cambiar Estado", null, ["Pendiente", "En proceso", "Finalizada"])
            : prompt("Ingrese nuevo estado (Pendiente, En proceso, Finalizada):");

        if (!nuevoEstado) return;

        const { error } = await window.supabaseClient
            .from(AUDITORIAS_TABLA)
            .update({ estado: nuevoEstado })
            .eq("id", Number(id));

        if (error) {
            manejarErrorSupabase(error, "Error actualizando el estado.");
            return;
        }

        await registrarEvento("EDITAR", `Se actualizó el estado a "${nuevoEstado}".`, {
            popup: { titulo: "Estado Actualizado", tipo: "success" }
        });

        await window.cargarAuditorias();
    } catch (error) {
        manejarErrorSupabase(error, "Error actualizando estado.");
    }
};

// 12. INICIALIZADOR Y EVENT LISTENERS (Centralizados)
window.iniciarRefreshAuditorias = function () {
    if (window.refreshAuditoriasInterval) clearInterval(window.refreshAuditoriasInterval);
    window.refreshAuditoriasInterval = setInterval(() => {
        if (obtenerElemento("auditoriasBody")) {
            window.cargarAuditorias();
        }
    }, 6000);
};

(function init() {
    // Configurar modales
    configurarCierreModal("modalDocumentos", "cerrarModalDocumentos");
    configurarCierreModal("modalEditarAuditoria", "cerrarEditarAuditoria");
    configurarCierreModal("modalDetalleAuditoria", "cerrarDetalleAuditoria");

    // Asignar listeners de creación
    const btnGuardar = obtenerElemento("guardarAuditoria");
    if (btnGuardar) btnGuardar.onclick = guardarAuditoria;

    const btnDoc = obtenerElemento("btnAgregarDocumento");
    const docInput = obtenerElemento("documentoInput");
    if (btnDoc && docInput) {
        btnDoc.onclick = () => docInput.click();
        docInput.onchange = (e) => {
            agregarArchivosALista(e.target.files, documentosSeleccionados, renderDocumentos);
            e.target.value = "";
        };
    }

    const btnDrive = obtenerElemento("btnAgregarDriveAuditoria");
    const driveInput = obtenerElemento("driveLinkAuditoria");
    if (btnDrive && driveInput) {
        btnDrive.onclick = () => agregarDriveALista(driveInput, documentosSeleccionados, renderDocumentos);
        driveInput.onkeydown = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                agregarDriveALista(driveInput, documentosSeleccionados, renderDocumentos);
            }
        };
    }

    // Listeners de edición
    const btnGuardarEdit = obtenerElemento("guardarEdicionAuditoria");
    if (btnGuardarEdit) btnGuardarEdit.onclick = guardarCambiosAuditoria;

    // Buscador
    const buscarAuditoria = obtenerElemento("buscarAuditoria");
    if (buscarAuditoria) {
        buscarAuditoria.oninput = window.filtrarAuditorias;
    }

    // Estado inicial
    const fechaInput = obtenerElemento("fechaInput");
    if (fechaInput && !fechaInput.value) {
        fechaInput.value = obtenerFechaLocal();
    }

    renderDocumentos();
    renderDocumentosEdicion();
    window.cargarAuditorias();
    window.iniciarRefreshAuditorias();
})();
