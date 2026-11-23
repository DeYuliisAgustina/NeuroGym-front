/**
 * Validaciones de formularios del lado del cliente: mejoran la experiencia,
 * pero el backend vuelve a validar todos los datos.
 */
export type Errores = Record<string, string>;

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const passwordSegura = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
/**
 * Teléfono argentino (misma regla que el backend): acepta «341 555-1234», «0341 15 555-1234»
 * o «+54 9 341 555-1234» y exige característica + número (10 dígitos), con una característica
 * real (empieza con 11, 2 o 3) y sin todos los dígitos iguales.
 */
export function telefonoValido(telefono: string): boolean {
  const limpio = telefono.trim();
  if (!/^[+\d\s().-]+$/.test(limpio)) return false;
  let d = limpio.replace(/\D/g, '');
  if (d.startsWith('54') && d.length >= 12) {
    d = d.slice(2);
    if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  } else if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) {
    for (const largo of [2, 3, 4]) {
      if (d.slice(largo, largo + 2) === '15') {
        d = d.slice(0, largo) + d.slice(largo + 2);
        break;
      }
    }
  }
  return d.length === 10 && /^(11|[23])/.test(d) && !/^(\d)\1+$/.test(d);
}
export const MENSAJE_TELEFONO = 'Ingresá característica y número, por ejemplo 341 555-1234';

/** Nombre o apellido: solo letras (con tildes), espacios, apóstrofo y guion. */
export function errorNombre(texto: string): string | undefined {
  const t = texto.trim();
  if (!t) return 'Campo obligatorio';
  if (t.length < 2) return 'Escribí al menos 2 letras';
  if (!/^\p{L}[\p{L}\s'’.-]*$/u.test(t)) return 'Usá solo letras, sin números ni símbolos';
  return undefined;
}

/**
 * Proveedores de correo aceptados en el registro (la misma lista que el backend en
 * src/utils/correos.ts). El backend vuelve a controlarlo y además acepta los dominios
 * extra que se configuren; acá solo sirve para avisar antes de enviar.
 */
const PROVEEDORES_CORREO = [
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.com.ar', 'hotmail.es', 'outlook.com', 'outlook.com.ar', 'outlook.es', 'live.com', 'live.com.ar', 'msn.com',
  'yahoo.com', 'yahoo.com.ar', 'yahoo.es', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'aol.com', 'gmx.com', 'zoho.com',
  'fibertel.com.ar', 'arnet.com.ar', 'speedy.com.ar', 'ciudad.com.ar',
];
export const MENSAJE_CORREO_PROVEEDOR = 'Usá un correo de un proveedor conocido (Gmail, Hotmail, Outlook, Yahoo, iCloud…)';
export function correoDeProveedorConocido(email: string): boolean {
  const dominio = email.trim().toLowerCase().split('@').pop() ?? '';
  return PROVEEDORES_CORREO.includes(dominio) || dominio.endsWith('.test');
}
const errorCorreoRegistro = (email: string) =>
  !emailValido(email) ? 'Ingresá un correo válido' : !correoDeProveedorConocido(email) ? MENSAJE_CORREO_PROVEEDOR : undefined;

/** Agrega al objeto de errores solo los campos que tienen error. */
const conError = (e: Errores, campo: string, mensaje: string | undefined) => {
  if (mensaje) e[campo] = mensaje;
};

export function validarIngreso(d: { email: string; password: string }): Errores {
  const e: Errores = {};
  if (!emailValido(d.email)) e.email = 'Ingresá un correo válido';
  if (!d.password) e.password = 'Ingresá la contraseña';
  return e;
}

export function validarRegistroProfesional(d: {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  valorConsulta: string;
  consentimientoDatos: boolean;
}): Errores {
  const e: Errores = {};
  conError(e, 'email', errorCorreoRegistro(d.email));
  if (!passwordSegura(d.password)) e.password = 'Mínimo 8 caracteres, con letras y números';
  conError(e, 'nombre', errorNombre(d.nombre));
  conError(e, 'apellido', errorNombre(d.apellido));
  if (!(Number(d.valorConsulta) >= 0) || d.valorConsulta === '') e.valorConsulta = 'Ingresá un valor válido';
  if (!d.consentimientoDatos) e.consentimientoDatos = 'Se requiere tu consentimiento';
  return e;
}

/** RF2: autorregistro del socio (pre-registro que confirma el gimnasio). */
export function validarRegistroSocio(d: {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono: string;
  sedeId: string;
  consentimientoDatos: boolean;
}): Errores {
  const e: Errores = {};
  conError(e, 'email', errorCorreoRegistro(d.email));
  if (!passwordSegura(d.password)) e.password = 'Mínimo 8 caracteres, con letras y números';
  conError(e, 'nombre', errorNombre(d.nombre));
  conError(e, 'apellido', errorNombre(d.apellido));
  if (!telefonoValido(d.telefono)) e.telefono = MENSAJE_TELEFONO;
  if (!d.sedeId) e.sedeId = 'Elegí tu gimnasio y tu sede';
  if (!d.consentimientoDatos) e.consentimientoDatos = 'Se requiere tu consentimiento';
  return e;
}

export function validarSocio(d: { email: string; nombre: string; apellido: string; telefono: string; sedeId: string; consentimientoDatos: boolean }): Errores {
  const e: Errores = {};
  if (!emailValido(d.email)) e.email = 'Ingresá un correo válido';
  conError(e, 'nombre', errorNombre(d.nombre));
  conError(e, 'apellido', errorNombre(d.apellido));
  if (!telefonoValido(d.telefono)) e.telefono = MENSAJE_TELEFONO;
  if (!d.sedeId) e.sedeId = 'Elegí una sede';
  if (!d.consentimientoDatos) e.consentimientoDatos = 'El socio debe prestar su consentimiento (Ley 25.326)';
  return e;
}

/** CU-003-003 5.1: "Revisá el nombre, las series, las repeticiones y el peso." */
export function validarEjercicio(d: { nombre: string; series: number; repeticiones: number; pesoKg: number | null; descansoSeg: number | null }): string | null {
  const valido =
    d.nombre.trim().length > 0 &&
    Number.isInteger(d.series) && d.series >= 1 && d.series <= 10 &&
    Number.isInteger(d.repeticiones) && d.repeticiones >= 1 && d.repeticiones <= 100 &&
    (d.pesoKg === null || (d.pesoKg >= 0 && d.pesoKg <= 500)) &&
    (d.descansoSeg === null || (d.descansoSeg >= 0 && d.descansoSeg <= 600));
  return valido ? null : 'Revisá el nombre, las series, las repeticiones y el peso.';
}

export const motivoObligatorio = (motivo: string) => (motivo.trim() ? null : 'Motivo obligatorio');
