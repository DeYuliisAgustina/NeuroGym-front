import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { Ingreso } from '../src/pages/publico/Ingreso';
import { RutaProtegida } from '../src/routes/RutaProtegida';

function renderizar(ruta: string, elemento: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>
          <Route path="/ingreso" element={<div>Pantalla de ingreso</div>} />
          <Route path="/admin/ingreso" element={<div>Acceso del gimnasio</div>} />
          <Route path="*" element={elemento} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('componentes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('el formulario de ingreso valida antes de llamar a la API', async () => {
    const espia = vi.spyOn(globalThis, 'fetch');
    render(
      <MemoryRouter>
        <AuthProvider>
          <Ingreso />
        </AuthProvider>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Ingresá un correo válido')).toBeInTheDocument();
    expect(espia).not.toHaveBeenCalled();
  });

  it('el ojo muestra y oculta la contraseña', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Ingreso />
        </AuthProvider>
      </MemoryRouter>,
    );
    const campo = screen.getByLabelText('Contraseña', { selector: 'input' });
    expect(campo).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campo).toHaveAttribute('type', 'password');
  });

  it('muestra el error de credenciales que devuelve el backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'CREDENCIALES_INVALIDAS', mensaje: 'Correo o contraseña incorrectos' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    );
    render(
      <MemoryRouter>
        <AuthProvider>
          <Ingreso />
        </AuthProvider>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'socio@demo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta1');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
  });

  it('una ruta de socio sin sesión redirige al ingreso', async () => {
    renderizar('/socio', <RutaProtegida perfil="SOCIO"><div>Privado</div></RutaProtegida>);
    await waitFor(() => expect(screen.getByText('Pantalla de ingreso')).toBeInTheDocument());
  });

  it('una ruta administrativa sin sesión redirige al acceso del gimnasio', async () => {
    renderizar('/admin', <RutaProtegida perfil="PERSONAL"><div>Privado</div></RutaProtegida>);
    await waitFor(() => expect(screen.getByText('Acceso del gimnasio')).toBeInTheDocument());
  });

  it('oculta la sección si el rol no tiene el permiso del módulo', async () => {
    localStorage.setItem('neurogym.token', 'token-de-prueba');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ usuarioId: 1, tipo: 'PERSONAL', nombre: 'Demo', esAdminGeneral: false, permisos: ['SOCIOS:CONSULTA'] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    renderizar('/admin/cobros', <RutaProtegida perfil="PERSONAL" modulo="COBROS"><div>Cobros</div></RutaProtegida>);
    expect(await screen.findByText('Tu rol no tiene permiso para acceder a esta sección.')).toBeInTheDocument();
  });
});
