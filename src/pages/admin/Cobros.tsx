import { useState } from 'react';
import { VistaComprobante } from '../../components/VistaComprobante';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Kpi, Modal, Selector, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Comprobante } from '../../types';
import { dinero, etiqueta, hoyIso } from '../../utils/formato';

interface CuotaFila {
  id: number;
  periodo: string;
  estado: string;
  importeFinal: string;
  socio: { usuario: { nombre: string; apellido: string; email: string }; sede: { nombre: string } };
  pagos: { id: number; medio: string; estado: string; importe: string; comprobante: { numero: string } | null; responsable: { usuario: { nombre: string; apellido: string } } | null }[];
}
interface Resumen {
  cuotas: { estado: string; cantidad: number; importe: number }[];
  pagosPorMedio: { medio: string; cantidad: number; importe: number }[];
}

/** Cuotas y cobros del gimnasio: estados, comprobantes y pagos en efectivo (RF19, RNF13). */
export function Cobros() {
  const { puede } = useAuth();
  const gestion = puede('COBROS', 'GESTION');
  const [filtros, setFiltros] = useState({ periodo: hoyIso().slice(0, 7), estado: '', busqueda: '' });
  const cuotas = useApi(() => api.get<CuotaFila[]>('/admin/cuotas', filtros), [filtros.periodo, filtros.estado, filtros.busqueda]);
  const resumen = useApi(() => api.get<Resumen>('/admin/cuotas/resumen', { periodo: filtros.periodo }), [filtros.periodo]);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const accion = useAccion();

  const efectivo = async (c: CuotaFila) => {
    if (!window.confirm(`¿Registrar el pago en efectivo de ${c.socio.usuario.nombre} ${c.socio.usuario.apellido} (${c.periodo})?`)) return;
    const r = await accion.ejecutar(() => api.post<{ comprobanteEnviado: boolean }>(`/admin/cuotas/${c.id}/efectivo`));
    if (r) {
      accion.setExito(r.comprobanteEnviado ? 'Pago registrado. El comprobante se envió por WhatsApp.' : 'Pago registrado. El envío por WhatsApp falló; el comprobante queda en el historial.');
      void cuotas.recargar();
      void resumen.recargar();
    }
  };
  const verComprobante = async (pagoId: number) => {
    const c = await accion.ejecutar(() => api.get<Comprobante>(`/admin/pagos/${pagoId}/comprobante`));
    if (c) setComprobante(c);
  };
  const valor = (estado: string) => resumen.datos?.cuotas.find((c) => c.estado === estado);

  return (
    <div>
      <EncabezadoPagina titulo="Cuotas y cobros" />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-3" style={{ marginBottom: '1rem' }}>
        {['PAGADA', 'PENDIENTE', 'IMPAGA'].map((e) => (
          <Kpi key={e} titulo={`Cuotas ${etiqueta(e).toLowerCase()}`} valor={valor(e)?.cantidad ?? 0} detalle={dinero(valor(e)?.importe ?? 0)} />
        ))}
      </div>
      <div className="tarjeta">
        <div className="grilla-3">
          <Campo etiqueta="Período" type="month" value={filtros.periodo} onChange={(e) => setFiltros({ ...filtros, periodo: e.target.value })} />
          <Selector etiqueta="Estado" vacio="Todos" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} opciones={['PENDIENTE', 'PAGADA', 'IMPAGA'].map((x) => ({ valor: x, texto: etiqueta(x) }))} />
          <Campo etiqueta="Buscar socio" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
        </div>
        {cuotas.cargando && <Cargando />}
        {cuotas.datos?.length === 0 && <Vacio>No hay cuotas para los filtros.</Vacio>}
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Socio</th><th>Período</th><th>Importe</th><th>Estado</th><th>Pago</th><th /></tr></thead>
            <tbody>
              {cuotas.datos?.map((c) => {
                const aprobado = c.pagos.find((p) => p.estado === 'APROBADO');
                return (
                  <tr key={c.id}>
                    <td>{c.socio.usuario.apellido}, {c.socio.usuario.nombre}<div className="tenue" style={{ fontSize: '0.8rem' }}>{c.socio.sede.nombre}</div></td>
                    <td>{c.periodo}</td>
                    <td className="importe">{dinero(c.importeFinal)}</td>
                    <td><Estado valor={c.estado} /></td>
                    <td>{aprobado ? `${etiqueta(aprobado.medio)}${aprobado.responsable ? ` · ${aprobado.responsable.usuario.nombre}` : ''}` : '—'}</td>
                    <td>
                      {aprobado?.comprobante && <Boton variante="texto" chico onClick={() => verComprobante(aprobado.id)}>Comprobante</Boton>}
                      {gestion && c.estado !== 'PAGADA' && <Boton chico onClick={() => efectivo(c)}>Registrar efectivo</Boton>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal titulo="Comprobante" abierto={!!comprobante} onCerrar={() => setComprobante(null)}>
        {comprobante && <VistaComprobante comprobante={comprobante} alCerrar={() => setComprobante(null)} />}
      </Modal>
    </div>
  );
}
