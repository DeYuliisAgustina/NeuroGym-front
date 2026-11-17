import { useEffect, useRef, type ReactNode } from 'react';
import { Icono } from './Icono';

/**
 * Aviso destacado de un pago que no se pudo completar (rechazo de Mercado Pago o
 * error al iniciar la operación). Se anuncia a los lectores de pantalla, se lleva
 * a la vista y ofrece qué hacer a continuación.
 */
export function AvisoPago({ titulo, children, acciones, onCerrar }: { titulo: string; children: ReactNode; acciones?: ReactNode; onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    ref.current?.focus({ preventScroll: true });
  }, [titulo, children]);

  return (
    <div ref={ref} className="payment-alert" role="alert" aria-live="assertive" tabIndex={-1}>
      <div className="payment-alert-icon">
        <Icono n="warning" />
      </div>
      <div className="payment-alert-body">
        <h3>{titulo}</h3>
        <div className="payment-alert-text">{children}</div>
        {acciones && <div className="payment-alert-actions">{acciones}</div>}
      </div>
      <button className="icon-button payment-alert-close" type="button" aria-label="Cerrar aviso" onClick={onCerrar}>
        <Icono n="close" />
      </button>
    </div>
  );
}
