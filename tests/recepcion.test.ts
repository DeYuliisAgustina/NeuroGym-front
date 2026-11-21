import { ingresarConQr } from '../src/services/recepcion';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** CU-004: la recepción recorre los pasos de los diagramas de secuencia (Figuras 99 a 105). */
describe('recepción con QR', () => {
  afterEach(() => vi.restoreAllMocks());

  function servidor(respuestas: { cuota?: { alDia: boolean; periodosAdeudados: string[] }; reserva?: Response }) {
    const llamadas: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url).replace(/^.*\/api/, '');
      llamadas.push(`${init?.method ?? 'GET'} ${u.split('?')[0]}`);
      if (u.startsWith('/qr/validacion')) return json({ socioId: 7, codigoQrId: 70, socio: 'Catalina Gómez' });
      if (u.startsWith('/reservas/vigente')) return respuestas.reserva ?? json({ reservaId: 5, socio: 'Catalina Gómez', actividad: 'Funcional', sede: 'Sede Centro', turno: '10:00 a 11:00', hora: '2026-11-21T13:00:00Z' });
      if (u.startsWith('/cuotas/7/estado')) return json({ ...(respuestas.cuota ?? { alDia: true, periodosAdeudados: [] }), politicaSugerida: 'BLOQUEAR', puedeAutorizar: true });
      if (u.startsWith('/asistencias')) return json({ resultado: 'INGRESO_AUTORIZADO', diaConstancia: true, socio: 'Catalina Gómez' }, 201);
      return json({}, 404);
    });
    return llamadas;
  }

  it('cuota al día: valida, verifica reserva y cuota, y confirma la asistencia', async () => {
    const llamadas = servidor({});
    const r = await ingresarConQr('codigo-de-prueba-123', 1);
    expect(r).toMatchObject({ resultado: 'INGRESO_AUTORIZADO', diaConstancia: true });
    expect(llamadas).toEqual(['POST /qr/validacion', 'GET /reservas/vigente', 'GET /cuotas/7/estado', 'POST /asistencias']);
  });

  it('cuota pendiente: se detiene antes de confirmar y devuelve los datos para decidir', async () => {
    const llamadas = servidor({ cuota: { alDia: false, periodosAdeudados: ['2026-10'] } });
    const r = await ingresarConQr('codigo-de-prueba-123', 1);
    expect(r).toMatchObject({ resultado: 'CUOTA_PENDIENTE', reservaId: 5, codigoQrId: 70, periodosAdeudados: ['2026-10'], puedeAutorizar: true });
    expect(llamadas).not.toContain('POST /asistencias');
  });

  it('un rechazo del servidor (422) se muestra como resultado de la recepción', async () => {
    servidor({ reserva: json({ error: 'SEDE_INCORRECTA', mensaje: 'Sede incorrecta', detalle: { socio: 'Catalina Gómez' } }, 422) });
    const r = await ingresarConQr('codigo-de-prueba-123', 1);
    expect(r).toEqual({ resultado: 'SEDE_INCORRECTA', mensaje: 'Sede incorrecta', socio: 'Catalina Gómez' });
  });
});
