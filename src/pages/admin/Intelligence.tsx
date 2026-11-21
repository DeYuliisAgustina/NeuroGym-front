import { useEffect, useState, type FormEvent } from 'react';
import { GraficoLinea, Tendencia } from '../../components/GraficoLinea';
import { Icono } from '../../components/Icono';
import { Boton, BotonEnlace, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, Insignia, Kpi, Modal, Vacio, type ColorInsignia } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { fechaLarga, hoyIso, mesAnio, sumarDiasIso } from '../../utils/formato';

interface Estimacion {
  estimacionId: number;
  socioId: number;
  socio: string;
  sede: string;
  nivel: 'ALTO' | 'MEDIO' | 'BAJO';
  fundamento: string;
  recomendacion: string;
  fecha: string;
  ultimaDecision: { decision: string; motivo: string; fecha: string } | null;
}
interface Analitica {
  historialDisponible: boolean;
  mensaje?: string;
  desde: string;
  hasta: string;
  evolucionMensual?: { mes: string; asistencias: number }[];
  comparacionSedes?: { sede: string; asistencias: number; promedioDiario: number; sociosActivos: number; asistenciasPorSocio: number }[];
  riesgo?: { alto: number; medio: number; bajo: number };
  estimaciones?: Estimacion[];
}
interface AnalisisSocio {
  socio: { nombre: string; plan: string; sede: string };
  semanas: { desde: string; asistencias: number }[];
  senales: { id: number; tipo: string; nivel: string; detalle: string | null; detectadaEl: string }[];
}

const NIVEL: Record<string, [string, ColorInsignia, string]> = { ALTO: ['Alto', 'danger', '#b4654f'], MEDIO: ['Medio', 'warning', '#b88c2f'], BAJO: ['Bajo', 'mint', '#597746'] };
const nombreDe = (s: string) => s.split(', ').reverse().join(' ');
const mesCorto = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').replace(/^./, (c) => c.toUpperCase());
/** 12 semanas → 3 bloques de 4 semanas (los "últimos tres meses" del prototipo). */
const bloques = (semanas: { asistencias: number }[]) => [0, 1, 2].map((b) => semanas.slice(b * 4, b * 4 + 4).reduce((t, s) => t + s.asistencias, 0));
const INCENTIVOS = ['7 días de Premium bonificado', 'Pase para entrenar con un acompañante', 'Beneficio en comercio saludable', 'Evaluación con entrenador'];

/** NeuroGym Intelligence (CU-002-006 a 009, Figuras 37 y 38): analítica avanzada; nada se ejecuta automáticamente (RD10). */
export function Intelligence() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('RETENCION', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [meses, setMeses] = useState(6);
  const desde = sumarDiasIso(hoyIso(), -30 * meses);
  const hasta = hoyIso();
  const filtros = { desde, hasta, ...(sedeId ? { sedeId } : {}) };
  const gimnasio = useApi(() => api.get<{ suscripcion: { tipo: string } | null }>('/admin/gimnasio'));
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const analitica = useApi(() => api.get<Analitica>('/analitica', filtros), [sedeId, meses]);
  const [filtroCasos, setFiltroCasos] = useState<'REVISAR' | 'TODOS' | 'ALTO' | 'MEDIO' | 'SEGUIMIENTO'>('REVISAR');
  const [detalles, setDetalles] = useState<Record<number, AnalisisSocio>>({});
  const [caso, setCaso] = useState<Estimacion | null>(null);
  const [decision, setDecision] = useState<{ tipo: 'MANTENER_EN_OBSERVACION' | 'PREPARAR_PROPUESTA'; motivo: string; incentivo: string; mensaje: string } | null>(null);
  const accion = useAccion();
  const a = analitica.datos;

  // Historial semanal de cada caso visible (para la tendencia de los últimos tres meses).
  useEffect(() => {
    const ids = (a?.estimaciones ?? []).slice(0, 12).map((e) => e.socioId).filter((id) => !detalles[id]);
    if (!ids.length || !puede('RETENCION')) return;
    void Promise.all(ids.map((id) => api.get<AnalisisSocio>(`/analitica/socios/${id}`).then((d) => [id, d] as const).catch(() => null))).then((r) =>
      setDetalles((x) => ({ ...x, ...Object.fromEntries(r.filter(Boolean) as [number, AnalisisSocio][]) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);

  if (gimnasio.datos && gimnasio.datos.suscripcion?.tipo !== 'INTELLIGENCE') return <Bloqueo />;
  if (analitica.cargando && !a) return <Cargando />;

  const evolucion = a?.evolucionMensual ?? [];
  const comparacion = a?.comparacionSedes ?? [];
  const estimaciones = a?.estimaciones ?? [];
  const totalAsistencias = evolucion.reduce((t, m) => t + m.asistencias, 0);
  // Como en el prototipo, los indicadores usan el último mes completo; el mes en curso se ve aparte en la gráfica.
  const completos = evolucion.filter((m) => m.mes < hoyIso().slice(0, 7));
  const ultimo = completos.at(-1);
  const anterior = completos.at(-2);
  const variacion = ultimo && anterior && anterior.asistencias ? Math.round(((ultimo.asistencias - anterior.asistencias) / anterior.asistencias) * 1000) / 10 : null;
  const revisar = estimaciones.filter((e) => e.nivel !== 'BAJO');
  const sinDecision = revisar.filter((e) => !e.ultimaDecision);
  const casos = estimaciones.filter((e) =>
    filtroCasos === 'TODOS' ? true : filtroCasos === 'REVISAR' ? e.nivel !== 'BAJO' && !e.ultimaDecision : filtroCasos === 'SEGUIMIENTO' ? !!e.ultimaDecision : e.nivel === filtroCasos,
  );
  const sedeNombre = sedes.datos?.find((s) => String(s.id) === sedeId)?.nombre ?? 'Todas las sedes';

  const exportar = async () => {
    if (await accion.ejecutar(() => api.descargar('/analitica/reporte', `NeuroGym_Intelligence_${hoyIso()}.xlsx`, filtros).then(() => true))) toast('Informe Excel exportado con la sede y el período seleccionados.');
  };
  const abrirCaso = (e: Estimacion) => {
    accion.limpiar();
    setCaso(e);
    if (!detalles[e.socioId]) void api.get<AnalisisSocio>(`/analitica/socios/${e.socioId}`).then((d) => setDetalles((x) => ({ ...x, [e.socioId]: d })));
  };
  const guardarDecision = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!caso || !decision) return;
    if (decision.motivo.trim().length < 8) return accion.setError('Registrá el motivo de la decisión (al menos 8 caracteres).');
    const ok = await accion.ejecutar(() =>
      api.post('/decisiones', {
        estimacionId: caso.estimacionId,
        decision: decision.tipo,
        motivo: decision.motivo,
        ...(decision.tipo === 'PREPARAR_PROPUESTA' ? { incentivo: decision.incentivo, mensaje: decision.mensaje, ...(decision.incentivo === INCENTIVOS[0] ? { premiumDias: 7 } : {}) } : {}),
      }),
    );
    if (ok) {
      toast(decision.tipo === 'PREPARAR_PROPUESTA' ? 'Propuesta guardada. Se aprueba desde Constancia y regreso.' : 'Decisión registrada. El caso queda en observación.');
      setDecision(null);
      setCaso(null);
      void analitica.recargar();
    }
  };

  const det = caso ? detalles[caso.socioId] : undefined;
  const primerNombre = caso ? nombreDe(caso.socio).split(' ')[0] : '';
  return (
    <div className="ngi-root">
      <Encabezado
        ceja="ANALÍTICA AVANZADA DE RETENCIÓN"
        titulo="NeuroGym Intelligence"
        subtitulo="Del historial de asistencia a una decisión con contexto."
        accion={
          <Boton estilo="outline" icono="download" cargando={accion.enviando && !caso} onClick={exportar}>
            Exportar informe Excel
          </Boton>
        }
      />
      <section className="ngi-hero">
        <div>
          <span className="ngi-label">UN APOYO PARA DECIDIR</span>
          <h2>
            Detectá cambios.
            <br />
            Acompañá cada caso.
          </h2>
          <p>Explorá la evolución, revisá el riesgo estimado y elegí una acción con fundamento. El gimnasio decide qué aplicar.</p>
        </div>
        <div className="ngi-hero-side">
          <Insignia color="lilac">Datos del gimnasio</Insignia>
          <strong>
            {fechaLarga(desde, false)} – {fechaLarga(hasta, false)}
          </strong>
          <span>Corte operativo: {fechaLarga(hasta)}</span>
        </div>
      </section>
      <ErrorFormulario>{!caso ? (accion.error ?? analitica.error) : null}</ErrorFormulario>
      <div className="ngi-filters">
        <label>
          Sede
          <select aria-label="Sede del análisis" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Todas las sedes</option>
            {sedes.datos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Período
          <select aria-label="Período de análisis" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            <option value={6}>Últimos 6 meses</option>
            <option value={3}>Últimos 3 meses</option>
          </select>
        </label>
        <span>{sedeNombre} · asistencias confirmadas en el período.</span>
      </div>

      {a && !a.historialDisponible ? (
        <section className="card">
          <Vacio titulo={a.mensaje ?? 'Historial aún no disponible'} descripcion="La sede necesita más días con datos para mostrar tendencias." icono="chart" />
        </section>
      ) : (
        <>
          <div className="kpi-grid ngi-kpis">
            <Kpi etiqueta={`Asistencias · ${ultimo ? mesAnio(ultimo.mes).toLowerCase() : '—'}`} valor={ultimo?.asistencias ?? 0} pie={sedeNombre} icono="heart" />
            <Kpi etiqueta="Variación mensual" valor={variacion === null ? '—' : `${variacion > 0 ? '+' : ''}${variacion.toLocaleString('es-AR')}`} unidad={variacion === null ? '' : '%'} pie="Frente al mes anterior" icono="trend" />
            <Kpi etiqueta="Casos para revisar" valor={revisar.length} pie={`Riesgo alto ${a?.riesgo?.alto ?? 0} · medio ${a?.riesgo?.medio ?? 0}`} icono="users" />
            <Kpi etiqueta="Sin decisión registrada" valor={sinDecision.length} pie="Casos de prioridad alta o media" icono="clipboard" />
          </div>
          <div className="ngi-chart-grid">
            <section className="card">
              <CabeceraTarjeta titulo="Cómo evoluciona la asistencia" subtitulo="Asistencias confirmadas al cierre de cada mes." />
              <div className="ngi-chart">
                <GraficoLinea
                  descripcion={`Asistencias por mes en ${sedeNombre}`}
                  etiquetas={evolucion.map((m) => (m.mes === hoyIso().slice(0, 7) ? `${mesCorto(m.mes)} (en curso)` : mesCorto(m.mes)))}
                  series={[{ nombre: sedeNombre, color: '#597746', valores: evolucion.map((m) => m.asistencias) }]}
                />
                <div className="chart-legend">
                  <span>
                    <i style={{ background: '#597746' }} />
                    {sedeNombre}
                  </span>
                </div>
              </div>
              <details className="ngi-data">
                <summary>Ver valores de la gráfica</summary>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sede</th>
                        {evolucion.map((m) => (
                          <th key={m.mes}>{mesCorto(m.mes)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{sedeNombre}</td>
                        {evolucion.map((m) => (
                          <td key={m.mes}>{m.asistencias}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <aside className="card ngi-reading">
              <span className="ngi-label">LECTURA DEL PERÍODO</span>
              <h3>Seguí la evolución de {sedeId ? 'esta sede' : 'tus sedes'}.</h3>
              <p>
                <strong>{sedeNombre}</strong> suma <strong>{totalAsistencias.toLocaleString('es-AR')}</strong> asistencias confirmadas en el período.
              </p>
              <p>Compará su evolución y revisá el historial de los socios antes de definir una acción. El indicador no explica por sí solo la causa de una baja.</p>
              <Boton estilo="outline" chico icono="arrow" onClick={() => document.getElementById('ngi-cases')?.scrollIntoView({ behavior: 'smooth' })}>
                Revisar casos
              </Boton>
              <div className="ngi-reading-note">
                <Icono n="heart" />
                <span>Los incentivos siguen disponibles en Standard e Intelligence.</span>
              </div>
            </aside>
          </div>

          <section className="card section-gap">
            <CabeceraTarjeta titulo="Comparación entre sedes" subtitulo="Mismo período y criterio de cálculo." />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sede</th>
                    <th>Socios activos</th>
                    <th>Asistencias</th>
                    <th>Promedio diario</th>
                    <th>Asistencias por socio</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacion.map((c) => (
                    <tr key={c.sede}>
                      <td>
                        <strong>{c.sede}</strong>
                      </td>
                      <td>{c.sociosActivos}</td>
                      <td>{c.asistencias}</td>
                      <td>{c.promedioDiario.toLocaleString('es-AR')}</td>
                      <td>
                        <Insignia color="mint">{c.asistenciasPorSocio.toLocaleString('es-AR')}</Insignia>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="ngi-method">
              <summary>Cómo leer estos indicadores</summary>
              <p>
                <strong>Asistencias:</strong> ingresos validados en recepción. Las reservas sin ingreso no cuentan. Los indicadores se consolidan con el proceso nocturno (ETL).
              </p>
              <p>
                <strong>Asistencias por socio:</strong> asistencias del período divididas por los socios activos de la sede.
              </p>
              <p>
                <strong>Estimación de riesgo:</strong> los niveles Alto, Medio y Bajo orientan la revisión. El historial aporta contexto; no identifica por sí solo la causa de una ausencia ni garantiza un
                resultado.
              </p>
            </details>
          </section>

          <section className="card section-gap ngi-cases" id="ngi-cases">
            <div className="ngi-section-head">
              <div>
                <h3>Socios que conviene revisar</h3>
                <p>El historial fundamenta la revisión y la propuesta de acompañamiento.</p>
              </div>
              <label>
                Mostrar
                <select aria-label="Filtrar casos de Intelligence" value={filtroCasos} onChange={(e) => setFiltroCasos(e.target.value as typeof filtroCasos)}>
                  <option value="REVISAR">Revisar</option>
                  <option value="TODOS">Todos</option>
                  <option value="ALTO">Alto</option>
                  <option value="MEDIO">Medio</option>
                  <option value="SEGUIMIENTO">Seguimiento</option>
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table className="data-table ngi-case-table">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>Últimos tres meses</th>
                    <th>Nivel estimado</th>
                    <th>Qué conviene revisar</th>
                    <th>Seguimiento</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {casos.map((e) => {
                    const d = detalles[e.socioId];
                    const tres = d ? bloques(d.semanas) : null;
                    return (
                      <tr key={e.estimacionId}>
                        <td>
                          <strong>{nombreDe(e.socio)}</strong>
                          <small>
                            {e.sede}
                            {d ? ` · ${d.socio.plan === 'PREMIUM' ? 'Premium' : 'Básico'}` : ''}
                          </small>
                        </td>
                        <td>
                          {tres ? (
                            <>
                              <Tendencia valores={tres} color={NIVEL[e.nivel][2]} descripcion={`Asistencias de las últimas 12 semanas: ${tres.join(', ')}`} />
                              <div>{tres.join(' → ')}</div>
                              <small>Bloques de 4 semanas</small>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <Insignia color={NIVEL[e.nivel][1]}>{NIVEL[e.nivel][0]}</Insignia>
                          <small>Estimación orientativa</small>
                        </td>
                        <td>
                          <strong>{e.recomendacion}</strong>
                          <small>{e.fundamento}</small>
                        </td>
                        <td>{e.ultimaDecision ? <Insignia color="neutral">{e.ultimaDecision.decision === 'PREPARAR_PROPUESTA' ? 'Propuesta preparada' : 'En observación'}</Insignia> : <Insignia color="warning">Sin decisión</Insignia>}</td>
                        <td>
                          <Boton estilo="outline" chico icono="chevron" onClick={() => abrirCaso(e)}>
                            Analizar
                          </Boton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {a && casos.length === 0 && <Vacio titulo="No hay casos con este filtro" descripcion="Elegí Todos para consultar la muestra completa." icono="calendar" />}
            <p className="page-note">Los niveles representan una estimación y requieren revisión humana. Nada se aplica ni se comunica automáticamente.</p>
          </section>
        </>
      )}

      {/* Figura 38 (a): análisis de un socio. */}
      <Modal titulo={caso ? `Análisis de ${nombreDe(caso.socio)}` : ''} subtitulo={caso ? `${caso.sede}${det ? ` · Plan ${det.socio.plan === 'PREMIUM' ? 'Premium' : 'Básico'}` : ''}` : ''} abierto={!!caso && !decision} onCerrar={() => setCaso(null)} ancho="wide" pie={<Boton estilo="outline" onClick={() => setCaso(null)}>Volver al panel</Boton>}>
        {caso && (
          <>
            <div className="ngi-case-meta">
              <Insignia color={NIVEL[caso.nivel][1]}>Riesgo estimado {NIVEL[caso.nivel][0].toLowerCase()}</Insignia>
              <Insignia color="neutral">{caso.ultimaDecision ? (caso.ultimaDecision.decision === 'PREPARAR_PROPUESTA' ? 'Propuesta preparada' : 'En observación') : 'Sin decisión'}</Insignia>
              <span>Estimación del {fechaLarga(caso.fecha)}</span>
            </div>
            <div className="ngi-detail-grid">
              <section className="ngi-detail-card">
                <div className="ngi-label">EVOLUCIÓN DE SU FRECUENCIA</div>
                <h3>Doce semanas para dar contexto.</h3>
                {det ? (
                  <GraficoLinea
                    descripcion={`Asistencias semanales de ${nombreDe(caso.socio)}`}
                    etiquetas={det.semanas.map((s, i) => (i % 3 === 0 ? new Date(`${s.desde}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '') : ''))}
                    series={[{ nombre: 'Asistencias', color: NIVEL[caso.nivel][2], valores: det.semanas.map((s) => s.asistencias) }]}
                  />
                ) : (
                  <Cargando />
                )}
              </section>
              <section className="ngi-detail-card">
                <div className="ngi-label">SEÑALES PARA LA REVISIÓN</div>
                <h3>Qué cambió en su actividad.</h3>
                {det && (
                  <>
                    <div className="ngi-fact">
                      <span>Primeras 4 semanas</span>
                      <strong>{bloques(det.semanas)[0]} asistencias</strong>
                    </div>
                    <div className="ngi-fact">
                      <span>Últimas 4 semanas</span>
                      <strong>{bloques(det.semanas)[2]} asistencias</strong>
                    </div>
                    {det.senales.slice(0, 2).map((s) => (
                      <div key={s.id} className="ngi-fact">
                        <span>{s.detalle ?? s.tipo}</span>
                        <strong>{fechaLarga(s.detectadaEl, false)}</strong>
                      </div>
                    ))}
                  </>
                )}
                <p className="page-note">Estas señales aportan contexto. El nivel de riesgo es una estimación y no determina que el socio vaya a abandonar.</p>
              </section>
            </div>
            <section className="ngi-recommendation">
              <span className="ngi-label">RECOMENDACIÓN PARA REVISAR</span>
              <h3>{caso.recomendacion}</h3>
              <div className="ngi-recommendation-why">
                <strong>Fundamento observado</strong>
                <span>{caso.fundamento}</span>
              </div>
              <div className="ngi-case-actions">
                {gestion ? (
                  <>
                    {caso.ultimaDecision?.decision === 'PREPARAR_PROPUESTA' ? (
                      <BotonEnlace a="/admin/retencion" icono="arrow">
                        Revisar propuesta en Constancia y regreso
                      </BotonEnlace>
                    ) : (
                      <Boton
                        icono="clipboard"
                        onClick={() =>
                          setDecision({
                            tipo: 'PREPARAR_PROPUESTA',
                            incentivo: INCENTIVOS[1],
                            mensaje: `Hola ${primerNombre}, notamos que tu frecuencia de entrenamiento cambió en las últimas semanas. ¿Querés contarnos cómo podemos acompañarte? Si te interesa retomar, podemos revisar un beneficio para vos.`,
                            motivo: `Revisar el cambio de frecuencia y conversar con el socio antes de aplicar el incentivo. ${caso.fundamento}`.slice(0, 255),
                          })
                        }
                      >
                        Preparar propuesta
                      </Boton>
                    )}
                    <Boton estilo="outline" icono="clock" onClick={() => setDecision({ tipo: 'MANTENER_EN_OBSERVACION', incentivo: '', mensaje: '', motivo: '' })}>
                      Mantener en observación
                    </Boton>
                  </>
                ) : (
                  <p className="page-note">Tu rol permite consultar el análisis. La preparación de incentivos requiere permiso de gestión en Constancia y regreso.</p>
                )}
              </div>
            </section>
            {caso.ultimaDecision && (
              <section className="ngi-decision-record">
                <strong>Última decisión · {caso.ultimaDecision.decision === 'PREPARAR_PROPUESTA' ? 'Propuesta preparada' : 'En observación'}</strong>
                <p>{caso.ultimaDecision.motivo}</p>
                <small>{fechaLarga(caso.ultimaDecision.fecha)}</small>
              </section>
            )}
          </>
        )}
      </Modal>

      {/* Figura 38 (b): preparación de la propuesta recomendada o decisión de observar. */}
      <Modal
        titulo={decision?.tipo === 'PREPARAR_PROPUESTA' ? `Preparar propuesta para ${primerNombre}` : 'Mantener el caso en observación'}
        subtitulo={decision?.tipo === 'PREPARAR_PROPUESTA' ? 'Una recomendación revisada antes de su aplicación.' : caso ? nombreDe(caso.socio) : ''}
        abierto={!!decision}
        onCerrar={() => setDecision(null)}
      >
        {decision && caso && (
          <form onSubmit={guardarDecision}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            {decision.tipo === 'PREPARAR_PROPUESTA' && (
              <>
                <div className="ngi-callout">
                  <strong>{caso.recomendacion}</strong>
                  <p>{caso.fundamento}</p>
                </div>
                <label>
                  Incentivo propuesto
                  <select value={decision.incentivo} onChange={(e) => setDecision({ ...decision, incentivo: e.target.value })}>
                    {INCENTIVOS.map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Mensaje para revisar
                  <textarea required minLength={10} maxLength={2000} value={decision.mensaje} onChange={(e) => setDecision({ ...decision, mensaje: e.target.value })} />
                </label>
              </>
            )}
            <label>
              {decision.tipo === 'PREPARAR_PROPUESTA' ? 'Motivo de la propuesta' : 'Motivo de la decisión'}
              <textarea
                required
                minLength={8}
                maxLength={255}
                placeholder="Registrá por qué conviene esperar o qué información querés revisar."
                value={decision.motivo}
                onChange={(e) => setDecision({ ...decision, motivo: e.target.value })}
              />
            </label>
            <p className="page-note">
              {decision.tipo === 'PREPARAR_PROPUESTA'
                ? 'Se guarda un borrador vinculado con este análisis. La aprobación posterior corresponde al administrador.'
                : 'Esta decisión no aplica un incentivo ni envía un mensaje. Queda registrada con el responsable y la fecha.'}
            </p>
            <div className="form-actions">
              <Boton estilo="outline" onClick={() => setDecision(null)}>
                Volver al análisis
              </Boton>
              <button className="btn primary" type="submit" disabled={accion.enviando}>
                {decision.tipo === 'PREPARAR_PROPUESTA' ? 'Guardar propuesta para revisión' : 'Guardar decisión'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/** Gimnasios con NeuroGym Standard: qué agrega Intelligence (ngi-lock del prototipo). */
function Bloqueo() {
  const { puede } = useAuth();
  return (
    <>
      <Encabezado ceja="ANALÍTICA AVANZADA" titulo="NeuroGym Intelligence" subtitulo="Más contexto para acompañar la permanencia de tus socios." />
      <section className="ngi-lock card">
        <span className="ngi-icon">
          <Icono n="chart" />
        </span>
        <div className="eyebrow">DISPONIBLE CON INTELLIGENCE</div>
        <h2>
          Entendé la evolución.
          <br />
          Elegí cómo acompañar.
        </h2>
        <p>Sumá al trabajo diario el historial de cada socio, estimaciones orientativas y recomendaciones fundamentadas, junto con tendencias y comparaciones entre sedes.</p>
        <div className="ngi-lock-features">
          <div>
            <Icono n="trend" />
            <strong>Historial del socio</strong>
            <span>Compará su frecuencia habitual con las últimas semanas.</span>
          </div>
          <div>
            <Icono n="users" />
            <strong>Riesgo con contexto</strong>
            <span>Revisá las señales que acompañan una estimación.</span>
          </div>
          <div>
            <Icono n="chart" />
            <strong>Comparación por sede</strong>
            <span>Identificá cambios entre períodos y sedes.</span>
          </div>
        </div>
        <div className="ngi-lock-buttons">
          {puede('CONFIGURACION') && (
            <BotonEnlace a="/admin/suscripcion" icono="arrow">
              Comparar suscripciones
            </BotonEnlace>
          )}
        </div>
        <p className="page-note">Tu Standard mantiene los beneficios, los incentivos y los avisos automáticos.</p>
      </section>
    </>
  );
}
