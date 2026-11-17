import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, FilaDato, Insignia, Modal, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { fechaCorta, fechaLarga } from '../../utils/formato';
import { PRIORIDAD, ticket } from '../socio/Equipamiento';

interface Incidencia {
  id: number;
  descripcion: string;
  estado: 'REPORTADA' | 'EN_GESTION' | 'RESUELTA';
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
  fecha: string;
  equipoId: number;
  agrupadaEnId: number | null;
  equipo: { nombre: string; estado: string; sede: { nombre: string } };
  reportante: { usuario: { nombre: string; apellido: string } };
  archivos: { id: number; url: string; tipo: string }[];
}

const ESTADO: Record<Incidencia['estado'], [string, '' | 'warning' | 'neutral']> = { REPORTADA: ['Abierto', 'warning'], EN_GESTION: ['En reparación', 'warning'], RESUELTA: ['Resuelto', 'neutral'] };

/** Ticketera de incidencias (RF21, Figura 61): prioridad, estado, agrupación y detalle con adjuntos. */
export function Incidencias() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('EQUIPAMIENTO', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [filtros, setFiltros] = useState({ busqueda: '', estado: '', prioridad: '' });
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const incidencias = useApi(() => api.get<Incidencia[]>('/admin/incidencias', sedeId ? { sedeId } : {}), [sedeId]);
  const [detalle, setDetalle] = useState<Incidencia | null>(null);
  const accion = useAccion();

  const q = filtros.busqueda.trim().toLowerCase();
  const lista = (incidencias.datos ?? []).filter(
    (i) =>
      (!q || ticket(i.id).toLowerCase().includes(q) || i.equipo.nombre.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q)) &&
      (!filtros.estado || i.estado === filtros.estado) &&
      (!filtros.prioridad || i.prioridad === filtros.prioridad),
  );
  // Reportes abiertos que coinciden en un mismo equipo (posible duplicado a revisar).
  const porEquipo = new Map<number, Incidencia[]>();
  (incidencias.datos ?? []).filter((i) => i.estado !== 'RESUELTA').forEach((i) => porEquipo.set(i.equipoId, [...(porEquipo.get(i.equipoId) ?? []), i]));

  const agrupar = async (grupo: Incidencia[]) => {
    const [principal, ...resto] = [...grupo].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ok = await accion.ejecutar(() => Promise.all(resto.filter((i) => i.agrupadaEnId !== principal.id).map((i) => api.patch(`/admin/incidencias/${i.id}/agrupacion`, { principalId: principal.id }))));
    if (ok) {
      toast(`Reportes agrupados en ${ticket(principal.id)}.`);
      void incidencias.recargar();
    }
  };

  return (
    <>
      <Encabezado ceja="GESTIÓN OPERATIVA" titulo="Incidencias" subtitulo="Revisá reportes, prioridades y el estado de cada intervención." />
      <ErrorFormulario>{!detalle ? accion.error : null}</ErrorFormulario>
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar reporte o equipo" placeholder="Buscar reporte o equipo" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
          </div>
        </label>
        <label className="filter-field">
          <span>Sede</span>
          <select aria-label="Filtrar por sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Todas las sedes</option>
            {sedes.datos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select aria-label="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ESTADO).map(([v, [t]]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Prioridad</span>
          <select aria-label="Prioridad" value={filtros.prioridad} onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })}>
            <option value="">Todos</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </label>
        <Boton
          estilo="outline"
          chico
          icono="refresh"
          className="clear-filters"
          onClick={() => {
            setFiltros({ busqueda: '', estado: '', prioridad: '' });
            setSedeId('');
          }}
        >
          Limpiar filtros
        </Boton>
      </div>
      <section className="card">
        <CabeceraTarjeta titulo="Ticketera de incidencias" subtitulo="Seguimiento de cada falla reportada." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Equipamiento</th>
                <th>Fecha</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{ticket(i.id)}</strong>
                    <small>{i.equipo.sede.nombre}</small>
                  </td>
                  <td>
                    <strong>{i.equipo.nombre}</strong>
                    <small>{i.descripcion.length > 43 ? `${i.descripcion.slice(0, 43)}…` : i.descripcion}</small>
                  </td>
                  <td>{fechaCorta(i.fecha)}</td>
                  <td>
                    <Insignia color={PRIORIDAD[i.prioridad][1]}>{PRIORIDAD[i.prioridad][0]}</Insignia>
                  </td>
                  <td>
                    <Insignia color={ESTADO[i.estado][1]}>{ESTADO[i.estado][0]}</Insignia>
                  </td>
                  <td>
                    <Boton
                      estilo="outline"
                      chico
                      icono="chevron"
                      onClick={() => {
                        accion.limpiar();
                        setDetalle(i);
                      }}
                    >
                      Ver detalle
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incidencias.datos && lista.length === 0 && <Vacio titulo="Sin reportes por el momento" descripcion="Los reportes de los socios aparecen en este espacio." icono="tool" />}
      </section>
      <aside className="soft-alert green section-gap">
        <Icono n="sparkles" />
        <div>
          <h4>Una alternativa para seguir</h4>
          <p>Si una máquina está fuera de servicio, NeuroGym sugiere una variante al socio. Su rutina y su reserva se mantienen hasta que elija un cambio.</p>
          <Link to="/admin/equipamiento">Revisar disponibilidad</Link>
        </div>
      </aside>
      <section className="card section-gap">
        <CabeceraTarjeta titulo="Reportes que coinciden en un equipo" subtitulo="La relación se basa en el equipo registrado y requiere revisión." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Reportes</th>
                <th>Grupo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {[...porEquipo.values()].map((g) => {
                const agrupados = g.length > 1 && g.filter((i) => i.agrupadaEnId).length === g.length - 1;
                return (
                  <tr key={g[0].equipoId}>
                    <td>
                      <strong>{g[0].equipo.nombre}</strong>
                      <small>{g[0].equipo.sede.nombre}</small>
                    </td>
                    <td>
                      {g.length} · {g.map((i) => ticket(i.id)).join(', ')}
                    </td>
                    <td>{g.length === 1 ? 'Sin agrupar' : agrupados ? 'Agrupados' : 'Posible duplicado'}</td>
                    <td>
                      {g.length === 1 ? (
                        <Insignia color="neutral">Reporte individual</Insignia>
                      ) : agrupados ? (
                        <Insignia>Agrupados</Insignia>
                      ) : (
                        gestion && (
                          <Boton estilo="outline" chico icono="clipboard" cargando={accion.enviando} onClick={() => agrupar(g)}>
                            Agrupar reportes
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
        <p className="page-note">La IA no detecta fallas por sí sola. Los reportes y la disponibilidad son información registrada; el gimnasio decide las intervenciones.</p>
      </section>
      {detalle && (
        <DetalleIncidencia
          incidencia={detalle}
          gestion={gestion}
          alCerrar={() => setDetalle(null)}
          alGuardar={() => {
            setDetalle(null);
            toast('Estado de la incidencia actualizado.');
            void incidencias.recargar();
          }}
        />
      )}
    </>
  );
}

/** Detalle de un reporte (Figura 61 b). */
function DetalleIncidencia({ incidencia: i, gestion, alCerrar, alGuardar }: { incidencia: Incidencia; gestion: boolean; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({ estado: i.estado, prioridad: i.prioridad, fueraDeServicio: false });
  const accion = useAccion();
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await accion.ejecutar(async () => {
      await api.patch(`/admin/incidencias/${i.id}`, { estado: f.estado, prioridad: f.prioridad });
      if (f.fueraDeServicio) await api.patch(`/admin/equipos/${i.equipoId}/disponibilidad`, { estado: 'FUERA_DE_SERVICIO' });
      return true;
    });
    if (ok) alGuardar();
  };
  return (
    <Modal titulo={`Reporte ${ticket(i.id)}`} subtitulo={`${i.equipo.nombre} · Sede ${i.equipo.sede.nombre}`} abierto onCerrar={alCerrar}>
      <form onSubmit={guardar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="spread">
          <Insignia color={ESTADO[i.estado][1]}>{ESTADO[i.estado][0]}</Insignia>
          <Insignia color={PRIORIDAD[i.prioridad][1]}>{PRIORIDAD[i.prioridad][0]}</Insignia>
        </div>
        <div className="ticket-detail">
          <p>{i.descripcion}</p>
        </div>
        {i.archivos.length > 0 && (
          <div className="attachment-preview">
            {i.archivos.map((a) => (a.tipo === 'FOTO' ? <img key={a.id} src={a.url} alt="Adjunto del reporte" /> : <video key={a.id} src={a.url} controls />))}
          </div>
        )}
        <FilaDato etiqueta="Reportado por">
          {i.reportante.usuario.nombre} {i.reportante.usuario.apellido}
        </FilaDato>
        <FilaDato etiqueta="Fecha">{fechaLarga(i.fecha)}</FilaDato>
        {i.agrupadaEnId && <FilaDato etiqueta="Agrupado en">{ticket(i.agrupadaEnId)}</FilaDato>}
        <div className="soft-alert green" style={{ marginTop: 18 }}>
          <Icono n="sparkles" />
          <div>
            <h4>Revisión sugerida</h4>
            <p>Evaluar el mecanismo y programar una intervención técnica si corresponde. Requiere revisión del administrador.</p>
          </div>
        </div>
        <div className="divider" />
        {gestion ? (
          <>
            <div className="form-grid">
              <label>
                Estado de la incidencia
                <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as Incidencia['estado'] })}>
                  {Object.entries(ESTADO).map(([v, [t]]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridad
                <select value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value as Incidencia['prioridad'] })}>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </label>
            </div>
            {i.equipo.estado !== 'FUERA_DE_SERVICIO' && (
              <label className="check-field">
                <input type="checkbox" checked={f.fueraDeServicio} onChange={(e) => setF({ ...f, fueraDeServicio: e.target.checked })} />
                Marcar el equipo como fuera de servicio desde ahora
              </label>
            )}
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={accion.enviando}>
                Guardar estado
              </button>
            </div>
          </>
        ) : (
          <p className="page-note">Tu rol permite consultar las incidencias. La gestión requiere permiso sobre Equipamiento.</p>
        )}
      </form>
    </Modal>
  );
}
