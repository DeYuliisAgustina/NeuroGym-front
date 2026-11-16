/**
 * Validaciones de formularios del lado del cliente: mejoran la experiencia,
 * pero el backend vuelve a validar todos los datos.
 */
export type Errores = Record<string, string>;

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const passwordSegura = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
export const telefonoValido = (telefono: string) => /^[+\d\s()-]{8,30}$/.test(telefono.trim());

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
  if (!emailValido(d.email)) e.email = 'Ingresá un correo válido';
  if (!passwordSegura(d.password)) e.password = 'Mínimo 8 caracteres, con letras y números';
  if (!d.nombre.trim()) e.nombre = 'Campo obligatorio';
  if (!d.apellido.trim()) e.apellido = 'Campo obligatorio';
  if (!(Number(d.valorConsulta) >= 0) || d.valorConsulta === '') e.valorConsulta = 'Ingresá un valor válido';
  if (!d.consentimientoDatos) e.consentimientoDatos = 'Se requiere tu consentimiento';
  return e;
}

export function validarSocio(d: { email: string; nombre: string; apellido: string; telefono: string; sedeId: string; consentimientoDatos: boolean }): Errores {
  const e: Errores = {};
  if (!emailValido(d.email)) e.email = 'Ingresá un correo válido';
  if (!d.nombre.trim()) e.nombre = 'Campo obligatorio';
  if (!d.apellido.trim()) e.apellido = 'Campo obligatorio';
  if (!telefonoValido(d.telefono)) e.telefono = 'Teléfono inválido';
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
