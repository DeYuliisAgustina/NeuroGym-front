import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, Estado, FilaDato, Insignia, Modal, Pestanas, Vacio, type ColorInsignia } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { EstadoEquipo } from '../../types';
import { etiqueta, fechaCorta, fechaLarga, conSede } from '../../utils/formato';

interface Equipo {
  id: number;
  nombre: string;
  categoria: string;
  estado: EstadoEquipo;
  disponible: boolean;
  mantenimientoHasta: string | null;
}
interface Incidencia {
  id: number;
  descripcion: string;
  estado: string;
  prioridad: string;
  fecha: string;
  equipo: { nombre: string };
  archivos: { id: number; url: string; tipo: 'FOTO' | 'VIDEO' }[];
}

const ESTADO_INCIDENCIA: Record<string, string> = { REPORTADA: 'Abierto', EN_GESTION: 'En revisión', RESUELTA: 'Resuelto' };
export const PRIORIDAD: Record<string, [string, ColorInsignia]> = { BAJA: ['Baja', 'neutral'], MEDIA: ['Media', 'warning'], ALTA: ['Alta', 'danger'] };
export const ticket = (id: number) => `INC-${String(id).padStart(4, '0')}`;

/** Equipamiento y reportes del socio (RF8, Figura 51): disponibilidad e incidencias con fotos o videos. */
export function Equipamiento() {
  const toast = useToast();
  const [vista, setVista] = useState<'equipos' | 'reportes'>('equipos');
  const equipos = useApi(() => api.get<Equipo[]>('/equipos/disponibilidad'));
  const reportes = useApi(() => api.get<Incidencia[]>('/socio/incidencias'));
  const perfil = useApi(() => api.get<{ sede: { nombre: string } }>('/socio/perfil'));
  const [filtros, setFiltros] = useState({ busqueda: '', estado: '', categoria: '' });
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [reportar, setReportar] = useState<{ equipoId: string } | null>(null);
  const [detalle, setDetalle] = useState<Incidencia | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const accion = useAccion();
  const sede = perfil.datos?.sede.nombre ?? '';

  const abrirReporte = (equipoId = '') => {
    accion.limpiar();
    setDescripcion('');
    setArchivos([]);
    setEquipo(null);
    setReportar({ equipoId: equipoId || String(equipos.datos?.[0]?.id ?? '') });
  };
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportar?.equipoId) return accion.setError('Elegí el equipo.');
    if (descripcion.trim().length < 10) return accion.setError('Contanos la falla con al menos 10 caracteres.');
    const datos = new FormData();
    datos.append('equipoId', reportar.equipoId);
    datos.append('descripcion', descripcion.trim());
    archivos.forEach((a) => datos.append('archivos', a));
    if (await accion.ejecutar(() => api.post('/socio/incidencias', datos))) {
      setReportar(null);
      toast('Gracias. Tu reporte fue enviado al gimnasio.');
      setVista('reportes');
      void reportes.recargar();
    }
  };

  const q = filtros.busqueda.trim().toLowerCase();
  const listaEquipos = (equipos.datos ?? []).filter(
    (m) => (!q || m.nombre.toLowerCase().includes(q)) && (!filtros.estado || m.estado === filtros.estado) && (!filtros.categoria || m.categoria === filtros.categoria),
  );
  const listaReportes = (reportes.datos ?? []).filter(
    (t) => (!q || t.equipo.nombre.toLowerCase().includes(q) || t.descripcion.toLowerCase().includes(q) || ticket(t.id).toLowerCase().includes(q)) && (!filtros.estado || t.estado === filtros.estado),
  );
  const categorias = [...new Set(equipos.datos?.map((m) => m.categoria))];
  const hayFiltros = !!(filtros.busqueda || filtros.estado || filtros.categoria);

  return (
    <>
      <Encabezado
        ceja="MI SEDE"
        titulo="Equipamiento y reportes"
        subtitulo="Reportá una falla y consultá la disponibilidad del equipamiento."
        accion={
          <Boton icono="plus" onClick={() => abrirReporte()}>
            Reportar incidencia
          </Boton>
        }
      />
      <Pestanas
        valor={vista}
        onCambiar={(v) => {
          setVista(v);
          setFiltros({ busqueda: '', estado: '', categoria: '' });
        }}
        opciones={[
          { valor: 'equipos', texto: 'Equipamiento de mi sede' },
          { valor: 'reportes', texto: `Mis reportes (${reportes.datos?.length ?? 0})` },
        ]}
      />
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input
              type="search"
              aria-label={vista === 'equipos' ? 'Buscar equipo' : 'Buscar reporte o equipo'}
              placeholder={vista === 'equipos' ? 'Buscar equipo' : 'Buscar reporte o equipo'}
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            />
          </div>
        </label>
        <label className="filter-field">
          <span>{vista === 'equipos' ? 'Disponibilidad' : 'Estado'}</span>
          <select aria-label={vista === 'equipos' ? 'Disponibilidad' : 'Estado'} value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            {vista === 'equipos'
              ? ['OPERATIVO', 'FUERA_DE_SERVICIO', 'SERVICE_PROGRAMADO'].map((s) => (
                  <option key={s} value={s}>
                    {etiqueta(s)}
                  </option>
                ))
              : Object.entries(ESTADO_INCIDENCIA).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
          </select>
        </label>
        {vista === 'equipos' && (
          <label className="filter-field">
            <span>Categoría</span>
            <select aria-label="Categoría" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>
              <option value="">Todos</option>
              {categorias.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={() => setFiltros({ busqueda: '', estado: '', categoria: '' })}>
          Limpiar filtros
        </Boton>
      </div>

      {vista === 'reportes' ? (
        <section className="card">
          <CabeceraTarjeta titulo="Mis reportes" subtitulo="Seguimiento de cada falla reportada." />
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
                {listaReportes.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{ticket(t.id)}</strong>
                      <small>{sede}</small>
                    </td>
                    <td>
                      <strong>{t.equipo.nombre}</strong>
                      <small>{t.descripcion.length > 43 ? `${t.descripcion.slice(0, 43)}…` : t.descripcion}</small>
                    </td>
                    <td>{fechaCorta(t.fecha)}</td>
                    <td>
                      <Insignia color={PRIORIDAD[t.prioridad]?.[1] ?? 'neutral'}>{PRIORIDAD[t.prioridad]?.[0] ?? t.prioridad}</Insignia>
                    </td>
                    <td>
                      <Estado valor={t.estado} texto={ESTADO_INCIDENCIA[t.estado]} />
                    </td>
                    <td>
                      <Boton estilo="outline" chico icono="chevron" onClick={() => setDetalle(t)}>
                        Ver detalle
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reportes.datos && listaReportes.length === 0 && (
            <Vacio
              titulo={hayFiltros ? 'Sin resultados' : 'Sin reportes por el momento'}
              descripcion={hayFiltros ? 'Probá con otra búsqueda o limpiá los filtros.' : 'Si detectás una falla, podés registrarla con una foto o un video.'}
              icono="tool"
              accion={
                <Boton estilo="soft" chico icono="plus" onClick={() => abrirReporte()}>
                  Crear un reporte
                </Boton>
              }
            />
          )}
        </section>
      ) : (
        <>
          <div className="equipment-grid">
            {listaEquipos.map((m) => (
              <article key={m.id} className="machine-card">
                <div className="machine-visual">
                  <Icono n={/cardio/i.test(m.categoria) ? 'activity' : 'dumbbell'} />
                </div>
                <Estado valor={m.estado} />
                <h3>{m.nombre}</h3>
                <p>
                  {m.categoria} · {conSede(sede)}
                </p>
                <div className="spread">
                  <span>{m.mantenimientoHasta ? 'Disponible desde' : 'Estado'}</span>
                  <strong>{m.mantenimientoHasta ? fechaCorta(m.mantenimientoHasta) : m.disponible ? 'En uso' : 'En revisión'}</strong>
                </div>
                <Boton estilo="outline" chico icono="arrow" onClick={() => setEquipo(m)}>
                  Ver disponibilidad
                </Boton>
              </article>
            ))}
          </div>
          {equipos.datos && listaEquipos.length === 0 && <Vacio titulo="Sin equipos para estos filtros" descripcion="Probá con otra búsqueda o limpiá los filtros." icono="search" />}
        </>
      )}
      <aside className="soft-alert green section-gap">
        <Icono n="sparkles" />
        <div>
          <h4>Una alternativa para seguir</h4>
          <p>Si una máquina está fuera de servicio, NeuroGym puede sugerir una variante. Tu rutina y tu reserva se mantienen hasta que vos elijas un cambio.</p>
          <Link to="/socio/rutina">Consultar mi rutina</Link>
        </div>
      </aside>

      <Modal
        titulo={equipo?.nombre ?? ''}
        subtitulo={equipo ? `${equipo.categoria} · ${conSede(sede)}` : ''}
        abierto={!!equipo}
        onCerrar={() => setEquipo(null)}
        pie={
          <Boton estilo="outline" icono="tool" onClick={() => abrirReporte(String(equipo?.id))}>
            Reportar una falla
          </Boton>
        }
      >
        {equipo && (
          <>
            <div className="spread">
              <Estado valor={equipo.estado} />
            </div>
            <FilaDato etiqueta="Disponibilidad">{equipo.disponible ? 'Disponible para tu rutina' : 'No disponible por ahora'}</FilaDato>
            <FilaDato etiqueta="Mantenimiento programado">{equipo.mantenimientoHasta ? `Hasta el ${fechaLarga(equipo.mantenimientoHasta)}` : 'Sin mantenimientos próximos'}</FilaDato>
            <p className="page-note">Si el equipo no está disponible, tu rutina te sugiere una variante y tu reserva se mantiene.</p>
          </>
        )}
      </Modal>

      <Modal titulo="Contanos qué pasó." subtitulo="Tu reporte ayuda a cuidar el equipamiento del gimnasio." abierto={!!reportar} onCerrar={() => setReportar(null)}>
        <form onSubmit={enviar}>
          <ErrorFormulario>{accion.error}</ErrorFormulario>
          <div className="form-grid">
            <label className="wide">
              Máquina o elemento
              <select required value={reportar?.equipoId ?? ''} onChange={(e) => setReportar({ equipoId: e.target.value })}>
                {equipos.datos?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} · {sede}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Descripción de la falla
              <textarea placeholder="¿Qué observaste en el equipo?" minLength={10} maxLength={800} required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </label>
            <div className="wide">
              <div className="upload-box">
                <Icono n="camera" />
                <p>Una foto o un video puede ayudar</p>
                <small>Opcional · Hasta 5 archivos (JPG, PNG, WEBP, MP4, WEBM o MOV)</small>
                <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple aria-label="Adjuntar foto o video" onChange={(e) => setArchivos(Array.from(e.target.files ?? []).slice(0, 5))} />
                {archivos.length > 0 && (
                  <div className="attachment-preview">
                    {archivos.map((a) => (
                      <span key={a.name}>{a.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="form-actions">
            <Boton estilo="outline" onClick={() => setReportar(null)}>
              Cancelar
            </Boton>
            <button className="btn primary" type="submit" disabled={accion.enviando}>
              <Icono n="upload" />
              {accion.enviando ? 'Enviando…' : 'Registrar reporte'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal titulo={detalle ? `Reporte ${ticket(detalle.id)}` : ''} subtitulo={detalle ? `${detalle.equipo.nombre} · ${fechaLarga(detalle.fecha)}` : ''} abierto={!!detalle} onCerrar={() => setDetalle(null)} pie={<Boton onClick={() => setDetalle(null)}>Cerrar</Boton>}>
        {detalle && (
          <>
            <div className="spread">
              <Estado valor={detalle.estado} texto={ESTADO_INCIDENCIA[detalle.estado]} />
            </div>
            <div className="ticket-detail">
              <h3>Descripción</h3>
              <p>{detalle.descripcion}</p>
            </div>
            {detalle.archivos.length > 0 && (
              <div className="attachment-preview">
                {detalle.archivos.map((a) =>
                  a.tipo === 'FOTO' ? <img key={a.id} src={a.url} alt="Adjunto del reporte" /> : <video key={a.id} src={a.url} controls />,
                )}
              </div>
            )}
            <p className="page-note">El gimnasio define la prioridad y te avisa cuando cambia el estado del reporte.</p>
          </>
        )}
      </Modal>
    </>
  );
}
