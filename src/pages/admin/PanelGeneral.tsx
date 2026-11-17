import { Icono } from '../../components/Icono';
import { BotonEnlace, CabeceraTarjeta, Encabezado, EnlaceTexto, Kpi, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { etiqueta, fechaCorta, mesAnio } from '../../utils/formato';

interface Gimnasio {
  razonSocial: string;
  suscripcion: { tipo: string; maxSedes: number; maxSociosActivos: number } | null;
  uso: { sedesHabilitadas: number; sociosActivos: number };
}
interface Resumen {
  periodo: string;
  cuotas: { estado: string; cantidad: number; importe: number }[];
}
interface Asistencia {
  id: number;
  fechaHoraReal: string;
  forma: string;
  reserva: { turno: { sede: { nombre: string } }; socio: { usuario: { nombre: string; apellido: string } } };
}
interface Equipo {
  id: number;
  nombre: string;
  estado: string;
  sede: { nombre: string };
}
interface Tablero {
  indicadores: { sedeId: number; sede: string; asistencias: number }[];
  resumen: { conSenal: number };
}

const hora = (f: string) => new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Panel general del personal: indicadores y accesos según los permisos del rol (patrón Composite en el backend). */
export function PanelGeneral() {
  const { puede } = useAuth();
  const { sedeId } = useSedeVista();
  const filtroSede = sedeId ? { sedeId } : {};
  const gimnasio = useApi(() => api.get<Gimnasio>('/admin/gimnasio'));
  const resumen = useApi(() => (puede('COBROS') ? api.get<Resumen>('/admin/cuotas/resumen') : Promise.resolve(null)));
  const ingresos = useApi(() => (puede('RECEPCION') ? api.get<Asistencia[]>('/admin/asistencias', filtroSede) : Promise.resolve(null)), [sedeId]);
  const tablero = useApi(() => (puede('RETENCION') ? api.get<Tablero>('/admin/retencion/dashboard', filtroSede) : Promise.resolve(null)), [sedeId]);
  const equipos = useApi(() => (puede('EQUIPAMIENTO') ? api.get<Equipo[]>('/admin/equipos', filtroSede) : Promise.resolve(null)), [sedeId]);
  const g = gimnasio.datos;
  const pendientes = resumen.datos?.cuotas.filter((c) => c.estado !== 'PAGADA').reduce((t, c) => t + c.cantidad, 0);
  const maxAsistencias = Math.max(1, ...(tablero.datos?.indicadores.map((i) => i.asistencias) ?? [0]));
  const atencion = equipos.datos?.filter((e) => e.estado === 'FUERA_DE_SERVICIO' || e.estado === 'SERVICE_PROGRAMADO') ?? [];
  const intelligence = g?.suscripcion?.tipo === 'INTELLIGENCE';

  return (
    <>
      <Encabezado
        ceja={`${g?.razonSocial.toUpperCase() ?? ''} · ROSARIO`}
        titulo="Panel general"
        subtitulo="La operación de tus sedes, a la vista."
        accion={
          puede('RECEPCION') && (
            <BotonEnlace a="/admin/recepcion" icono="camera">
              Abrir recepción
            </BotonEnlace>
          )
        }
      />
      <div className="kpi-grid">
        <Kpi etiqueta="Socios activos" valor={g?.uso.sociosActivos ?? '—'} pie={g?.suscripcion ? `de ${g.suscripcion.maxSociosActivos.toLocaleString('es-AR')} de tu plan` : undefined} icono="users" />
        {ingresos.datos && <Kpi etiqueta="Ingresos de hoy" valor={ingresos.datos.length} pie="Asistencias confirmadas" icono="check" />}
        {resumen.datos && <Kpi etiqueta="Cuotas pendientes" valor={pendientes ?? 0} pie={mesAnio(resumen.datos.periodo)} icono="wallet" />}
        {tablero.datos && <Kpi etiqueta="Señales de inactividad" valor={tablero.datos.resumen.conSenal} pie="Reglas de asistencia" icono="heart" />}
        {!ingresos.datos && !resumen.datos && <Kpi etiqueta="Sedes habilitadas" valor={g?.uso.sedesHabilitadas ?? '—'} pie={g?.suscripcion ? `de ${g.suscripcion.maxSedes} de tu plan` : undefined} icono="building" />}
      </div>
      <div className="dashboard-grid">
        <div className="stack">
          {tablero.datos && (
            <section className="card">
              <CabeceraTarjeta titulo="Asistencia por sede" subtitulo={`Asistencias confirmadas en ${mesAnio(new Date().toISOString().slice(0, 7)).toLowerCase()}.`} />
              {tablero.datos.indicadores.map((i) => (
                <div key={i.sedeId} className="branch-bar">
                  <div className="spread">
                    <strong>{i.sede}</strong>
                    <span>
                      {i.asistencias} {i.asistencias === 1 ? 'asistencia' : 'asistencias'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${Math.round((i.asistencias / maxAsistencias) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <p className="page-note">Reservas sin ingreso validado no se contabilizan. Los indicadores se actualizan con el proceso nocturno.</p>
            </section>
          )}
          {ingresos.datos && (
            <section className="card">
              <CabeceraTarjeta titulo="Últimos ingresos" subtitulo="Validación y horario de llegada." accion={puede('SEDES') && <EnlaceTexto a="/admin/turnos">Ver turnos</EnlaceTexto>} />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Socio</th>
                      <th>Ingreso</th>
                      <th>Sede</th>
                      <th>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.datos.slice(0, 6).map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>
                            {a.reserva.socio.usuario.nombre} {a.reserva.socio.usuario.apellido}
                          </strong>
                        </td>
                        <td>
                          {fechaCorta(a.fechaHoraReal)} · {hora(a.fechaHoraReal)}
                        </td>
                        <td>{a.reserva.turno.sede.nombre}</td>
                        <td>{a.forma === 'QR' ? 'QR' : 'Manual'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ingresos.datos.length === 0 && <Vacio titulo="Todavía no hay ingresos hoy" descripcion="Los ingresos validados en recepción aparecen en este espacio." icono="camera" />}
            </section>
          )}
        </div>
        <div className="stack">
          {equipos.datos && (
            <section className="card">
              <CabeceraTarjeta titulo="Equipamiento que requiere atención" subtitulo="Disponibilidad registrada por el gimnasio." />
              {atencion.map((e) => (
                <div key={e.id} className="notice">
                  <Icono n="tool" />
                  <div>
                    <h4>{e.nombre}</h4>
                    <p>
                      {e.sede.nombre} · {etiqueta(e.estado)}
                    </p>
                    <EnlaceTexto a="/admin/equipamiento">Ver equipo</EnlaceTexto>
                  </div>
                </div>
              ))}
              {atencion.length === 0 && <Vacio titulo="Todo el equipamiento está operativo" icono="check" />}
            </section>
          )}
          <aside className="soft-alert green">
            <Icono n="heart" />
            <div>
              <h4>La constancia se acompaña en ambos planes</h4>
              <p>Beneficios, incentivos de regreso y notificaciones están incluidos en Standard e Intelligence.</p>
            </div>
          </aside>
          <section className="intelligence-teaser">
            <div className="eyebrow">NEUROGYM INTELLIGENCE</div>
            <h2>Más contexto para decidir.</h2>
            <p>Tendencias históricas, comparación entre sedes y estimaciones orientativas del riesgo.</p>
            {intelligence && puede('INTELLIGENCE') ? (
              <BotonEnlace a="/admin/analitica" estilo="outline" chico icono="chart">
                Explorar analítica
              </BotonEnlace>
            ) : (
              <BotonEnlace a="/admin/suscripcion" estilo="outline" chico icono="chart">
                {intelligence ? 'Ver mi suscripción' : 'Conocer Intelligence'}
              </BotonEnlace>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
