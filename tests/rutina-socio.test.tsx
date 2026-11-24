import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../src/contexts/ToastContext';
import { RutinaSocio } from '../src/pages/admin/RutinaSocio';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const ejercicio = (id: number, nombre: string, dia: number) => ({
  id,
  ejercicioId: id,
  nombre,
  grupoMuscular: 'Piernas',
  dia,
  orden: 1,
  series: 3,
  repeticiones: 10,
  pesoKg: 20,
  descansoSeg: 60,
  disponible: true,
  equipos: [],
  mantenimientoHasta: null,
});
const conRutina = {
  generador: 'Simulación local',
  preferencias: { objetivo: 'Hipertrofia', nivel: 'Intermedio', diasPorSemana: 2 },
  rutina: { id: 9, fechaGeneracion: '2026-11-24T12:00:00.000Z', ejercicios: [ejercicio(1, 'Sentadilla', 1), ejercicio(2, 'Remo', 2)] },
};

/** RF5: el personal genera con IA y edita la rutina de un socio desde su ficha. */
describe('Rutina del socio (personal)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('genera la rutina con IA y edita un ejercicio por las rutas del personal', async () => {
    let generada = false;
    const espia = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.endsWith('/admin/socios/5/rutina') && init?.method === 'POST') {
        generada = true;
        return json(conRutina, 201);
      }
      if (u.endsWith('/admin/socios/5/rutina/ejercicios/1') && init?.method === 'PUT') return json(conRutina);
      if (u.endsWith('/admin/socios/5/rutina')) return json(generada ? conRutina : { generador: 'Simulación local', preferencias: null, rutina: null });
      return json({});
    });
    render(
      <ToastProvider>
        <RutinaSocio socioId={5} nombre="Lucía Pérez" activo gestion alCerrar={() => undefined} />
      </ToastProvider>,
    );

    expect(await screen.findByText('Todavía no tiene una rutina')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Generar rutina con IA/ }));
    expect(await screen.findByText('Elegí las preferencias de Lucía Pérez para preparar su rutina.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Objetivo'), 'Hipertrofia');
    await userEvent.click(screen.getByRole('button', { name: /^Generar rutina$/ }));

    expect(await screen.findByText('Sentadilla')).toBeInTheDocument();
    const post = espia.mock.calls.find(([u, i]) => String(u).endsWith('/admin/socios/5/rutina') && i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ objetivo: 'Hipertrofia', nivel: 'Principiante', diasPorSemana: 3, evitar: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Editar Sentadilla' }));
    expect(await screen.findByText('Ajustar ejercicio')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Series'));
    await userEvent.type(screen.getByLabelText('Series'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    const put = espia.mock.calls.find(([u, i]) => String(u).endsWith('/admin/socios/5/rutina/ejercicios/1') && i?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ series: 4 });
  });

  it('con permiso de consulta (o con el socio desactivado) solo muestra la rutina', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(conRutina));
    render(
      <ToastProvider>
        <RutinaSocio socioId={5} nombre="Lucía Pérez" activo={false} gestion alCerrar={() => undefined} />
      </ToastProvider>,
    );
    expect(await screen.findByText('Sentadilla')).toBeInTheDocument();
    expect(screen.getByText(/podés consultar su rutina, pero no modificarla/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar Sentadilla' })).toBeNull();
  });
});
