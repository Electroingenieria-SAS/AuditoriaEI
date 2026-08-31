// =====================================
// MÓDULO DE USUARIOS & PERMISOS - AUDIT ERP
// =====================================

// Limpieza de scopes globales anteriores
delete window.renderUsuarios;
delete window.editarUsuario;
delete window.eliminarUsuario;

// Lista de módulos base para construcción de permisos
const MODULOS_SISTEMA = ['inventario', 'recepcion', 'auditorias', 'usuarios', 'confiabilidad'];

// Sanitización de entradas (inputs)
function sanitizeText(str) {
  return String(str || '').replace(/[<>'"`;()]/g, '').trim();
}

// Helpers para selección rápida de switches
window.toggleAllPermisos = function(estado) {
  const switches = document.querySelectorAll('.permisos-grid input[type="checkbox"]');
  switches.forEach(sw => sw.checked = Boolean(estado));
};

// =====================================
// GUARDAR USUARIO
// =====================================
async function guardarUsuario() {
  try {
    if (typeof window.tienePermiso === 'function' && !window.tienePermiso('usuarios', 'crear')) {
      notifAlert('Acceso denegado: No cuenta con permisos de creación de usuarios.');
      return;
    }

    const usuarioInput = document.getElementById('usuarioInput');
    const passwordInput = document.getElementById('passwordInput');
    const rolSelect = document.getElementById('rolUsuario');

    if (!usuarioInput || !passwordInput || !rolSelect) {
      notifAlert('Error en la estructura del formulario');
      return;
    }

    const usuario = sanitizeText(usuarioInput.value.toLowerCase());
    const password = passwordInput.value.trim();
    const rol = rolSelect.value;

    if (!usuario || !password || !rol) {
      notifAlert('Por favor complete todos los campos requeridos');
      return;
    }

    if (!window.supabaseClient) {
      notifAlert('Error de conexión con la base de datos');
      return;
    }

    // 1. Validar existencia previa
    const { data: existente, error: errCheck } = await window.supabaseClient
      .from('usuarios')
      .select('id')
      .eq('usuario', usuario)
      .limit(1);

    if (errCheck) {
      console.error(errCheck);
      notifAlert('Error validando disponibilidad del identificador');
      return;
    }

    if (existente && existente.length > 0) {
      notifAlert('El identificador de usuario ya se encuentra registrado');
      return;
    }

    // 2. Insertar Usuario
    const { error: errInsertUser } = await window.supabaseClient
      .from('usuarios')
      .insert([{
        usuario: usuario,
        password: password,
        rol: rol,
        estado: 'Activo'
      }]);

    if (errInsertUser) {
      console.error(errInsertUser);
      notifAlert('Error insertando las credenciales del usuario');
      return;
    }

    // 3. Compilar Matriz de Permisos
    const permisosPayload = MODULOS_SISTEMA.map(modulo => {
      const getVal = (action) => {
        const el = document.getElementById(`${modulo}${action}`);
        return el ? el.checked : false;
      };

      return {
        usuario: usuario,
        modulo: modulo,
        ver: getVal('Ver'),
        crear: getVal('Crear'),
        editar: getVal('Editar'),
        eliminar: getVal('Eliminar')
      };
    });

    const { error: errPermisos } = await window.supabaseClient
      .from('permisos')
      .insert(permisosPayload);

    if (errPermisos) {
      console.error(errPermisos);
      notifAlert('Usuario creado, pero hubo un error asignando su matriz de permisos');
    }

    // 4. Auditoría / Historial
    if (typeof guardarHistorial === 'function') {
      await guardarHistorial(
        'CREAR',
        'USUARIOS',
        `Se registró la identidad ${usuario} con rol ${rol.toUpperCase()}`
      );
    }

    window.renderUsuarios();
    limpiarFormulario();
    notifAlert('Identidad y privilegios configurados exitosamente');

  } catch (error) {
    console.error('Error general en guardarUsuario:', error);
    notifAlert('Ocurrió un error inesperado al procesar la solicitud');
  }
}

// =====================================
// RENDERIZAR TABLA DE USUARIOS
// =====================================
window.renderUsuarios = async function() {
  const body = document.getElementById('usuariosBody');
  if (!body) return;

  body.innerHTML = `
    <tr>
      <td colspan="4" style="text-align: center; color: #64748b; padding: 25px;">
        Sincronizando directorio de usuarios...
      </td>
    </tr>`;

  try {
    if (!window.supabaseClient) return;

    const { data, error } = await window.supabaseClient
      .from('usuarios')
      .select('id, usuario, rol, estado')
      .order('id', { ascending: false });

    if (error) {
      console.error(error);
      body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar usuarios</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 25px;">No hay identidades registradas en el sistema</td></tr>`;
      return;
    }

    const puedeEditar = typeof window.tienePermiso === 'function' ? window.tienePermiso('usuarios', 'editar') : true;
    const puedeEliminar = typeof window.tienePermiso === 'function' ? window.tienePermiso('usuarios', 'eliminar') : true;

    body.innerHTML = data.map(item => {
      const isActivo = item.estado === 'Activo';
      const initial = (item.usuario || 'U').charAt(0).toUpperCase();

      return `
        <tr>
          <td>
            <div class="user-identity">
              <div class="user-avatar-mini">${initial}</div>
              <span>${item.usuario || '-'}</span>
            </div>
          </td>
          <td>
            <span class="role-pill">${item.rol || 'Sin Rol'}</span>
          </td>
          <td>
            <span class="badge-status ${isActivo ? 'status-active' : 'status-inactive'}">
              ● ${item.estado || 'Activo'}
            </span>
          </td>
          <td class="text-right">
            <div class="acciones-flex">
              ${puedeEditar ? `<button class="btn-action-tech edit" onclick="editarUsuario(${item.id})">Editar</button>` : ''}
              ${puedeEliminar ? `<button class="btn-action-tech delete" onclick="eliminarUsuario(${item.id})">Eliminar</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('Error renderUsuarios:', error);
  }
};

// =====================================
// EDITAR USUARIO
// =====================================
window.editarUsuario = async function(id) {
  try {
    if (typeof window.tienePermiso === 'function' && !window.tienePermiso('usuarios', 'editar')) {
      notifAlert('Acceso denegado: No cuenta con permisos de edición');
      return;
    }

    const { data: usuario, error } = await window.supabaseClient
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !usuario) {
      notifAlert('No fue posible consultar los datos del usuario');
      return;
    }

    const nuevaPassword = await Notif.prompt(
      'Ingrese la nueva contraseña (o conserve la actual):',
      'Actualizar Credenciales',
      usuario.password || ''
    );
    if (nuevaPassword === null) return;

    const nuevoRol = await Notif.prompt(
      'Seleccione el rol correspondiente:',
      'Asignar Privilegio',
      usuario.rol,
      ['admin', 'lider', 'jefe', 'auditor', 'compras']
    );
    if (!nuevoRol) return;

    const nuevoEstado = await Notif.prompt(
      'Estado operativo de la cuenta:',
      'Estado de Identidad',
      usuario.estado || 'Activo',
      ['Activo', 'Inactivo']
    );
    if (!nuevoEstado) return;

    const { error: errUpdate } = await window.supabaseClient
      .from('usuarios')
      .update({
        password: nuevaPassword.trim(),
        rol: nuevoRol,
        estado: nuevoEstado
      })
      .eq('id', id);

    if (errUpdate) {
      console.error(errUpdate);
      notifAlert('Error al intentar actualizar la identidad');
      return;
    }

    if (typeof guardarHistorial === 'function') {
      await guardarHistorial('EDITAR', 'USUARIOS', `Se modificaron los atributos del usuario ${usuario.usuario}`);
    }

    window.renderUsuarios();
    notifAlert('Identidad actualizada correctamente');

  } catch (error) {
    console.error('Error editarUsuario:', error);
  }
};

// =====================================
// ELIMINAR USUARIO
// =====================================
window.eliminarUsuario = async function(id) {
  try {
    if (typeof window.tienePermiso === 'function' && !window.tienePermiso('usuarios', 'eliminar')) {
      notifAlert('Acceso denegado: No cuenta con permisos para eliminar identidades');
      return;
    }

    const confirmar = await Notif.confirm(
      'Se revocarán todos los accesos y se eliminarán sus registros de permisos.',
      '¿Eliminar usuario permanentemente?'
    );
    if (!confirmar) return;

    const { data: usuario } = await window.supabaseClient
      .from('usuarios')
      .select('usuario')
      .eq('id', id)
      .single();

    const { error: errDelete } = await window.supabaseClient
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (errDelete) {
      console.error(errDelete);
      notifAlert('Error eliminando el usuario');
      return;
    }

    if (usuario && usuario.usuario) {
      // Limpiar permisos asociados
      await window.supabaseClient
        .from('permisos')
        .delete()
        .eq('usuario', usuario.usuario);

      if (typeof guardarHistorial === 'function') {
        await guardarHistorial('ELIMINAR', 'USUARIOS', `Se revocó y eliminó al usuario ${usuario.usuario}`);
      }
    }

    window.renderUsuarios();
    notifAlert('Usuario y credenciales eliminadas del sistema');

  } catch (error) {
    console.error('Error eliminarUsuario:', error);
  }
};

// =====================================
// BUSCADOR EN TIEMPO REAL
// =====================================
const buscarInput = document.getElementById('buscarUsuario');
if (buscarInput) {
  buscarInput.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#usuariosBody tr');

    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

// =====================================
// LIMPIEZA DE FORMULARIO
// =====================================
function limpiarFormulario() {
  const u = document.getElementById('usuarioInput');
  const p = document.getElementById('passwordInput');
  const r = document.getElementById('rolUsuario');

  if (u) u.value = '';
  if (p) p.value = '';
  if (r) r.value = 'auditor';

  window.toggleAllPermisos(false);
}

// Event Listeners e Inicialización
const btnGuardar = document.getElementById('guardarUsuario');
if (btnGuardar) {
  btnGuardar.addEventListener('click', guardarUsuario);
}

window.renderUsuarios();
