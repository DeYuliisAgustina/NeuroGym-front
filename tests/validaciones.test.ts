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
    const errores = validarRegistroProfesional({ email: 'p@demo.com', password: 'corta', nombre: '', apellido: 'X', valorConsulta: '', consentimientoDatos: true });
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
