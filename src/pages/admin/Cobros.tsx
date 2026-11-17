import { useState } from 'react';
import { Icono } from '../../components/Icono';
import { Composicion, ModalComprobante } from '../../components/VistaComprobante';
import { Boton, Encabezado, ErrorFormulario, FilaDato, Insignia, Kpi, Modal, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Comprobante, Sede } from '../../types';
import { dinero, hoyIso, MEDIO_PROTOTIPO, mesAnio } from '../../utils/formato';

interface CuotaFila {
  id: number;
  periodo: string;
  estado: 'PENDIENTE' | 'PAGADA' | 'IMPAGA';
  cuotaBase: string;
  adicionalPremium: string;
  descuento: string;
  importeFinal: string;
  socio: { usuario: { nombre: string; apellido: string; email: string }; sede: { nombre: string } };
  pagos: { id: number; medio: string; estado: string; importe: string; comprobante: { numero: string } | null; responsable: { usuario: { nombre: string; apellido: string } } | null }[];
}
interface Resumen {
  cuotas: { estado: string; cantidad: number; importe: number }[];
  pagosPorMedio: { medio: string; cantidad: number; importe: number }[];
}
interface Plan {
  tipo: 'BASICO' | 'PREMIUM';
  importeVigente: number;
}

const ESTADO: Record<CuotaFila['estado'], [string, '' | 'warning' | 'danger']> = { PAGADA: ['Al día', ''], PENDIENTE: ['Pendiente', 'warning'], IMPAGA: ['Impaga', 'danger'] };
const plan = (c: CuotaFila) => (Number(c.adicionalPremium) > 0 ? 'Premium' : 'Básico');

/** Cuotas y cobros (RF19, RNF13, Figura 67): estados por socio, efectivo recibido y comprobantes. */
export function Cobros() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('COBROS', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [filtros, setFiltros] = useState({ periodo: hoyIso().slice(0, 7), estado: '', plan: '', busqueda: '' });
  const cuotas = useApi(
    () => api.get<CuotaFila[]>('/admin/cuotas', { periodo: filtros.periodo, ...(filtros.estado ? { estado: filtros.estado } : {}), ...(filtros.busqueda ? { busqueda: filtros.busqueda } : {}), ...(sedeId ? { sedeId } : {}) }),
    [filtros.periodo, filtros.estado, filtros.busqueda, sedeId],
  );
  const resumen = useApi(() => api.get<Resumen>('/admin/cuotas/resumen', { periodo: filtros.periodo }), [filtros.periodo]);
  const planes = useApi(() => (puede('PRECIOS') ? api.get<Plan[]>('/admin/planes') : Promise.resolve(null)));
  const sedes = useApi(() => (puede('SEDES') ? api.get<Sede[]>('/admin/sedes') : Promise.resolve([] as Sede[])));
  const [cobrar, setCobrar] = useState<CuotaFila | null>(null);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const accion = useAccion();

  const lista = (cuotas.datos ?? []).filter((c) => !filtros.plan || plan(c) === filtros.plan);
  const total = resumen.datos?.cuotas.reduce((t, c) => t + c.cantidad, 0) ?? 0;
  const pendientes = resumen.datos?.cuotas.filter((c) => c.estado !== 'PAGADA').reduce((t, c) => t + c.cantidad, 0) ?? 0;
  const cobrado = resumen.datos?.pagosPorMedio.reduce((t, p) => t + p.importe, 0) ?? 0;
  const basico = planes.datos?.find((p) => p.tipo === 'BASICO')?.importeVigente;
  const premium = planes.datos?.find((p) => p.tipo === 'PREMIUM')?.importeVigente;

  const registrar = async () => {
    if (!cobrar) return;
    const r = await accion.ejecutar(() => api.post<{ pagoId: number; comprobanteEnviado: boolean }>(`/admin/cuotas/${cobrar.id}/efectivo`));
    if (r) {
      setCobrar(null);
      toast(r.comprobanteEnviado ? 'Cobro registrado. El comprobante se envió por WhatsApp.' : 'Cobro registrado. El envío por WhatsApp falló; el comprobante queda en el historial.');
      void cuotas.recargar();
      void resumen.recargar();
    }
  };
  const verComprobante = async (pagoId: number) => {
    const c = await accion.ejecutar(() => api.get<Comprobante>(`/admin/pagos/${pagoId}/comprobante`));
    if (c) setComprobante(c);
  };
  const limpiar = () => {
    setFiltros({ periodo: hoyIso().slice(0, 7), estado: '', plan: '', busqueda: '' });
    setSedeId('');
  };

  return (
    <>
      <Encabezado
        ceja="COBROS DEL GIMNASIO"
        titulo="Cuotas y cobros"
        subtitulo="Registrá el efectivo recibido y consultá comprobantes por socio."
        accion={
          <label className="filter-field">
            <span className="sr-only">Período</span>
            <input type="month" aria-label="Período" value={filtros.periodo} onChange={(e) => setFiltros({ ...filtros, periodo: e.target.value || hoyIso().slice(0, 7) })} />
          </label>
        }
      />
      <div className="kpi-grid">
        <Kpi etiqueta="Cuotas registradas" valor={total} pie={mesAnio(filtros.periodo)} icono="check" />
        <Kpi etiqueta="Pendientes" valor={pendientes} pie="Pendientes e impagas" icono="clock" />
        {basico !== undefined ? <Kpi etiqueta="Básico" valor={dinero(basico)} pie="Precio de lista" icono="wallet" /> : <Kpi etiqueta="Cobrado" valor={dinero(cobrado)} pie="Pagos aprobados del período" icono="wallet" />}
        {premium !== undefined && basico !== undefined ? (
          <Kpi etiqueta="Premium" valor={dinero(basico + premium)} pie="Cuota + adicional" icono="sparkles" />
        ) : (
          <Kpi etiqueta="Medios de pago" valor={resumen.datos?.pagosPorMedio.length ?? 0} pie="Con pagos aprobados" icono="sparkles" />
        )}
      </div>
      <ErrorFormulario>{!cobrar ? accion.error : null}</ErrorFormulario>
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar socio o correo" placeholder="Buscar socio o correo" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
          </div>
        </label>
        {!!sedes.datos?.length && (
          <label className="filter-field">
            <span>Sede</span>
            <select aria-label="Filtrar por sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Todas las sedes</option>
              {sedes.datos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="filter-field">
          <span>Estado</span>
          <select aria-label="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="IMPAGA">Impaga</option>
            <option value="PAGADA">Al día</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Plan</span>
          <select aria-label="Plan" value={filtros.plan} onChange={(e) => setFiltros({ ...filtros, plan: e.target.value })}>
            <option value="">Todos</option>
            <option>Básico</option>
            <option>Premium</option>
          </select>
        </label>
        <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={limpiar}>
          Limpiar filtros
        </Boton>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Plan</th>
                <th>Cuota</th>
                <th>Estado</th>
                <th>Medio</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const aprobado = c.pagos.find((p) => p.estado === 'APROBADO');
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.socio.usuario.nombre} {c.socio.usuario.apellido}
                      </strong>
                      <small>{c.socio.sede.nombre}</small>
                    </td>
                    <td>
                      <Insignia color={plan(c) === 'Premium' ? 'lilac' : 'neutral'}>{plan(c)}</Insignia>
                    </td>
                    <td>{dinero(aprobado?.importe ?? c.importeFinal)}</td>
                    <td>
                      <Insignia color={ESTADO[c.estado][1]}>{ESTADO[c.estado][0]}</Insignia>
                    </td>
                    <td>
                      {aprobado ? MEDIO_PROTOTIPO[aprobado.medio] : 'A confirmar'}
                      {aprobado?.responsable && (
                        <small>
                          Registró {aprobado.responsable.usuario.nombre} {aprobado.responsable.usuario.apellido}
                        </small>
                      )}
                    </td>
                    <td>
                      {aprobado?.comprobante ? (
                        <Boton estilo="outline" chico icono="receipt" onClick={() => verComprobante(aprobado.id)}>
                          Ver comprobante
                        </Boton>
                      ) : (
                        gestion &&
                        c.estado !== 'PAGADA' && (
                          <Boton
                            chico
                            icono="wallet"
                            onClick={() => {
                              accion.limpiar();
                              setCobrar(c);
                            }}
                          >
                            Registrar efectivo
                          </Boton>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {cuotas.datos && lista.length === 0 && <Vacio titulo="No hay cuotas para estos filtros" descripcion="Probá con otro período o limpiá los filtros." icono="wallet" />}
      </section>
      <aside className="soft-alert green section-gap">
        <Icono n="wallet" />
        <div>
          <h4>El descuento corresponde exclusivamente al débito automático</h4>
          <p>Efectivo y pago único con Mercado Pago mantienen el precio completo. Cada comprobante conserva los importes del momento del pago.</p>
        </div>
      </aside>

      {/* Figura 67: registro del efectivo recibido (RF19). */}
      <Modal
        titulo="Registrar efectivo recibido"
        subtitulo={cobrar ? `${cobrar.socio.usuario.nombre} ${cobrar.socio.usuario.apellido} · ${mesAnio(cobrar.periodo)}` : ''}
        abierto={!!cobrar}
        onCerrar={() => setCobrar(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setCobrar(null)}>
              Volver
            </Boton>
            <Boton icono="check" cargando={accion.enviando} onClick={registrar}>
              Confirmar cobro
            </Boton>
          </>
        }
      >
        {cobrar && (
          <>
            <section className="receipt">
              <Composicion cuotaBase={Number(cobrar.cuotaBase)} adicionalPremium={Number(cobrar.adicionalPremium)} descuento={0} plan={plan(cobrar)} />
              <FilaDato etiqueta="Efectivo sin descuento">{dinero(Number(cobrar.cuotaBase) + Number(cobrar.adicionalPremium))}</FilaDato>
            </section>
            <p className="page-note">La cuota pasará a pagada y se conservará este importe. El comprobante se envía al socio por WhatsApp y queda registrado con tu usuario como responsable.</p>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
          </>
        )}
      </Modal>
      <ModalComprobante comprobante={comprobante} onCerrar={() => setComprobante(null)} />
    </>
  );
}
