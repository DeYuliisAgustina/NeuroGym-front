import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { SedeProvider } from '../src/contexts/SedeContext';
import { ToastProvider } from '../src/contexts/ToastContext';
import { Socios } from '../src/pages/admin/Socios';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const pendiente = {
  id: 37,
  telefono: '341 555-0101',
  pendienteAlta: true,
  usuario: { id: 90, email: 'lucia@prueba.test', nombre: 'Lucía', apellido: 'Prueba', activo: false, fechaAlta: '2026-11-21T06:32:01.000Z' },
  plan: { tipo: 'BASICO' },
  sede: { id: 1, nombre: 'Sede Centro' },
  estadoCuota: null,
  asistenciasMes: 0,
  ultimaVisita: null,
};

/** RF2: al dar de alta un autorregistro, el modal se cierra y la lista de pendientes se actualiza. */
describe('Socios: confirmación del alta', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('dar de alta (respuesta 204 sin cuerpo) cierra la revisión y saca al socio de los pendientes', async () => {
    localStorage.setItem('neurogym.token', 'token-de-prueba');
    let aprobado = false;
    const espia = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('/auth/sesion')) return json({ usuarioId: 1, tipo: 'PERSONAL', nombre: 'Ana Demo', esAdminGeneral: true, permisos: [] });
      if (u.includes('/admin/socios/37/alta') && init?.method === 'PATCH') {
        aprobado = true;
        return new Response(null, { status: 204 });
      }
      if (u.includes('/admin/socios')) return json(u.includes('pendiente=true') && !aprobado ? [pendiente] : []);
      if (u.includes('/admin/gimnasio')) return json({ suscripcion: { tipo: 'INTELLIGENCE', maxSociosActivos: 4000 }, uso: { sociosActivos: 10 } });
      return json([]);
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <SedeProvider>
            <ToastProvider>
              <Socios />
            </ToastProvider>
          </SedeProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Ver pendientes de alta/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Revisar alta/ }));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: /Dar de alta/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(espia).toHaveBeenCalledWith(expect.stringContaining('/admin/socios/37/alta'), expect.objectContaining({ method: 'PATCH' }));
    await waitFor(() => expect(screen.queryByText('lucia@prueba.test')).not.toBeInTheDocument());
    expect(screen.queryByText(/no tiene un registro pendiente/)).not.toBeInTheDocument();
  });
});
