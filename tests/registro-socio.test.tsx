import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { Registro } from '../src/pages/publico/Registro';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** RF2: autorregistro del socio; la cuenta queda pendiente hasta que el gimnasio confirma el alta. */
describe('registro del socio', () => {
  afterEach(() => vi.restoreAllMocks());

  it('valida los datos, envía el pre-registro y avisa que el gimnasio confirma el alta', async () => {
    const espia = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('/auth/registro/opciones')) return json([{ id: 1, razonSocial: 'Gimnasio Centro', sedes: [{ id: 7, nombre: 'Sede Centro', direccion: 'Calle 1' }] }]);
      if (String(url).includes('/auth/registro') && init?.method === 'POST') return json({ mensaje: 'Registro recibido. Tu gimnasio va a confirmar tu alta.', verificacionPendiente: true }, 201);
      if (String(url).includes('/auth/verificacion') && init?.method === 'POST') return new Response(null, { status: 204 });
      return json({});
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <Registro />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Registrarse/ }));
    expect(await screen.findByText('Elegí tu gimnasio y tu sede')).toBeInTheDocument();
    expect(espia).not.toHaveBeenCalledWith(expect.stringContaining('/auth/registro'), expect.objectContaining({ method: 'POST' }));

    await userEvent.type(screen.getByLabelText(/^Nombre/), 'Lucía');
    await userEvent.type(screen.getByLabelText(/^Apellido/), 'Pérez');
    await userEvent.type(screen.getByLabelText(/^Correo electrónico/), 'lucia@prueba.test');
    await userEvent.type(screen.getByLabelText(/^Contraseña/, { selector: 'input' }), 'Registro123');
    await userEvent.type(screen.getByLabelText(/^Teléfono/), '341 555-1234');
    await userEvent.selectOptions(await screen.findByLabelText(/^Gimnasio/), '1');
    await userEvent.selectOptions(screen.getByLabelText(/^Sede/), '7');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Registrarse/ }));

    // Primero confirma el correo con el código que le llegó.
    expect(await screen.findByText('Confirmá tu correo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Confirmar correo/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá el código de 6 dígitos');
    await userEvent.type(screen.getByLabelText(/Código de 6 dígitos/), '12a3456');
    expect(screen.getByLabelText(/Código de 6 dígitos/)).toHaveValue('123456');
    await userEvent.click(screen.getByRole('button', { name: /Confirmar correo/ }));
    const verificacion = espia.mock.calls.find(([url]) => String(url).endsWith('/auth/verificacion'));
    expect(JSON.parse(String(verificacion?.[1]?.body))).toEqual({ email: 'lucia@prueba.test', codigo: '123456' });

    expect(await screen.findByText('¡Listo, Lucía!')).toBeInTheDocument();
    expect(screen.getByText(/Tu gimnasio va a confirmar tu alta/)).toBeInTheDocument();
    const envio = espia.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(envio?.[1]?.body))).toMatchObject({ email: 'lucia@prueba.test', sedeId: 7, consentimientoDatos: true });
  });
});
