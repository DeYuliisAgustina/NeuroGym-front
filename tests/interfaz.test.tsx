import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Composicion, estadoEnvioWhatsapp, ModalComprobante } from '../src/components/VistaComprobante';
import { Estado, Kpi } from '../src/components/ui';
import { ToastProvider } from '../src/contexts/ToastContext';
import { fechaLarga, mesAnio } from '../src/utils/formato';
import type { Comprobante } from '../src/types';

const comprobante: Comprobante = {
  numero: 'C-000123',
  fechaEmision: '2026-11-03T15:00:00.000Z',
  fechaEnvio: null,
  socio: 'Socio Prueba',
  sede: 'Centro',
  periodo: '2026-11',
  plan: 'Premium',
  cuotaBase: 38000,
  adicionalPremium: 10000,
  descuento: 4800,
  importe: 43200,
  medio: 'DEBITO_AUTOMATICO',
  fechaPago: '2026-11-03T15:00:00.000Z',
  referencia: 'MP-998877',
};

describe('interfaz del prototipo', () => {
  it('formatea períodos y fechas como el prototipo', () => {
    expect(mesAnio('2026-11')).toBe('Noviembre 2026');
    expect(fechaLarga('2026-11-15')).toBe('15 de noviembre de 2026');
    expect(fechaLarga('2026-11-15', false)).toBe('15 de noviembre');
  });

  it('la composición muestra el descuento solo cuando corresponde', () => {
    const { rerender } = render(<Composicion cuotaBase={38000} adicionalPremium={0} descuento={0} />);
    expect(screen.queryByText('10% de descuento sobre el total del plan')).not.toBeInTheDocument();
    rerender(<Composicion cuotaBase={38000} adicionalPremium={10000} descuento={4800} plan="Premium" />);
    expect(screen.getByText('10% de descuento sobre el total del plan')).toBeInTheDocument();
    expect(screen.getByText('Adicional Premium')).toBeInTheDocument();
  });

  it('el comprobante conserva los importes del pago (RD12) y se puede cerrar', async () => {
    const cerrar = vi.fn();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ModalComprobante comprobante={comprobante} onCerrar={cerrar} />
        </ToastProvider>
      </MemoryRouter>,
    );
    const recibo = document.querySelector('section.receipt') as HTMLElement;
    expect(within(recibo).getByText('Cuota Noviembre 2026')).toBeInTheDocument();
    expect(within(recibo).getByText('Débito automático')).toBeInTheDocument();
    expect(within(recibo).getByText('MP-998877')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp: sin envío confirmado/)).toBeInTheDocument();
    // El modal tiene dos controles "Cerrar": la cruz del encabezado y el botón del pie.
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).find((b) => b.classList.contains('btn'))!);
    expect(cerrar).toHaveBeenCalled();
  });

  it('los estados usan los colores de insignia del prototipo', () => {
    render(
      <>
        <Estado valor="IMPAGA" />
        <Estado valor="PENDIENTE" />
        <Kpi etiqueta="Mis puntos" valor={320} unidad="pts" />
      </>,
    );
    expect(screen.getByText('Impaga').closest('.badge')).toHaveClass('danger');
    expect(screen.getByText('Pendiente').closest('.badge')).toHaveClass('warning');
    expect(screen.getByText('Mis puntos').closest('.kpi')).toBeInTheDocument();
  });
});

describe('estado del envío por WhatsApp en el comprobante', () => {
  const con = (estado: string | null, extra = {}) =>
    estadoEnvioWhatsapp({
      envioWhatsapp: estado
        ? ({ estado, proveedor: 'DIALOG360_SANDBOX', detalle: null, fechaAceptado: null, fechaEnviado: null, fechaEntregado: null, fechaLeido: null, fechaFallido: null, ...extra } as Comprobante['envioWhatsapp'])
        : null,
    });

  it('solo muestra enviado o entregado si el proveedor lo confirmó', () => {
    expect(con('ENTREGADO', { fechaEntregado: '2026-11-17T18:00:00.000Z' })).toBe('WhatsApp: entregado · 17 de noviembre');
    expect(con('LEIDO', { fechaLeido: '2026-11-17T18:00:00.000Z' })).toContain('leído');
    expect(con('ENVIADO')).toContain('entrega sin confirmar');
    expect(con('ACEPTADO')).toContain('envío sin confirmar');
    expect(con('FALLIDO')).toContain('no se pudo enviar');
    expect(con('SIMULADO')).toContain('no se envió');
    expect(con('OMITIDO')).toContain('no enviado');
    expect(con(null)).toBe('WhatsApp: sin envío confirmado');
  });
});
