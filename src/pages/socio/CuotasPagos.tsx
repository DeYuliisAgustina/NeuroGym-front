import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { VistaComprobante } from '../../components/VistaComprobante';
import { Aviso, Boton, Cargando, Campo, EncabezadoPagina, Estado, Modal, Selector, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Composicion, Comprobante, Cuota, MedioPago } from '../../types';
import { dinero, etiqueta, fecha } from '../../utils/formato';

interface Detalle {
  cuota: Cuota | null;
  adhesion: { id: number; fechaAlta: string } | null;
  importes: Record<MedioPago, Composicion> | null;
}
interface PagoHistorial {
  id: number;
  medio: MedioPago;
  importe: string;
  estado: string;
  fecha: string;
  referenciaExterna: string | null;
  cuota: { periodo: string };
  comprobante: { numero: string } | null;
}
type ResultadoPago =
  | { tipo: 'REDIRECCION'; url: string; composicion: Composicion }
  | { tipo: 'DEBITO_PROGRAMADO'; composicion: Composicion }
  | { tipo: 'INFORMADO'; composicion: Composicion };

const MEDIOS: MedioPago[] = ['PAGO_UNICO', 'DEBITO_AUTOMATICO', 'EFECTIVO'];

/** Cuotas y pagos (CU-001): detalle, medio de pago, Mercado Pago, débito, historial y comprobantes. */
export function CuotasPagos() {
  const [parametros] = useSearchParams();
  const detalle = useApi(() => api.get<Detalle>('/socio/cuota'));
  const [filtros, setFiltros] = useState({ medio: '', periodo: '' });
  const historial = useApi(() => api.get<PagoHistorial[]>('/socio/pagos', filtros), [filtros.medio, filtros.periodo]);
  const [medio, setMedio] = useState<MedioPago>('PAGO_UNICO');
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [gestionarDebito, setGestionarDebito] = useState(false);
  const [informado, setInformado] = useState<string | null>(null);
  const accion = useAccion();
  const resultado = parametros.get('resultado');

  useEffect(() => {
    if (resultado) void detalle.recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado]);

  if (detalle.cargando) return <Cargando />;
  if (detalle.error) return <Aviso tipo="error">{detalle.error}</Aviso>;
  const { cuota, adhesion, importes } = detalle.datos!;
  const seleccion = importes?.[medio];

  const pagar = async () => {
    if (!cuota) return;
    const r = await accion.ejecutar(() => api.post<ResultadoPago>(`/cuotas/${cuota.id}/pagos`, { medio }));
    if (!r) return;
    if (r.tipo === 'REDIRECCION') window.location.href = r.url; // CU-001-006: se completa en Mercado Pago
    else if (r.tipo === 'DEBITO_PROGRAMADO') setInformado(`Tu cuota se debitará automáticamente por ${dinero(r.composicion.importeFinal)} con el 10 % de descuento.`);
    else setInformado(`Abonás ${dinero(r.composicion.importeFinal)} en administración. La cuota se actualizará cuando el personal registre el cobro.`);
  };

  const verComprobante = async (pagoId: number) => {
    const c = await accion.ejecutar(() => api.get<Comprobante>(`/socio/pagos/${pagoId}/comprobante`));
    if (c) setComprobante(c);
  };

  const darDeBajaDebito = async () => {
    if (await accion.ejecutar(() => api.delete('/socio/debito'), 'Débito automático dado de baja.')) {
      setGestionarDebito(false);
      void detalle.recargar();
    }
  };

  return (
    <div>
      <EncabezadoPagina titulo="Cuotas y pagos" />
      {resultado === 'aprobado' && <Aviso tipo="exito">Mercado Pago informó el pago. Cuando se confirme, vas a ver el comprobante en el historial.</Aviso>}
      {resultado === 'rechazado' && <Aviso tipo="error">El pago no pudo realizarse. La cuota sigue pendiente.</Aviso>}
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <Aviso tipo="info">{informado}</Aviso>

      {!cuota && <Vacio>No tenés cuotas registradas.</Vacio>}
      {cuota && (
        <div className="grilla-2">
          <div className="tarjeta">
            <div className="fila-entre">
              <h2>Cuota {cuota.periodo}</h2>
              <Estado valor={cuota.estado} />
            </div>
            <p className="tenue">Vence el {fecha(cuota.fechaVencimiento)}</p>
            {cuota.estado === 'PAGADA' ? (
              <p>Tu cuota está al día. Podés ver el comprobante en el historial.</p>
            ) : (
              <>
                <h3>Elegí cómo pagar</h3>
                <div className="pila">
                  {MEDIOS.map((m) => (
                    <label key={m} className="check tarjeta" style={{ padding: '0.7rem', cursor: 'pointer' }}>
                      <input type="radio" name="medio" checked={medio === m} onChange={() => setMedio(m)} />
                      <span style={{ flex: 1 }}>
                        <strong>{etiqueta(m)}</strong>
                        <br />
                        <small>{m === 'DEBITO_AUTOMATICO' ? '10 % de descuento sobre el total del plan' : 'Precio de lista, sin descuento'}</small>
                      </span>
                      <strong className="importe">{dinero(importes?.[m].importeFinal)}</strong>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="tarjeta">
            <h3>Composición</h3>
            {seleccion && cuota.estado !== 'PAGADA' ? (
              <table>
                <tbody>
                  <tr><td>Cuota base</td><td className="importe">{dinero(seleccion.cuotaBase)}</td></tr>
                  <tr><td>Adicional Premium</td><td className="importe">{dinero(seleccion.adicionalPremium)}</td></tr>
                  <tr><td>Descuento</td><td className="importe">−{dinero(seleccion.descuento)}</td></tr>
                  <tr><td><strong>Total</strong></td><td className="importe"><strong>{dinero(seleccion.importeFinal)}</strong></td></tr>
                </tbody>
              </table>
            ) : (
              <table>
                <tbody>
                  <tr><td>Cuota base</td><td>{dinero(cuota.cuotaBase)}</td></tr>
                  <tr><td>Adicional Premium</td><td>{dinero(cuota.adicionalPremium)}</td></tr>
                  <tr><td>Descuento</td><td>−{dinero(cuota.descuento)}</td></tr>
                  <tr><td><strong>Importe</strong></td><td><strong>{dinero(cuota.importeFinal)}</strong></td></tr>
                </tbody>
              </table>
            )}
            {cuota.estado !== 'PAGADA' && (
              <Boton bloque cargando={accion.enviando} onClick={pagar} style={{ marginTop: '1rem' }}>
                {medio === 'PAGO_UNICO' ? 'Pagar con Mercado Pago' : medio === 'DEBITO_AUTOMATICO' ? (adhesion ? 'Ver débito programado' : 'Adherirme al débito automático') : 'Pagaré en administración'}
              </Boton>
            )}
            {medio === 'DEBITO_AUTOMATICO' && !adhesion && cuota.estado !== 'PAGADA' && (
              <small>La adhesión es voluntaria y podés cancelarla desde tu cuenta cuando quieras.</small>
            )}
            <hr className="separador" />
            <div className="fila-entre">
              <span>Débito automático: {adhesion ? <span className="etiqueta etiqueta-ok">Activo</span> : <span className="etiqueta">No adherido</span>}</span>
              {adhesion && (
                <Boton variante="texto" chico onClick={() => setGestionarDebito(true)}>
                  Gestionar débito automático
                </Boton>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="tarjeta" style={{ marginTop: '1rem' }}>
        <div className="fila-entre">
          <h2>Historial de pagos</h2>
          <div className="fila">
            <Selector etiqueta="Medio" vacio="Todos" value={filtros.medio} onChange={(e) => setFiltros({ ...filtros, medio: e.target.value })} opciones={MEDIOS.map((m) => ({ valor: m, texto: etiqueta(m) }))} />
            <Campo etiqueta="Período" type="month" value={filtros.periodo} onChange={(e) => setFiltros({ ...filtros, periodo: e.target.value })} />
            {(filtros.medio || filtros.periodo) && (
              <Boton variante="texto" chico onClick={() => setFiltros({ medio: '', periodo: '' })}>
                Limpiar filtros
              </Boton>
            )}
          </div>
        </div>
        {historial.datos?.length === 0 && <Vacio>{filtros.medio || filtros.periodo ? 'Sin comprobantes para estos filtros' : 'Aún no hay comprobantes.'}</Vacio>}
        <div className="tabla-scroll">
          <table>
            <tbody>
              {historial.datos?.map((p) => (
                <tr key={p.id}>
                  <td>{p.cuota.periodo}</td>
                  <td>{fecha(p.fecha)}</td>
                  <td>{etiqueta(p.medio)}</td>
                  <td className="importe">{dinero(p.importe)}</td>
                  <td><Estado valor={p.estado} /></td>
                  <td>
                    {p.comprobante && (
                      <Boton variante="texto" chico onClick={() => verComprobante(p.id)}>
                        Ver comprobante
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal titulo="Tu comprobante" abierto={!!comprobante} onCerrar={() => setComprobante(null)}>
        {comprobante && <VistaComprobante comprobante={comprobante} alCerrar={() => setComprobante(null)} />}
      </Modal>
      <Modal titulo="Gestionar débito automático" abierto={gestionarDebito} onCerrar={() => setGestionarDebito(false)}>
        <p>Tu adhesión está activa. Si la das de baja, podés seguir pagando con Mercado Pago o en efectivo, pero dejará de aplicarse el 10 % de descuento desde la cuota siguiente.</p>
        <div className="fila">
          <Boton variante="secundario" onClick={() => setGestionarDebito(false)}>
            Mantener adhesión
          </Boton>
          <Boton variante="peligro" cargando={accion.enviando} onClick={darDeBajaDebito}>
            Dar de baja el débito automático
          </Boton>
        </div>
      </Modal>
    </div>
  );
}
