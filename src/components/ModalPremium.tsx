import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import { dinero } from '../utils/formato';
import { Icono } from './Icono';
import { Boton, ErrorFormulario, Modal } from './ui';
import { useToast } from '../contexts/ToastContext';

export interface PreciosPlanes {
  cuotaBase: number;
  adicionalPremium: number;
}

const conDebito = (n: number) => Math.round(n * 0.9 * 100) / 100;

/**
 * "Plan Premium" (Figura 50, RF12): contratación del Premium o vuelta al
 * Básico. El cambio lo aplica el backend y recalcula la cuota pendiente.
 */
export function ModalPremium({
  abierto,
  onCerrar,
  precios,
  esPremium,
  onCambio,
}: {
  abierto: boolean;
  onCerrar: () => void;
  precios: PreciosPlanes | undefined;
  esPremium: boolean;
  onCambio: () => void;
}) {
  const accion = useAccion();
  const toast = useToast();
  const total = (precios?.cuotaBase ?? 0) + (precios?.adicionalPremium ?? 0);
  const cambiar = async (plan: 'BASICO' | 'PREMIUM') => {
    if (await accion.ejecutar(() => api.put('/socio/plan', { plan }))) {
      toast(plan === 'PREMIUM' ? 'Plan Premium activado. Ya podés consultar profesionales.' : 'Volviste al Plan Básico.');
      onCambio();
      onCerrar();
    }
  };
  if (esPremium) {
    return (
      <Modal
        titulo="Tu Plan Premium"
        subtitulo="Podés volver al Plan Básico cuando quieras."
        abierto={abierto}
        onCerrar={onCerrar}
        pie={
          <>
            <Boton estilo="outline" onClick={onCerrar}>
              Mantener Premium
            </Boton>
            <Boton estilo="danger" cargando={accion.enviando} onClick={() => cambiar('BASICO')}>
              Volver al Plan Básico
            </Boton>
          </>
        }
      >
        <div className="modal-hero-icon" style={{ background: '#eee9ff', color: '#7b61ff' }}>
          <Icono n="sparkles" />
        </div>
        <p className="modal-text">
          Al volver al Básico se deja de sumar el adicional Premium ({dinero(precios?.adicionalPremium)}) en la próxima cuota sin pagar y se cierra el acceso al marketplace. Tus consultas ya
          confirmadas se mantienen.
        </p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
      </Modal>
    );
  }
  return (
    <Modal
      titulo="Plan Premium"
      subtitulo="Todo el Plan Básico y acceso a profesionales independientes."
      abierto={abierto}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton estilo="outline" onClick={onCerrar}>
            Continuar con Básico
          </Boton>
          <Boton icono="sparkles" cargando={accion.enviando} onClick={() => cambiar('PREMIUM')}>
            Elegir Premium
          </Boton>
        </>
      }
    >
      <div className="modal-hero-icon" style={{ background: '#eee9ff', color: '#7b61ff' }}>
        <Icono n="sparkles" />
      </div>
      <h3>{dinero(total)} por mes</h3>
      <p className="modal-text" style={{ margin: '12px 0' }}>
        {dinero(precios?.cuotaBase)} de cuota + {dinero(precios?.adicionalPremium)} de adicional Premium.
      </p>
      <div className="info-row discount-row">
        <span>Total con débito automático</span>
        <strong>{dinero(conDebito(total))} / mes</strong>
      </div>
      <ul className="pricing-list">
        {['Todas las funciones del Plan Básico', 'Marketplace de nutricionistas y deportólogos independientes', 'Solicitud y seguimiento de consultas', 'Gestión del plan desde tu perfil'].map((t) => (
          <li key={t}>
            <Icono n="check" />
            {t}
          </li>
        ))}
      </ul>
      <div className="soft-alert green">
        <Icono n="gift" />
        <div>
          <h4>Beneficios para ambos planes</h4>
          <p>La constancia y los incentivos de regreso también están disponibles en Básico.</p>
        </div>
      </div>
      <p className="page-note">El 10% del débito automático se aplica al total del Plan Premium. Las consultas profesionales se abonan por separado.</p>
      <ErrorFormulario>{accion.error}</ErrorFormulario>
    </Modal>
  );
}
