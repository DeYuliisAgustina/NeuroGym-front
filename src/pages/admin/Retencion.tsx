import { useState, type FormEvent } from 'react';
import { Icono } from '../../components/Icono';
import { Avatar, Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, FilaDato, Insignia, inicialesDe, Modal, Pestanas, Vacio, type ColorInsignia } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { fechaCorta, fechaLarga } from '../../utils/formato';

interface SocioFila {
  socioId: number;
  nombre: string;
  email: string;
  sede: string;
  plan: string;
  saldoPuntos: number;
  estadoCuota: string | null;
  asistenciasPeriodo: number;
  ultimaVisita: string | null;
  senal: { id: number; tipo: string; nivel: string; detalle: string | null } | null;
}
interface Dashboard {
  ultimaEjecucionEtl: string | null;
  socios: SocioFila[];
  resumen: { sociosActivos: number; conSenal: number; sinAsistenciaEnPeriodo: number };
}
interface Propuesta {
  id: number;
  incentivo: string;
  mensaje: string;
  estado: string;
  premiumDias: number | null;
  premiumPorcentaje: string | null;
  fechaCreacion: string;
  socio: { usuario: { nombre: string; apellido: string } };
  responsable: { usuario: { nombre: string; apellido: string } };
}
interface Beneficio {
  id: number;
  nombre: string;
  descripcion: string;
  costoPuntos: number;
  vigenciaDias: number;
  disponible: boolean;
  _count: { canjes: number };
}

const NIVEL: Record<string, [string, ColorInsignia]> = { ALTO: ['Alto', 'danger'], MEDIO: ['Medio', 'warning'], BAJO: ['Bajo', 'neutral'] };
const INCENTIVOS = ['7 días de Premium bonificado', 'Clase de prueba para un invitado', 'Evaluación con entrenador', 'Puntos extra de constancia'];
/** "Apellido, Nombre" → "Nombre Apellido". */
const nombreDe = (s: SocioFila) => s.nombre.split(', ').reverse().join(' ');
const mensajeSugerido = (nombre: string) =>
  `Hola ${nombre}, tu próximo entrenamiento te espera. Queremos acompañarte a retomar tu ritmo con un beneficio especial. Elegí un horario y volvé a dar el primer paso.`;

/** Constancia y regreso (CU-002, Figuras 35 y 36): señales, incentivos con aprobación y beneficios por constancia. */
export function Retencion() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('RETENCION', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [vista, setVista] = useState<'senales' | 'todos'>('senales');
  const [filtros, setFiltros] = useState({ plan: '', estadoCuota: '', nivel: '', busqueda: '' });
  const consulta = Object.fromEntries(Object.entries({ ...filtros, sedeId }).filter(([, v]) => v));
  const tablero = useApi(() => api.get<Dashboard>('/admin/retencion/dashboard', consulta), [filtros.plan, filtros.estadoCuota, filtros.nivel, filtros.busqueda, sedeId]);
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const propuestas = useApi(() => api.get<Propuesta[]>('/admin/retencion/propuestas'));
  const beneficios = useApi(() => api.get<Beneficio[]>('/admin/beneficios'));
  const [propuesta, setPropuesta] = useState<{ socio: SocioFila; incentivo: string; mensaje: string } | null>(null);
  const [beneficio, setBeneficio] = useState<Partial<Beneficio> | null>(null);
  const [aprobar, setAprobar] = useState<Propuesta | null>(null);
  const accion = useAccion();

  const listado = (vista === 'senales' ? tablero.datos?.socios.filter((s) => s.senal) : tablero.datos?.socios) ?? [];
  const pendientes = (propuestas.datos ?? []).filter((p) => p.estado === 'PREPARADA' || p.estado === 'PENDIENTE');
  const limpiar = () => {
    setFiltros({ plan: '', estadoCuota: '', nivel: '', busqueda: '' });
    setSedeId('');
  };

  const guardarPropuesta = async (e: FormEvent) => {
    e.preventDefault();
    const p = propuesta!;
    if (!p.mensaje.trim()) return accion.setError('El mensaje es obligatorio.');
    const premium = p.incentivo === INCENTIVOS[0];
    const ok = await accion.ejecutar(() =>
      api.post('/admin/retencion/propuestas', {
        socioId: p.socio.socioId,
        senalId: p.socio.senal?.id,
        incentivo: p.incentivo,
        mensaje: p.mensaje,
        ...(premium ? { premiumDias: 7, premiumPorcentaje: 100 } : {}),
      }),
    );
    if (ok) {
      setPropuesta(null);
      toast('Propuesta guardada para revisión. Todavía no se comunicó al socio.');
      void propuestas.recargar();
    }
  };
  const confirmarAprobacion = async () => {
    if (!aprobar) return;
    if (await accion.ejecutar(() => api.patch(`/admin/retencion/propuestas/${aprobar.id}/aprobacion`))) {
      setAprobar(null);
      toast('Incentivo aprobado y comunicado al socio.');
      void propuestas.recargar();
    }
  };
  const posponer = async (p: Propuesta) => {
    if (await accion.ejecutar(() => api.patch(`/admin/retencion/propuestas/${p.id}/pendiente`))) {
      toast('La propuesta quedó pendiente.');
      void propuestas.recargar();
    }
  };
  const guardarBeneficio = async (e: FormEvent) => {
    e.preventDefault();
    const b = beneficio!;
    if (!b.nombre?.trim() || !b.descripcion?.trim() || !b.costoPuntos || !b.vigenciaDias) return accion.setError('Completá todos los campos.');
    const datos = { nombre: b.nombre, descripcion: b.descripcion, costoPuntos: Number(b.costoPuntos), vigenciaDias: Number(b.vigenciaDias), disponible: b.disponible ?? true };
    if (await accion.ejecutar(() => (b.id ? api.put(`/admin/beneficios/${b.id}`, datos) : api.post('/admin/beneficios', datos)))) {
      setBeneficio(null);
      toast('Beneficio guardado.');
      void beneficios.recargar();
    }
  };
  const ejecutarEtl = async () => {
    if (await accion.ejecutar(() => api.post('/admin/retencion/etl'))) {
      toast('Indicadores, señales y avisos actualizados.');
      void tablero.recargar();
    }
  };

  return (
    <>
      <Encabezado ceja="CONSTANCIA Y REACTIVACIÓN" titulo="Constancia y regreso" subtitulo="Reconocé la continuidad y creá oportunidades para volver, en ambos planes." />
      <div className="toolbar">
        <Pestanas
          valor={vista}
          onCambiar={setVista}
          opciones={[
            { valor: 'senales', texto: 'Señales de inactividad' },
            { valor: 'todos', texto: 'Constancia y beneficios' },
          ]}
        />
      </div>
      <ErrorFormulario>{!propuesta && !beneficio && !aprobar ? accion.error : null}</ErrorFormulario>
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar socio o correo" placeholder="Buscar socio o correo" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
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
          <span>Plan</span>
          <select aria-label="Plan" value={filtros.plan} onChange={(e) => setFiltros({ ...filtros, plan: e.target.value })}>
            <option value="">Todos</option>
            <option value="BASICO">Básico</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Estado de cuota</span>
          <select aria-label="Estado de cuota" value={filtros.estadoCuota} onChange={(e) => setFiltros({ ...filtros, estadoCuota: e.target.value })}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="IMPAGA">Impaga</option>
            <option value="PAGADA">Al día</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Señal de inactividad</span>
          <select aria-label="Señal de inactividad" value={filtros.nivel} onChange={(e) => setFiltros({ ...filtros, nivel: e.target.value })}>
            <option value="">Todos</option>
            <option value="BAJO">Bajo</option>
            <option value="MEDIO">Medio</option>
            <option value="ALTO">Alto</option>
          </select>
        </label>
        <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={limpiar}>
          Limpiar filtros
        </Boton>
      </div>
      <aside className="soft-alert green" style={{ marginBottom: 23 }}>
        <Icono n="heart" />
        <div>
          <h4>La información acompaña decisiones</h4>
          <p>Las señales de posible abandono orientan la revisión del administrador. La plataforma no determina que un socio vaya a abandonar.</p>
        </div>
      </aside>
      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Sede</th>
                <th>Plan</th>
                <th>Asistencias</th>
                <th>Última visita</th>
                <th>{vista === 'senales' ? 'Señal' : 'Puntos'}</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {listado.map((s) => (
                <tr key={s.socioId}>
                  <td>
                    <div className="table-avatar">
                      <Avatar iniciales={inicialesDe(nombreDe(s))} color={s.senal?.nivel === 'ALTO' ? 'peach' : 'mint'} />
                      <div>
                        <strong>{nombreDe(s)}</strong>
                        <small>{s.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{s.sede}</td>
                  <td>
                    <Insignia color={s.plan === 'PREMIUM' ? 'lilac' : 'neutral'}>{s.plan === 'PREMIUM' ? 'Premium' : 'Básico'}</Insignia>
                  </td>
                  <td>{s.asistenciasPeriodo} este mes</td>
                  <td>{s.ultimaVisita ? fechaCorta(s.ultimaVisita) : 'Sin visitas'}</td>
                  <td>{vista === 'senales' && s.senal ? <Insignia color={NIVEL[s.senal.nivel][1]}>{NIVEL[s.senal.nivel][0]}</Insignia> : `${s.saldoPuntos} pts`}</td>
                  <td>
                    {gestion && (
                      <Boton
                        estilo="outline"
                        chico
                        icono="chevron"
                        onClick={() => {
                          accion.limpiar();
                          setPropuesta({ socio: s, incentivo: INCENTIVOS[0], mensaje: mensajeSugerido(nombreDe(s).split(' ')[0]) });
                        }}
                      >
                        {s.senal ? 'Crear incentivo' : 'Reconocer constancia'}
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tablero.datos && listado.length === 0 && <Vacio titulo="No encontramos socios" descripcion="Probá con otra búsqueda o sede." icono="users" />}
      </section>

      <section className="card section-gap">
        <CabeceraTarjeta titulo="Propuestas de incentivo" subtitulo="Se comunican al socio recién cuando un responsable las aprueba." />
        {pendientes.map((p) => (
          <div key={p.id} className="notice">
            <Icono n="gift" />
            <div>
              <h4>
                {p.incentivo} · {p.socio.usuario.nombre} {p.socio.usuario.apellido}
              </h4>
              <p>
                Preparada por {p.responsable.usuario.nombre} {p.responsable.usuario.apellido} el {fechaLarga(p.fechaCreacion, false)} · {p.estado === 'PENDIENTE' ? 'Pendiente' : 'Para revisar'}
              </p>
              {gestion && (
                <div className="table-actions">
                  <Boton chico icono="check" onClick={() => setAprobar(p)}>
                    Aprobar y comunicar
                  </Boton>
                  {p.estado !== 'PENDIENTE' && (
                    <Boton estilo="outline" chico onClick={() => posponer(p)}>
                      Dejar pendiente
                    </Boton>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {propuestas.datos && pendientes.length === 0 && <p className="page-note">No hay propuestas esperando aprobación.</p>}
      </section>

      {vista === 'todos' && (
        <section className="card section-gap">
          <CabeceraTarjeta
            titulo="Beneficios por constancia"
            subtitulo="Los socios canjean sus puntos por estos beneficios."
            accion={
              gestion && (
                <Boton
                  chico
                  icono="plus"
                  onClick={() => {
                    accion.limpiar();
                    setBeneficio({ nombre: '', descripcion: '', costoPuntos: 150, vigenciaDias: 30, disponible: true });
                  }}
                >
                  Nuevo beneficio
                </Boton>
              )
            }
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Beneficio</th>
                  <th>Puntos</th>
                  <th>Vigencia</th>
                  <th>Canjes</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {beneficios.datos?.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.nombre}</strong>
                      <small>{b.descripcion}</small>
                    </td>
                    <td>{b.costoPuntos}</td>
                    <td>{b.vigenciaDias} días</td>
                    <td>{b._count.canjes}</td>
                    <td>
                      <Insignia color={b.disponible ? '' : 'neutral'}>{b.disponible ? 'Disponible' : 'Pausado'}</Insignia>
                    </td>
                    <td>
                      {gestion && (
                        <Boton
                          estilo="outline"
                          chico
                          icono="edit"
                          onClick={() => {
                            accion.limpiar();
                            setBeneficio(b);
                          }}
                        >
                          Editar
                        </Boton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card section-gap">
        <CabeceraTarjeta titulo="Notificaciones automáticas" subtitulo="Disponibles en Standard e Intelligence, independientemente de las recomendaciones avanzadas." />
        <p>
          Avisos de vencimiento, turnos e inactividad. El administrador revisa y define los incentivos de regreso.
          {tablero.datos?.ultimaEjecucionEtl && ` Última actualización: ${fechaLarga(tablero.datos.ultimaEjecucionEtl)}.`}
        </p>
        {gestion && (
          <Boton estilo="outline" chico icono="bell" cargando={accion.enviando && !propuesta && !beneficio && !aprobar} onClick={ejecutarEtl}>
            Actualizar señales y avisos
          </Boton>
        )}
      </section>

      {/* Figura 36: preparación de un incentivo de regreso (CU-002-004). */}
      <Modal titulo={`Incentivo para ${propuesta ? nombreDe(propuesta.socio).split(' ')[0] : ''}`} subtitulo="Prepará un incentivo para acompañar su regreso." abierto={!!propuesta} onCerrar={() => setPropuesta(null)}>
        {propuesta && (
          <form onSubmit={guardarPropuesta}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            {propuesta.socio.senal && (
              <div className="soft-alert">
                <Icono n="heart" />
                <div>
                  <h4>{propuesta.socio.senal.detalle ?? 'Frecuencia en descenso'}</h4>
                  <p>
                    {propuesta.socio.asistenciasPeriodo} asistencias este mes · Última visita {propuesta.socio.ultimaVisita ? fechaCorta(propuesta.socio.ultimaVisita) : 'sin registro'}. La señal orienta la revisión,
                    no anticipa un resultado seguro.
                  </p>
                </div>
              </div>
            )}
            <label>
              Incentivo
              <select value={propuesta.incentivo} onChange={(e) => setPropuesta({ ...propuesta, incentivo: e.target.value })}>
                {INCENTIVOS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <label>
              Mensaje propuesto
              <textarea required maxLength={2000} value={propuesta.mensaje} onChange={(e) => setPropuesta({ ...propuesta, mensaje: e.target.value })} />
            </label>
            <p className="page-note">Disponible para socios Básico y Premium. La propuesta queda para revisar; se comunica al socio cuando se aprueba.</p>
            <div className="form-actions">
              <Boton estilo="outline" onClick={() => setPropuesta(null)}>
                Cancelar
              </Boton>
              <button type="submit" className="btn primary" disabled={accion.enviando}>
                <Icono n="check" />
                Guardar propuesta
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        titulo="Aprobar incentivo"
        subtitulo={aprobar ? `${aprobar.socio.usuario.nombre} ${aprobar.socio.usuario.apellido} · ${aprobar.incentivo}` : ''}
        abierto={!!aprobar}
        onCerrar={() => setAprobar(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setAprobar(null)}>
              Volver
            </Boton>
            <Boton icono="check" cargando={accion.enviando} onClick={confirmarAprobacion}>
              Aprobar y comunicar
            </Boton>
          </>
        }
      >
        {aprobar && (
          <>
            <div className="ticket-detail">
              <h3>Mensaje</h3>
              <p>{aprobar.mensaje}</p>
            </div>
            {aprobar.premiumDias && <FilaDato etiqueta="Premium bonificado">{aprobar.premiumDias} días</FilaDato>}
            <p className="page-note">Al aprobarlo se aplica el incentivo y se notifica al socio por la plataforma y por WhatsApp.</p>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
          </>
        )}
      </Modal>

      <Modal titulo={beneficio?.id ? 'Editar beneficio' : 'Nuevo beneficio'} subtitulo="Se canjea con los puntos de constancia." abierto={!!beneficio} onCerrar={() => setBeneficio(null)}>
        {beneficio && (
          <form onSubmit={guardarBeneficio}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            <div className="form-grid">
              <label className="wide">
                Nombre
                <input required maxLength={100} value={beneficio.nombre ?? ''} onChange={(e) => setBeneficio({ ...beneficio, nombre: e.target.value })} />
              </label>
              <label className="wide">
                Descripción
                <textarea required maxLength={255} value={beneficio.descripcion ?? ''} onChange={(e) => setBeneficio({ ...beneficio, descripcion: e.target.value })} />
              </label>
              <label>
                Costo en puntos
                <input type="number" min={1} required value={beneficio.costoPuntos ?? ''} onChange={(e) => setBeneficio({ ...beneficio, costoPuntos: Number(e.target.value) })} />
              </label>
              <label>
                Vigencia del cupón (días)
                <input type="number" min={1} max={365} required value={beneficio.vigenciaDias ?? ''} onChange={(e) => setBeneficio({ ...beneficio, vigenciaDias: Number(e.target.value) })} />
              </label>
              <label className="check-field wide">
                <input type="checkbox" checked={beneficio.disponible ?? true} onChange={(e) => setBeneficio({ ...beneficio, disponible: e.target.checked })} />
                Disponible para canjear
              </label>
            </div>
            <div className="form-actions">
              <Boton estilo="outline" onClick={() => setBeneficio(null)}>
                Cancelar
              </Boton>
              <button type="submit" className="btn primary" disabled={accion.enviando}>
                Guardar beneficio
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
