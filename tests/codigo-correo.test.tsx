import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecuperarPassword } from '../src/components/CodigoCorreo';
import { AuthProvider } from '../src/contexts/AuthContext';
import { Ingreso } from '../src/pages/publico/Ingreso';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const sinCuerpo = () => new Response(null, { status: 204 });
const cuerpo = (espia: { mock: { calls: unknown[][] } }, ruta: string) =>
  espia.mock.calls.filter(([url]) => String(url).endsWith(ruta)).map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe('Código por correo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('«Olvidé mi contraseña»: pide el correo, envía el código y cambia la contraseña', async () => {
    const espia = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/auth/recuperacion/confirmacion')) {
        const enviados = cuerpo(espia, '/auth/recuperacion/confirmacion');
        // El primer intento tiene un código incorrecto: el backend lo marca debajo del campo.
        if (enviados.length === 1) {
          return json({ error: 'CODIGO_INCORRECTO', mensaje: 'El código no es correcto. Te quedan 4 intentos.', detalle: [{ campo: 'codigo', mensaje: 'El código no es correcto. Te quedan 4 intentos.' }] }, 422);
        }
        return sinCuerpo();
      }
      return sinCuerpo();
    });
    const onListo = vi.fn();
    render(<RecuperarPassword emailInicial="" onListo={onListo} />);

    await userEvent.click(screen.getByRole('button', { name: /Enviar código/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá un correo válido');
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'lucia@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: /Enviar código/ }));
    expect(await screen.findByText(/te enviamos un código de 6 dígitos/)).toBeInTheDocument();
    expect(cuerpo(espia, '/auth/recuperacion')).toEqual([{ email: 'lucia@gmail.com' }]);
    // El reenvío se habilita después de un minuto.
    expect(screen.getByText(/Podés pedir otro en \d+ s/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/), '000000');
    await userEvent.type(screen.getByLabelText(/^Contraseña nueva/, { selector: 'input' }), 'Nueva12345');
    await userEvent.click(screen.getByRole('button', { name: /Cambiar contraseña/ }));
    expect(await screen.findByText('El código no es correcto. Te quedan 4 intentos.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/Código de 6 dígitos/));
    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/), '123456');
    await userEvent.click(screen.getByRole('button', { name: /Cambiar contraseña/ }));
    expect(await screen.findByText('Listo, cambiaste tu contraseña')).toBeInTheDocument();
    expect(cuerpo(espia, '/auth/recuperacion/confirmacion').at(-1)).toEqual({ email: 'lucia@gmail.com', codigo: '123456', nueva: 'Nueva12345' });
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/ }));
    expect(onListo).toHaveBeenCalledWith('lucia@gmail.com');
  });

  it('al ingresar sin haber confirmado el correo pide el código y después entra', async () => {
    let verificado = false;
    const espia = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const ruta = String(url);
      if (ruta.endsWith('/auth/verificacion')) {
        verificado = true;
        return sinCuerpo();
      }
      if (ruta.endsWith('/auth/login')) {
        if (!verificado) return json({ error: 'EMAIL_NO_VERIFICADO', mensaje: 'Confirmá tu correo con el código de 6 dígitos que te enviamos' }, 403);
        return json({ token: 't', usuario: { usuarioId: 1, tipo: 'PROFESIONAL', nombre: 'Nutri Prueba', profesionalId: 3, permisos: [] } });
      }
      return json({});
    });
    render(
      <MemoryRouter initialEntries={['/ingreso']}>
        <AuthProvider>
          <Routes>
            <Route path="/ingreso" element={<Ingreso />} />
            <Route path="/profesional" element={<h1>Panel del profesional</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'nutri@gmail.com');
    await userEvent.type(screen.getByLabelText(/^Contraseña/, { selector: 'input' }), 'Prueba1234');
    await userEvent.click(screen.getByRole('button', { name: /^Ingresar/ }));
    expect(await screen.findByText('Confirmá tu correo')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/), '654321');
    await userEvent.click(screen.getByRole('button', { name: /Confirmar e ingresar/ }));
    expect(await screen.findByText('Panel del profesional')).toBeInTheDocument();
    expect(cuerpo(espia, '/auth/verificacion')).toEqual([{ email: 'nutri@gmail.com', codigo: '654321' }]);
  });
});
