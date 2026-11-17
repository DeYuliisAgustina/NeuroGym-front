import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { ModalPremium, type PreciosPlanes } from '../../components/ModalPremium';
import { Composicion, ModalComprobante } from '../../components/VistaComprobante';
import { Boton, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, Modal, ModalExito, Nota, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Composicion as ComposicionImporte, Comprobante, Cuota, MedioPago } from '../../types';
import { dinero, fechaCorta, fechaLarga, mesAnio, MEDIO_PROTOTIPO } from '../../utils/formato';

interface Detalle {
  cuota: Cuota | null;
  /** Cuotas anteriores sin pagar: se eligen y regularizan por separado. */
  adeudadas: Cuota[];
  adhesion: { id: number; fechaAlta: string; idPreaprobacion: string } | null;
  importes: Record<MedioPago, ComposicionImporte> | null;
}
interface PerfilPlan {
  esPremium: boolean;
  plan: { tipo: 'BASICO' | 'PREMIUM' };
  preciosPlanes: PreciosPlanes;
}
interface PagoHistorial {
  id: number;
  medio: MedioPago;
  importe: string;
  estado: string;
  fecha: string;
  referenciaExterna: string | null;
  cuota: { periodo: string; adicionalPremium: string };
  comprobante: { numero: string } | null;
}
type ResultadoPago =
  | { tipo: 'REDIRECCION'; url: string; composicion: ComposicionImporte }
  | { tipo: 'DEBITO_PROGRAMADO'; composicion: ComposicionImporte }
  | { tipo: 'INFORMADO'; composicion: ComposicionImporte };

/** Orden de las opciones del prototipo: Efectivo, Débito automático, Mercado Pago. */
const OPCIONES: { medio: MedioPago; texto: string; detalle: string }[] = [
  { medio: 'EFECTIVO', texto: 'Efectivo', detalle: 'Sin descuento' },
  { medio: 'DEBITO_AUTOMATICO', texto: 'Débito automático', detalle: '10% sobre el total del plan' },
  { medio: 'PAGO_UNICO', texto: 'Mercado Pago', detalle: 'Precio de lista' },
];
const conDebito = (n: number) => Math.round(n * 0.9 * 100) / 100;

/**
 * Cuotas y pagos (CU-001, Figuras 32 a 34): planes, cuota del período,
 * medios de pago (patrón Strategy en el backend), pago único y adhesión al
 * débito con Mercado Pago, historial filtrable y comprobantes.
 */
export function CuotasPagos() {
  const [parametros, setParametros] = useSearchParams();
  const toast = useToast();
  const detalle = useApi(() => api.get<Detalle>('/socio/cuota'));
  const perfil = useApi(() => api.get<PerfilPlan>('/socio/perfil'));
  const integracion = useApi(() => api.get<{ mercadoPago: string }>('/pagos/integracion'));
  const [filtros, setFiltros] = useState({ busqueda: '', medio: '', fecha: '' });
  const consulta = {
    ...(filtros.medio ? { medio: filtros.medio } : {}),
    ...(filtros.fecha ? { desde: filtros.fecha, hasta: filtros.fecha } : {}),
    ...(/^\d{4}-\d{2}$/.test(filtros.busqueda.trim()) ? { periodo: filtros.busqueda.trim() } : filtros.busqueda.trim() ? { referencia: filtros.busqueda.trim() } : {}),
  };
  const historial = useApi(() => api.get<PagoHistorial[]>('/socio/pagos', consulta), [filtros.busqueda, filtros.medio, filtros.fecha]);
  const [medio, setMedio] = useState<MedioPago>('PAGO_UNICO');
  // Cuota que se abona: por defecto la del período; el socio puede elegir una vencida anterior.
  const [cuotaElegidaId, setCuotaElegidaId] = useState<number | null>(null);
  const importesElegida = useApi(
    () => (cuotaElegidaId ? api.get<Record<MedioPago, ComposicionImporte>>(`/cuotas/${cuotaElegidaId}/medios`) : Promise.resolve(null)),
    [cuotaElegidaId],
  );
  const [modal, setModal] = useState<'pago' | 'adhesion' | 'debito' | 'premium' | 'efectivo' | null>(null);
  const [autorizo, setAutorizo] = useState(false);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [retorno, setRetorno] = useState<{ titulo: string; texto: string } | null>(null);
  const accion = useAccion();

  // Regreso desde Mercado Pago: el backend confirma consultando la API oficial (no se confía en la URL).
  // El pago único (orden de Checkout Pro) vuelve con el id interno del pago; la adhesión, con preapproval_id.
  useEffect(() => {
    const resultado = parametros.get('resultado');
    const pagoId = parametros.get('pago');
    const preapprovalId = parametros.get('preapproval_id');
    if (!resultado && !pagoId && !preapprovalId) return;
    const confirmar = pagoId
      ? api.post<{ aprobado?: boolean }>('/pagos/confirmacion', { pagoId: Number(pagoId) })
      : preapprovalId
        ? api.post<{ autorizada?: boolean }>('/pagos/confirmacion', { preapprovalId })
        : Promise.resolve(null);
    void confirmar
      .catch(() => null)
      .then((r) => {
        if (resultado === 'rechazado') accion.setError('Mercado Pago no aprobó el pago. Tu cuota sigue pendiente y podés intentarlo de nuevo.');
        else if (r && ('aprobado' in r ? r.aprobado : 'autorizada' in r ? r.autorizada : false))
          setRetorno(
            preapprovalId
              ? { titulo: 'Débito automático activo.', texto: 'Mercado Pago confirmó tu adhesión. Las próximas cuotas se debitan con el 10% de descuento.' }
              : { titulo: 'Pago registrado.', texto: 'Mercado Pago confirmó tu pago. El comprobante ya está en tu historial.' },
          );
        else toast('Mercado Pago está procesando la operación. Te avisamos cuando se confirme.');
        setParametros({}, { replace: true });
        void detalle.recargar();
        void historial.recargar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (detalle.cargando || perfil.cargando) return <Cargando />;
  if (detalle.error) return <ErrorFormulario>{detalle.error}</ErrorFormulario>;
  const { cuota: delPeriodo, adhesion, importes: importesPeriodo } = detalle.datos!;
  const adeudadas = detalle.datos!.adeudadas ?? [];
  const elegidaVencida = adeudadas.find((c) => c.id === cuotaElegidaId);
  // La cuota que se muestra y se abona: la del período o la vencida que eligió el socio.
  const cuota = elegidaVencida ?? delPeriodo;
  const importes = elegidaVencida ? importesElegida.datos : importesPeriodo;
  const precios = perfil.datos?.preciosPlanes;
  const esPremium = !!perfil.datos?.esPremium;
  const planTexto = esPremium ? 'Premium' : 'Básico';
  const habilitados = cuota?.mediosHabilitados ?? OPCIONES.map((o) => o.medio);
  const opciones = OPCIONES.filter((o) => habilitados.includes(o.medio));
  const medioActivo = habilitados.includes(medio) ? medio : (opciones.at(-1)?.medio ?? 'PAGO_UNICO');
  const seleccion = importes?.[medioActivo];
  // Importe del débito: el informado por el backend o, con la cuota del período pagada, el del plan con 10 %.
  const totalPlan = (precios?.cuotaBase ?? 0) + (esPremium ? (precios?.adicionalPremium ?? 0) : 0);
  const debito: ComposicionImporte | undefined =
    importesPeriodo?.DEBITO_AUTOMATICO ??
    (precios
      ? ({
          medio: 'DEBITO_AUTOMATICO',
          cuotaBase: precios.cuotaBase,
          adicionalPremium: esPremium ? precios.adicionalPremium : 0,
          descuento: Math.round(totalPlan * 0.1 * 100) / 100,
          importeFinal: conDebito(totalPlan),
        } as ComposicionImporte)
      : undefined);
  const modoPrueba = integracion.datos?.mercadoPago === 'PRUEBA';
  const pendiente = cuota && cuota.estado !== 'PAGADA' && !cuota.debitoProgramado;

  // El débito automático siempre se gestiona sobre la cuota del período en curso.
  const iniciar = async (m: MedioPago) => {
    const destino = m === 'DEBITO_AUTOMATICO' ? delPeriodo : cuota;
    if (!destino) return;
    const r = await accion.ejecutar(() => api.post<ResultadoPago>(`/cuotas/${destino.id}/pagos`, { medio: m }));
    if (!r) return;
    if (r.tipo === 'REDIRECCION') window.location.href = r.url; // CU-001-006: se completa en Mercado Pago
    else if (r.tipo === 'DEBITO_PROGRAMADO') {
      setModal(null);
      toast(`Tu cuota se debita automáticamente por ${dinero(r.composicion.importeFinal)}.`);
    } else setModal('efectivo');
  };

  const verComprobante = async (pagoId: number) => {
    const c = await accion.ejecutar(() => api.get<Comprobante>(`/socio/pagos/${pagoId}/comprobante`));
    if (c) setComprobante(c);
  };

  const darDeBaja = async () => {
    if (await accion.ejecutar(() => api.delete('/socio/debito'))) {
      setModal(null);
      toast('Débito automático dado de baja. Podés pagar con Mercado Pago o en efectivo.');
      void detalle.recargar();
    }
  };

  const abrirDebito = () => {
    accion.limpiar();
    setAutorizo(false);
    setModal(adhesion ? 'debito' : 'adhesion');
  };

  const notaSeguridad = modoPrueba ? (
    <Nota>Pago en el sitio seguro de Mercado Pago (modo de prueba). NeuroGym no almacena datos de tarjetas.</Nota>
  ) : (
    <Nota icono="warning">Mercado Pago no está configurado en este entorno: el pago en línea no está disponible.</Nota>
  );

  return (
    <>
      <Encabezado
        ceja="MI CUOTA"
        titulo="Cuotas y pagos"
        subtitulo="Elegí tu plan, revisá los importes y consultá tus comprobantes."
        accion={
          cuota &&
          (cuota.estado === 'PAGADA' ? (
            <Insignia>Cuota al día</Insignia>
          ) : cuota.debitoProgramado ? (
            <Insignia color="neutral">Débito automático programado</Insignia>
          ) : cuota.estado === 'IMPAGA' ? (
            <Insignia color="danger">Venció el {fechaLarga(cuota.fechaVencimiento, false)}</Insignia>
          ) : (
            <Insignia color="warning">Vence el {fechaLarga(cuota.fechaVencimiento, false)}</Insignia>
          ))
        }
      />
      <ErrorFormulario>{accion.error}</ErrorFormulario>

      <div className="plan-prices">
        <article className={`plan-price-card ${!esPremium ? 'selected' : ''}`.trim()}>
          <div className="spread">
            <h3>Plan Básico</h3>
            {!esPremium && <Insignia>Tu plan</Insignia>}
          </div>
          <div className="plan-price-amount">
            {dinero(precios?.cuotaBase)}
            <small>/ mes</small>
          </div>
          <p>Turnos, rutinas, pagos y beneficios.</p>
          <div className="plan-debit-price">{dinero(conDebito(precios?.cuotaBase ?? 0))} con débito automático</div>
        </article>
        <article className={`plan-price-card premium ${esPremium ? 'selected' : ''}`.trim()}>
          <div className="spread">
            <h3>Plan Premium</h3>
            {esPremium && <Insignia color="lilac">Tu plan</Insignia>}
          </div>
          <div className="plan-price-amount">
            {dinero((precios?.cuotaBase ?? 0) + (precios?.adicionalPremium ?? 0))}
            <small>/ mes</small>
          </div>
          <p>
            Cuota {dinero(precios?.cuotaBase)} + adicional {dinero(precios?.adicionalPremium)}. Acceso a profesionales independientes.
          </p>
          <div className="plan-debit-price">{dinero(conDebito((precios?.cuotaBase ?? 0) + (precios?.adicionalPremium ?? 0)))} con débito automático</div>
          <Boton estilo="outline" chico icono="sparkles" onClick={() => setModal('premium')}>
            {esPremium ? 'Gestionar Premium' : 'Conocer Premium'}
          </Boton>
        </article>
      </div>
      <p className="pricing-policy">El 10% se aplica al precio total del plan elegido. Las consultas profesionales se contratan por separado y no forman parte de este importe.</p>

      <div className="two-col">
        <div className="stack">
          <section className="payment-main">
            {!cuota && <Vacio titulo="No tenés cuotas registradas" descripcion="La cuota del período aparecerá en este espacio." icono="wallet" />}
            {cuota && (
              <>
                {adeudadas.length > 0 && (
                  <div className="cuota-selector">
                    <label className="filter-field">
                      <span>Cuota a abonar</span>
                      <select
                        aria-label="Cuota a abonar"
                        value={cuotaElegidaId ?? ''}
                        onChange={(e) => {
                          accion.limpiar();
                          setCuotaElegidaId(e.target.value ? Number(e.target.value) : null);
                        }}
                      >
                        {delPeriodo && (
                          <option value="">
                            {mesAnio(delPeriodo.periodo)} · período en curso
                          </option>
                        )}
                        {adeudadas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {mesAnio(c.periodo)} · {c.estado === 'IMPAGA' ? 'vencida' : 'pendiente'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Nota icono="warning">
                      Tenés {adeudadas.length === 1 ? 'una cuota anterior' : `${adeudadas.length} cuotas anteriores`} sin pagar. Cada cuota se abona por separado y pagar una no modifica las demás.
                    </Nota>
                  </div>
                )}
                <div className="spread">
                  <div className="eyebrow">CUOTA DEL GIMNASIO</div>
                  {cuota.estado === 'PAGADA' ? (
                    <Insignia>Pagada</Insignia>
                  ) : cuota.debitoProgramado ? (
                    <Insignia color="neutral">Débito automático programado</Insignia>
                  ) : cuota.estado === 'IMPAGA' ? (
                    <Insignia color="danger">Impaga</Insignia>
                  ) : (
                    <Insignia color="warning">Pendiente</Insignia>
                  )}
                </div>
                <h2>{mesAnio(cuota.periodo)}</h2>
                {cuota.debitoProgramado ? (
                  <>
                    <div className="amount">
                      {dinero(debito?.importeFinal ?? cuota.importeFinal)}
                      <small>ARS</small>
                    </div>
                    <p>Débito automático · Plan {planTexto}</p>
                    <div className="fee-breakdown">
                      {debito && <Composicion cuotaBase={debito.cuotaBase} adicionalPremium={debito.adicionalPremium} descuento={debito.descuento} plan={planTexto} />}
                      <FilaDato etiqueta="Vencimiento">{fechaLarga(cuota.fechaVencimiento)}</FilaDato>
                    </div>
                    <Nota icono="refresh">
                      Mercado Pago debita esta cuota con tu adhesión. Cuando se confirme, pasa a pagada y recibís el comprobante. Si el débito se rechaza, vas a poder pagarla con Mercado Pago o en efectivo.
                    </Nota>
                  </>
                ) : pendiente && importes ? (
                  <>
                    <div className="payment-options" role="group" aria-label="Medio de pago">
                      {opciones.map((o) => (
                        <button
                          key={o.medio}
                          type="button"
                          className={`payment-option ${medioActivo === o.medio ? 'selected' : ''}`.trim()}
                          aria-pressed={medioActivo === o.medio}
                          onClick={() => setMedio(o.medio)}
                        >
                          <span>{o.texto}</span>
                          <strong>{dinero(importes[o.medio].importeFinal)}</strong>
                          <small>{o.detalle}</small>
                        </button>
                      ))}
                    </div>
                    <div className="amount">
                      {dinero(seleccion?.importeFinal)}
                      <small>ARS</small>
                    </div>
                    <p>
                      {MEDIO_PROTOTIPO[medioActivo]} · Plan {planTexto}
                    </p>
                    <div className="fee-breakdown">
                      {seleccion && <Composicion cuotaBase={seleccion.cuotaBase} adicionalPremium={seleccion.adicionalPremium} descuento={seleccion.descuento} plan={planTexto} />}
                      <FilaDato etiqueta="Vencimiento">{fechaLarga(cuota.fechaVencimiento)}</FilaDato>
                    </div>
                    {medioActivo === 'PAGO_UNICO' && (
                      <Boton icono="wallet" disabled={!modoPrueba} onClick={() => setModal('pago')}>
                        Pagar con Mercado Pago
                      </Boton>
                    )}
                    {medioActivo === 'DEBITO_AUTOMATICO' &&
                      (adhesion ? (
                        <Boton icono="refresh" cargando={accion.enviando} onClick={() => iniciar('DEBITO_AUTOMATICO')}>
                          Debitar esta cuota
                        </Boton>
                      ) : (
                        <Boton icono="refresh" disabled={!modoPrueba} onClick={abrirDebito}>
                          Adherirme al débito automático
                        </Boton>
                      ))}
                    {medioActivo === 'EFECTIVO' && (
                      <Boton icono="wallet" cargando={accion.enviando} onClick={() => iniciar('EFECTIVO')}>
                        Pagaré en administración
                      </Boton>
                    )}
                    {medioActivo === 'EFECTIVO' ? <Nota icono="building">El efectivo se abona en la administración de tu sede.</Nota> : notaSeguridad}
                  </>
                ) : pendiente ? (
                  <Cargando />
                ) : (
                  <>
                    <div className="amount">
                      {dinero(cuota.importeFinal)}
                      <small>ARS</small>
                    </div>
                    <p>Tu cuota está al día. El comprobante está en el historial.</p>
                    <div className="fee-breakdown">
                      <Composicion cuotaBase={cuota.cuotaBase} adicionalPremium={cuota.adicionalPremium} descuento={cuota.descuento} plan={planTexto} />
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          <section className="card">
            <CabeceraTarjeta titulo="Historial de pagos" subtitulo="Comprobantes por período." />
            <div className="list-filters" aria-label="Filtros de búsqueda">
              <label className="filter-field filter-search">
                <span>Buscar</span>
                <div className="search-input">
                  <Icono n="search" />
                  <input
                    type="search"
                    aria-label="Buscar período o referencia"
                    placeholder="Buscar período (AAAA-MM) o referencia"
                    value={filtros.busqueda}
                    onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  />
                </div>
              </label>
              <label className="filter-field">
                <span>Medio de pago</span>
                <select aria-label="Medio de pago" value={filtros.medio} onChange={(e) => setFiltros({ ...filtros, medio: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="DEBITO_AUTOMATICO">Débito automático</option>
                  <option value="PAGO_UNICO">Mercado Pago</option>
                </select>
              </label>
              <label className="filter-field">
                <span>Fecha de pago</span>
                <input type="date" aria-label="Fecha de pago" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })} />
              </label>
              <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={() => setFiltros({ busqueda: '', medio: '', fecha: '' })}>
                Limpiar filtros
              </Boton>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {historial.datos?.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{mesAnio(p.cuota.periodo)}</strong>
                        <small>
                          Plan {Number(p.cuota.adicionalPremium) > 0 ? 'Premium' : 'Básico'} · {MEDIO_PROTOTIPO[p.medio]}
                        </small>
                      </td>
                      <td>{fechaCorta(p.fecha)}</td>
                      <td>{dinero(p.importe)}</td>
                      <td>
                        {p.estado === 'APROBADO' ? <Insignia>Pagado</Insignia> : p.estado === 'RECHAZADO' ? <Insignia color="danger">Rechazado</Insignia> : <Insignia color="warning">Pendiente</Insignia>}
                      </td>
                      <td>
                        {p.comprobante && (
                          <button className="icon-button" type="button" aria-label={`Ver comprobante ${mesAnio(p.cuota.periodo)}`} onClick={() => verComprobante(p.id)}>
                            <Icono n="receipt" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historial.datos?.length === 0 &&
                (filtros.busqueda || filtros.medio || filtros.fecha ? (
                  <Vacio titulo="Sin comprobantes para estos filtros" descripcion="Podés limpiar los filtros y ver todos tus pagos." icono="search" />
                ) : (
                  <Vacio titulo="Todavía no hay pagos" descripcion="Tus comprobantes aparecerán en este espacio." icono="receipt" />
                ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Débito automático" subtitulo="10% de descuento sobre el total del plan." />
            <div className="payment-method">
              <div className="flex">
                <div className="mp-mark">
                  <Icono n="wallet" />
                </div>
                <div>
                  <h3>{dinero(debito?.importeFinal ?? conDebito((precios?.cuotaBase ?? 0) + (esPremium ? (precios?.adicionalPremium ?? 0) : 0)))} por mes</h3>
                  <p>Plan {planTexto}</p>
                </div>
              </div>
              <button className={`toggle ${adhesion ? 'on' : ''}`.trim()} type="button" aria-label={adhesion ? 'Gestionar débito automático' : 'Activar débito automático'} aria-pressed={!!adhesion} onClick={abrirDebito}>
                <span />
              </button>
            </div>
            <div className="divider" />
            {debito && <Composicion cuotaBase={debito.cuotaBase} adicionalPremium={debito.adicionalPremium} descuento={debito.descuento} plan={planTexto} />}
            <p className="modal-text" style={{ margin: '16px 0' }}>
              Podés adherirte o dar de baja el débito automático desde tu cuenta.
            </p>
            <FilaDato etiqueta="Estado">{adhesion ? `Adherido desde el ${fechaLarga(adhesion.fechaAlta, false)}` : 'Sin adhesión'}</FilaDato>
            <Boton estilo="outline" completo chico icono="refresh" onClick={abrirDebito}>
              {adhesion ? 'Gestionar adhesión' : 'Adherirme'}
            </Boton>
          </section>
          <aside className="soft-alert green">
            <Icono n="wallet" />
            <div>
              <h4>Pago en efectivo en administración</h4>
              <p>
                Plan {planTexto}: {dinero(importes?.EFECTIVO.importeFinal ?? cuota?.importeFinal)}, sin descuento. Administración registra el cobro y habilita el comprobante.
              </p>
            </div>
          </aside>
          <section className="card">
            <CabeceraTarjeta titulo="Mi plan" subtitulo={`Plan ${planTexto}.`} />
            <div className="spread">
              <h3>{planTexto}</h3>
              <Insignia color={esPremium ? 'lilac' : 'neutral'}>{planTexto}</Insignia>
            </div>
            <FilaDato etiqueta="Precio mensual">{dinero((precios?.cuotaBase ?? 0) + (esPremium ? (precios?.adicionalPremium ?? 0) : 0))}</FilaDato>
            <p className="modal-text" style={{ margin: '14px 0' }}>
              Los beneficios por asistencia están disponibles en ambos planes. Las consultas profesionales se contratan por separado.
            </p>
            <Boton estilo="outline" chico icono="sparkles" onClick={() => setModal('premium')}>
              {esPremium ? 'Gestionar Premium' : 'Conocer Premium'}
            </Boton>
          </section>
        </div>
      </div>

      {/* Figura 33 (a): confirmación previa al pago único en Mercado Pago. */}
      <Modal
        titulo="Pago con Mercado Pago"
        subtitulo={cuota ? `Cuota del gimnasio · ${mesAnio(cuota.periodo)}` : ''}
        abierto={modal === 'pago'}
        onCerrar={() => setModal(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setModal(null)}>
              Volver
            </Boton>
            <Boton icono="arrow" cargando={accion.enviando} onClick={() => iniciar('PAGO_UNICO')}>
              Continuar a Mercado Pago
            </Boton>
          </>
        }
      >
        <div className="payment-method">
          <div className="flex">
            <div className="mp-mark">
              <Icono n="wallet" />
            </div>
            <div>
              <h3>Mercado Pago</h3>
              <p>Pago único · sin adhesión al débito</p>
            </div>
          </div>
          {modoPrueba && <Insignia color="neutral">Modo de prueba</Insignia>}
        </div>
        <div className="divider" />
        {importes && <Composicion cuotaBase={importes.PAGO_UNICO.cuotaBase} adicionalPremium={importes.PAGO_UNICO.adicionalPremium} descuento={0} plan={planTexto} />}
        <div className="info-row">
          <span>Total sin descuento</span>
          <strong style={{ fontSize: 24 }}>{dinero(importes?.PAGO_UNICO.importeFinal)}</strong>
        </div>
        <p className="modal-text" style={{ marginTop: 17 }}>
          Vas a completar el pago en el sitio de Mercado Pago. Cuando se apruebe, la cuota pasa a pagada y el comprobante queda en tu historial.
        </p>
        <p className="page-note">Este pago puntual no activa el débito automático.</p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
      </Modal>

      {/* Figura 34 (a): adhesión al débito automático mediante Mercado Pago. */}
      <Modal
        titulo="Adherirme al débito automático"
        subtitulo="Autorizás el débito mensual desde Mercado Pago."
        abierto={modal === 'adhesion'}
        onCerrar={() => setModal(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setModal(null)}>
              Volver
            </Boton>
            <Boton icono="arrow" disabled={!autorizo} cargando={accion.enviando} onClick={() => iniciar('DEBITO_AUTOMATICO')}>
              Continuar a Mercado Pago y adherirme
            </Boton>
          </>
        }
      >
        <section className="receipt">
          {debito && <Composicion cuotaBase={debito.cuotaBase} adicionalPremium={debito.adicionalPremium} descuento={debito.descuento} plan={planTexto} />}
          <FilaDato etiqueta="Total con débito automático">{dinero(debito?.importeFinal)}</FilaDato>
        </section>
        {delPeriodo?.estado === 'PAGADA' ? (
          <p className="page-note">Tu cuota de {mesAnio(delPeriodo.periodo)} ya está pagada: Mercado Pago hará el primer débito el mes que viene.</p>
        ) : (
          delPeriodo && <p className="page-note">Mercado Pago debita en el acto la cuota de {mesAnio(delPeriodo.periodo)}. Las cuotas anteriores se abonan por separado.</p>
        )}
        <label className="check-field">
          <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} />
          Autorizo la adhesión al débito automático. Puedo cancelarla desde mi cuenta.
        </label>
        <p className="page-note">La tarjeta se vincula en Mercado Pago; NeuroGym no recibe ni guarda sus datos.</p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
      </Modal>

      {/* Figura 34 (b): gestión de la adhesión activa. */}
      <Modal
        titulo="Gestionar débito automático"
        subtitulo="La adhesión es voluntaria y cancelable."
        abierto={modal === 'debito'}
        onCerrar={() => setModal(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setModal(null)}>
              Mantener adhesión
            </Boton>
            <Boton estilo="danger" cargando={accion.enviando} onClick={darDeBaja}>
              Dar de baja el débito automático
            </Boton>
          </>
        }
      >
        <section className="receipt">
          <FilaDato etiqueta="Medio vinculado">Mercado Pago · {adhesion?.idPreaprobacion.slice(-6)}</FilaDato>
          {debito && <Composicion cuotaBase={debito.cuotaBase} adicionalPremium={debito.adicionalPremium} descuento={debito.descuento} plan={planTexto} />}
          <FilaDato etiqueta="Total del plan con descuento">{dinero(debito?.importeFinal)}</FilaDato>
        </section>
        <p className="modal-text">La baja detiene los débitos posteriores. Los comprobantes emitidos conservan sus importes.</p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
      </Modal>

      <ModalExito
        abierto={modal === 'efectivo'}
        titulo="Te esperamos en administración."
        descripcion={`Abonás ${dinero(importes?.EFECTIVO.importeFinal)} en efectivo. Tu cuota se actualiza cuando el gimnasio registre el cobro.`}
        boton="Entendido"
        onCerrar={() => setModal(null)}
      />
      <ModalExito abierto={!!retorno} titulo={retorno?.titulo ?? ''} descripcion={retorno?.texto ?? ''} onCerrar={() => setRetorno(null)} />
      <ModalComprobante comprobante={comprobante} onCerrar={() => setComprobante(null)} />
      <ModalPremium
        abierto={modal === 'premium'}
        onCerrar={() => setModal(null)}
        precios={precios}
        esPremium={perfil.datos?.plan.tipo === 'PREMIUM'}
        onCambio={() => {
          void perfil.recargar();
          void detalle.recargar();
        }}
      />
    </>
  );
}
