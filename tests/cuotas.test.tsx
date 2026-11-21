import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../src/contexts/ToastContext';
import { CuotasPagos } from '../src/pages/socio/CuotasPagos';
import type { Cuota } from '../src/types';

const importes = (base: number) => ({
  PAGO_UNICO: { medio: 'PAGO_UNICO', cuotaBase: base, adicionalPremium: 0, descuento: 0, importeFinal: base },
  DEBITO_AUTOMATICO: { medio: 'DEBITO_AUTOMATICO', cuotaBase: base, adicionalPremium: 0, descuento: base * 0.1, importeFinal: base * 0.9 },
  EFECTIVO: { medio: 'EFECTIVO', cuotaBase: base, adicionalPremium: 0, descuento: 0, importeFinal: base },
});
const cuota = (datos: Partial<Cuota>): Cuota => ({
  id: 1,
  periodo: '2026-11',
  estado: 'PENDIENTE',
  fechaVencimiento: '2026-11-10',
  cuotaBase: 32000,
  adicionalPremium: 0,
  descuento: 0,
  importeFinal: 32000,
  debitoProgramado: false,
  mediosHabilitados: ['PAGO_UNICO', 'DEBITO_AUTOMATICO', 'EFECTIVO'],
  ...datos,
});

// API simulada solo para esta prueba de interfaz.
const respuestas: Record<string, unknown> = {};
vi.mock('../src/services/api', () => ({
  ErrorApi: class ErrorApi extends Error {
    errores: Record<string, string> = {};
  },
  api: {
    get: vi.fn((ruta: string) => Promise.resolve(respuestas[ruta] ?? [])),
    // Al abrir la pantalla se verifican los pagos pendientes con Mercado Pago (sin novedades en estas pruebas).
    post: vi.fn((ruta: string) => Promise.resolve(ruta === '/socio/pagos/verificacion' ? { revisados: 0, aprobados: 0, rechazados: 0 } : null)),
    delete: vi.fn(() => Promise.resolve(null)),
    descargar: vi.fn(() => Promise.resolve()),
  },
}));

function preparar(detalle: object, ruta = '/socio/pagos') {
  respuestas['/socio/cuota'] = detalle;
  respuestas['/socio/perfil'] = { esPremium: false, plan: { tipo: 'BASICO' }, preciosPlanes: { cuotaBase: 32000, adicionalPremium: 12000 } };
  respuestas['/pagos/integracion'] = { mercadoPago: 'PRUEBA' };
  respuestas['/cuotas/2/medios'] = importes(30000);
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ToastProvider>
        <CuotasPagos />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('Cuotas y pagos: cuota a abonar y débito programado', () => {
  it('permite elegir una cuota vencida anterior; esa cuota no ofrece débito automático', async () => {
    preparar({
      cuota: cuota({}),
      adeudadas: [cuota({ id: 2, periodo: '2026-10', estado: 'IMPAGA', fechaVencimiento: '2026-10-10', mediosHabilitados: ['PAGO_UNICO', 'EFECTIVO'] })],
      adhesion: null,
      importes: importes(32000),
    });
    const selector = await screen.findByLabelText('Cuota a abonar');
    expect(screen.getByText(/una cuota anterior sin pagar/)).toBeInTheDocument();
    const medios = screen.getByRole('group', { name: 'Medio de pago' });
    expect(within(medios).getByText('Débito automático')).toBeInTheDocument();

    await userEvent.selectOptions(selector, '2');
    expect(await screen.findByRole('heading', { name: 'Octubre 2026' })).toBeInTheDocument();
    const mediosVencida = screen.getByRole('group', { name: 'Medio de pago' });
    expect(within(mediosVencida).queryByText('Débito automático')).not.toBeInTheDocument();
    expect(within(mediosVencida).getByText('Mercado Pago')).toBeInTheDocument();
    expect(within(mediosVencida).getByText('Efectivo')).toBeInTheDocument();
  });

  it('al volver de Mercado Pago con el pago rechazado muestra un aviso destacado con qué hacer', async () => {
    preparar({ cuota: cuota({}), adeudadas: [], adhesion: null, importes: importes(32000) }, '/socio/pagos?resultado=rechazado&pago=75');
    const aviso = await screen.findByRole('alert');
    expect(within(aviso).getByRole('heading', { name: 'Mercado Pago rechazó el pago' })).toBeInTheDocument();
    expect(within(aviso).getByText(/No se realizó ningún cobro y tu cuota sigue pendiente/)).toBeInTheDocument();
    expect(within(aviso).getByRole('button', { name: /Intentar de nuevo/ })).toBeInTheDocument();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si no se puede iniciar el pago, el motivo se muestra en el aviso destacado', async () => {
    const { api } = await import('../src/services/api');
    preparar({ cuota: cuota({}), adeudadas: [], adhesion: null, importes: importes(32000) });
    // Solo falla el inicio del pago (no la verificación que se hace al abrir la pantalla).
    vi.mocked(api.post).mockRejectedValueOnce(new Error('La cuota del período se debitará automáticamente con tu adhesión.'));
    await userEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    await userEvent.click(screen.getByRole('button', { name: /Pagaré en administración/ }));
    const aviso = await screen.findByRole('alert');
    expect(within(aviso).getByRole('heading', { name: 'No pudimos completar la operación' })).toBeInTheDocument();
    expect(within(aviso).getByText(/se debitará automáticamente/)).toBeInTheDocument();
  });

  it('con débito programado muestra el estado y no ofrece otros medios', async () => {
    preparar({
      cuota: cuota({ debitoProgramado: true, mediosHabilitados: [] }),
      adeudadas: [],
      adhesion: { id: 9, fechaAlta: '2026-11-17', idPreaprobacion: 'abc123' },
      importes: importes(32000),
    });
    expect((await screen.findAllByText('Débito automático programado')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('group', { name: 'Medio de pago' })).not.toBeInTheDocument();
    expect(screen.getByText(/Si el débito se rechaza, vas a poder pagarla/)).toBeInTheDocument();
  });
});

describe('Descargar comprobante', () => {
  it('descarga el mismo PDF que se envía por WhatsApp', async () => {
    const { api } = await import('../src/services/api');
    const { ModalComprobante } = await import('../src/components/VistaComprobante');
    render(
      <MemoryRouter>
      <ModalComprobante
        comprobante={{
          pagoId: 77,
          rutaPdf: '/socio/pagos/77/comprobante.pdf',
          numero: 'NG-00000077',
          fechaEmision: '2026-11-17T19:02:11.000Z',
          fechaEnvio: null,
          socio: 'Socia Prueba',
          sede: 'Norte',
          periodo: '2026-10',
          plan: 'Premium',
          cuotaBase: 32000,
          adicionalPremium: 12000,
          descuento: 0,
          importe: 44000,
          medio: 'EFECTIVO',
          fechaPago: '2026-11-17T19:02:11.000Z',
          referencia: 'NG-00000077',
        }}
        onCerrar={() => undefined}
      />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Descargar comprobante/ }));
    expect(api.descargar).toHaveBeenCalledWith('/socio/pagos/77/comprobante.pdf', 'comprobante-NG-00000077.pdf');
  });
});
