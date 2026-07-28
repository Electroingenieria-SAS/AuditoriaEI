if (!window.supabase) {
notifAlert('Error cargando Supabase');
throw new Error('Supabase no cargó correctamente');
}

const supabaseUrl =
'https://hurxdjoiafkjoyrmyhbd.supabase.co';

const supabaseKey =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnhkam9pYWZram95cm15aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzgxMTMsImV4cCI6MjA5NTMxNDExM30.Z6fRiWft3eSEVNZbWflmcvVcHAJTAEA37tPdp4LRnTg';

window.supabaseClient =
window.supabase.createClient(
supabaseUrl,
supabaseKey
);

const form =
document.getElementById('loginForm');

if(form){
form.addEventListener(
'submit',
login
);
}

async function login(e){

try{


e.preventDefault();

const usuarioInput =
document.getElementById(
  'usuario'
);

const passwordInput =
document.getElementById(
  'password'
);

if(
  !usuarioInput ||
  !passwordInput
){
  notifAlert(
    'Inputs no encontrados'
  );
  return;
}

const usuario =
usuarioInput.value
.trim()
.toLowerCase();

const password =
passwordInput.value
.trim();

if(
  !usuario ||
  !password
){
  notifAlert(
    'Complete todos los campos'
  );
  return;
}

const { data, error } =

await window.supabaseClient

.from('usuarios')

.select('*')

.eq(
  'usuario',
  usuario
)

.eq(
  'password',
  password
)

.limit(1);

if(error){
  console.log(error);
  notifAlert(
    'Error conectando con Supabase'
  );
  return;
}

if(
  !data ||
  data.length === 0
){
  notifAlert(
    'Usuario o contraseña incorrectos'
  );
  return;
}

const usuarioData =
data[0];

if(
  usuarioData.estado ===
  'Inactivo'
){
  notifAlert(
    'Usuario inactivo'
  );
  return;
}

localStorage.setItem(
  'usuarioLogueado',
  JSON.stringify(
    usuarioData
  )
);

window.mostrarBienvenida(
  usuarioData.usuario,
  usuarioData.rol
);


}

catch(error){


console.log(error);

notifAlert(
  'Error general en login'
);


}

}

window.mostrarBienvenida = function(usuario, rol){

document.getElementById(
'bienvenidaUsuario'
).innerText = usuario;

document.getElementById(
'bienvenidaRol'
).innerText = rol;

document.getElementById(
'modalBienvenida'
).style.display =
'flex';

};

window.cerrarModalBienvenida = function(){

document.getElementById(
'modalBienvenida'
).style.display =
'none';

window.location.href =
'dashboard.html';

};

document.addEventListener(
'DOMContentLoaded',
function(){


const modal =
document.getElementById(
  'modalBienvenida'
);

if(modal){
  modal.style.display =
  'none';
}


}
);
