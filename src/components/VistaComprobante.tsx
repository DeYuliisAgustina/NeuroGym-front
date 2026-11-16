import type { Comprobante } from '../types';
import { dinero, etiqueta, fecha } from '../utils/formato';
import { Boton } from './ui';

/** "Tu comprobante" (CU-001-009): importes congelados al momento del pago (RD12). */
export function VistaComprobante({ comprobante: c, alCerrar }: { comprobante: Comprobante; alCerrar: () => void }) {
  return (
    <div className="pila">
      <div className="fila-entre">
        <strong>Comprobante {c.numero}</strong>
        <small>{fecha(c.fechaEmision, true)}</small>
      </div>
      <table>
        <tbody>
          <tr><td>Socio</td><td>{c.socio}</td></tr>
          <tr><td>Sede</td><td>{c.sede}</td></tr>
          <tr><td>Período</td><td>{c.periodo}</td></tr>
          <tr><td>Plan</td><td>{c.plan}</td></tr>
          <tr><td>Cuota base</td><td className="importe">{dinero(c.cuotaBase)}</td></tr>
          <tr><td>Adicional Premium</td><td className="importe">{dinero(c.adicionalPremium)}</td></tr>
          <tr><td>Descuento</td><td className="importe">−{dinero(c.descuento)}</td></tr>
          <tr><td><strong>Importe abonado</strong></td><td className="importe"><strong>{dinero(c.importe)}</strong></td></tr>
          <tr><td>Medio de pago</td><td>{etiqueta(c.medio)}</td></tr>
          <tr><td>Fecha de pago</td><td>{fecha(c.fechaPago, true)}</td></tr>
          <tr><td>Referencia</td><td>{c.referencia}</td></tr>
          <tr><td>Envío por WhatsApp</td><td>{c.fechaEnvio ? fecha(c.fechaEnvio, true) : 'No enviado (disponible en el historial)'}</td></tr>
        </tbody>
      </table>
      <div className="fila no-imprimir">
        <Boton variante="secundario" onClick={alCerrar}>Cerrar</Boton>
        <Boton onClick={() => window.print()}>Imprimir comprobante</Boton>
      </div>
    </div>
  );
}
