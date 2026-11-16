import { useNavigate, useSearchParams } from 'react-router-dom';
import { Aviso, Boton } from '../../components/ui';
import { useAccion } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero } from '../../utils/formato';

/**
 * SIMULADOR de Mercado Pago (solo en desarrollo, sin credenciales). Reemplaza
 * el checkout real: el resultado elegido recorre el mismo flujo de la fachada
 * CuotaService que una notificación (webhook) real. No mueve dinero.
 */
export function SimuladorPago() {
  const [p] = useSearchParams();
  const navegar = useNavigate();
  const accion = useAccion();
  const tipo = p.get('tipo') as 'PAGO' | 'ADHESION';
  const importe = Number(p.get('importe'));

  const resolver = async (aprobar: boolean) => {
    const cuerpo = tipo === 'PAGO' ? { tipo, pagoId: Number(p.get('pagoId')), aprobar } : { tipo, socioId: Number(p.get('socioId')), aprobar };
    const ok = await accion.ejecutar(() => api.post('/pagos/simulador', cuerpo));
    if (ok) navegar(`/socio/cuotas?resultado=${aprobar ? (tipo === 'PAGO' ? 'aprobado' : 'adhesion') : 'rechazado'}`);
  };

  const simularDebito = async () => {
    const ok = await accion.ejecutar(() => api.post('/pagos/simulador', { tipo: 'DEBITO', socioId: Number(p.get('socioId')), aprobar: true }));
    if (ok) navegar('/socio/cuotas?resultado=aprobado');
  };

  return (
    <div className="contenedor" style={{ maxWidth: 480, paddingTop: '2rem' }}>
      <div className="tarjeta pila">
        <span className="etiqueta etiqueta-violeta">Simulación de Mercado Pago · entorno de desarrollo</span>
        <h1>{tipo === 'PAGO' ? 'Pago con Mercado Pago' : 'Autorizar débito automático'}</h1>
        <p>
          {tipo === 'PAGO' ? 'Total a pagar' : 'Importe mensual con descuento'}: <strong>{dinero(importe)}</strong>
        </p>
        <Aviso tipo="info">No se realizan cobros reales. Elegí el resultado que informaría Mercado Pago.</Aviso>
        <Aviso tipo="error">{accion.error}</Aviso>
        <div className="fila">
          <Boton cargando={accion.enviando} onClick={() => resolver(true)}>
            {tipo === 'PAGO' ? 'Aprobar pago' : 'Autorizar adhesión'}
          </Boton>
          <Boton variante="peligro" cargando={accion.enviando} onClick={() => resolver(false)}>
            Rechazar
          </Boton>
          <Boton variante="secundario" onClick={() => navegar('/socio/cuotas')}>
            Abandonar
          </Boton>
        </div>
        {tipo === 'ADHESION' && (
          <small>
            Con la adhesión activa, podés simular el débito mensual:{' '}
            <button className="btn btn-texto btn-chico" onClick={simularDebito}>
              Simular débito de la cuota
            </button>
          </small>
        )}
      </div>
    </div>
  );
}
