import { dinero, etiqueta, sumarDiasIso, tonoEstado } from '../src/utils/formato';
import { emailValido, motivoObligatorio, passwordSegura, validarEjercicio, validarIngreso, validarRegistroProfesional, validarSocio } from '../src/validations/formularios';

describe('validaciones de formularios', () => {
  it('correo y contraseña', () => {
    expect(emailValido('socio@demo.com')).toBe(true);
    expect(emailValido('socio@')).toBe(false);
    expect(passwordSegura('abc12345')).toBe(true);
    expect(passwordSegura('abcdefgh')).toBe(false);
    expect(validarIngreso({ email: 'x', password: '' })).toEqual({ email: 'Ingresá un correo válido', password: 'Ingresá la contraseña' });
  });

  it('el alta de socio exige consentimiento (Ley 25.326) y sede', () => {
    const errores = validarSocio({ email: 'a@b.com', nombre: 'Ana', apellido: 'Demo', telefono: '341 555-1234', sedeId: '', consentimientoDatos: false });
    expect(errores.sedeId).toBeDefined();
    expect(errores.consentimientoDatos).toContain('consentimiento');
  });

  it('registro de profesional', () => {
    const errores = validarRegistroProfesional({ email: 'p@gmail.com', password: 'corta', nombre: '', apellido: 'Paz', valorConsulta: '', consentimientoDatos: true });
    expect(Object.keys(errores).sort()).toEqual(['nombre', 'password', 'valorConsulta']);
  });

  it('CU-003-003 5.1: valores fuera de rango muestran el mensaje del caso de uso', () => {
    expect(validarEjercicio({ nombre: 'Sentadilla', series: 0, repeticiones: 10, pesoKg: 20, descansoSeg: 60 })).toBe('Revisá el nombre, las series, las repeticiones y el peso.');
    expect(validarEjercicio({ nombre: 'Sentadilla', series: 4, repeticiones: 10, pesoKg: null, descansoSeg: null })).toBeNull();
  });

  it('el motivo es obligatorio en excepciones (RF18)', () => {
    expect(motivoObligatorio('  ')).toBe('Motivo obligatorio');
    expect(motivoObligatorio('Falla de cámara')).toBeNull();
  });
});

describe('formato', () => {
  it('importes en pesos', () => expect(dinero(39600)).toMatch(/39\.600/));
  it('etiquetas legibles', () => {
    expect(etiqueta('DEBITO_AUTOMATICO')).toBe('Débito automático');
    expect(etiqueta('DESCONOCIDO')).toBe('DESCONOCIDO');
  });
  it('tono por estado', () => {
    expect(tonoEstado('PAGADA')).toBe('etiqueta-ok');
    expect(tonoEstado('IMPAGA')).toBe('etiqueta-mal');
  });
  it('suma de días', () => expect(sumarDiasIso('2026-12-30', 3)).toBe('2027-01-02'));
});

describe('Registro: teléfono, nombre y mensaje por campo', () => {
  it('el teléfono solo exige números, espacios, + o guiones', async () => {
    const { telefonoValido } = await import('../src/validations/formularios');
    for (const t of ['341 555-1234', '0341 15 555-1234', '+54 9 341 555-1234', '+598 99 123 456']) expect(telefonoValido(t)).toBe(true);
    for (const t of ['123', '341-ABC-1234', '']) expect(telefonoValido(t)).toBe(false);
  });

  it('el nombre acepta tildes y rechaza números', async () => {
    const { errorNombre } = await import('../src/validations/formularios');
    expect(errorNombre('María José')).toBeUndefined();
    expect(errorNombre("O'Connor")).toBeUndefined();
    expect(errorNombre('Lucía2')).toBe('Usá solo letras, sin números ni símbolos');
  });

  it('el mensaje general dice qué campos revisar', async () => {
    const { mensajeConCampos } = await import('../src/hooks/useApi');
    expect(mensajeConCampos('Revisá los datos ingresados', { email: 'x' })).toBe('Revisá el correo electrónico. Te marcamos el error debajo de cada campo.');
    expect(mensajeConCampos('Revisá los datos ingresados', { email: 'x', telefono: 'y' })).toContain('el correo electrónico y el teléfono');
    expect(mensajeConCampos('Otro error', {})).toBe('Otro error');
  });
});

describe('Registro: correo de proveedor conocido', () => {
  it('marca el correo inventado antes de enviar', async () => {
    const { validarRegistroSocio } = await import('../src/validations/formularios');
    const base = { password: 'Prueba123', nombre: 'Pepe', apellido: 'Paz', telefono: '341 555-1234', sedeId: '1', consentimientoDatos: true };
    expect(validarRegistroSocio({ ...base, email: 'pepe@cualk.com' }).email).toContain('proveedor conocido');
    expect(validarRegistroSocio({ ...base, email: 'pepe@gmail.com' }).email).toBeUndefined();
  });
});
