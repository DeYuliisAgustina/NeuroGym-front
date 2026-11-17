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
  api: {
    get: vi.fn((ruta: string) => Promise.resolve(respuestas[ruta] ?? [])),
    post: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn(() => Promise.resolve(null)),
  },
}));

function preparar(detalle: object) {
  respuestas['/socio/cuota'] = detalle;
  respuestas['/socio/perfil'] = { esPremium: false, plan: { tipo: 'BASICO' }, preciosPlanes: { cuotaBase: 32000, adicionalPremium: 12000 } };
  respuestas['/pagos/integracion'] = { mercadoPago: 'PRUEBA' };
  respuestas['/cuotas/2/medios'] = importes(30000);
  return render(
    <MemoryRouter>
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
