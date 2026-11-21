import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, Modal, Pestanas, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { EjercicioRutina } from '../../types';
import { fechaLarga, conSede } from '../../utils/formato';
import { validarEjercicio } from '../../validations/formularios';
import { iconoEjercicio } from './InicioSocio';

interface RespuestaRutina {
  generador: string;
  preferencias: { objetivo: string; nivel: string; diasPorSemana: number } | null;
  rutina: { id: number; fechaGeneracion: string; ejercicios: EjercicioRutina[] } | null;
}
interface Variante {
  actual: { nombre: string; grupoMuscular: string; mantenimientoHasta: string | null };
  variante: { id: number; nombre: string; grupoMuscular: string; disponible: boolean } | null;
  fundamento: string;
}
interface Entrenamiento {
  id: number;
  fecha: string;
  ejerciciosCompletados: number;
  ejerciciosTotales: number;
}

/** Mi rutina (CU-003, Figuras 39 a 42): consulta, edición, variantes y registro del entrenamiento. */
export function MiRutina() {
  const navegar = useNavigate();
  const toast = useToast();
  const [vista, setVista] = useState<'actual' | 'historial'>('actual');
  const rutina = useApi(() => api.get<RespuestaRutina>('/socio/rutina'));
  const perfil = useApi(() => api.get<{ sede: { nombre: string } }>('/socio/perfil'));
  const historial = useApi(() => api.get<Entrenamiento[]>('/socio/entrenamientos'));
  const [dia, setDia] = useState<number | null>(null);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [editando, setEditando] = useState<EjercicioRutina | null>(null);
  const [variante, setVariante] = useState<{ item: EjercicioRutina; datos: Variante | null } | null>(null);
  const [generar, setGenerar] = useState(false);
  const [guardar, setGuardar] = useState(false);
  const accion = useAccion();

  const ejercicios = rutina.datos?.rutina?.ejercicios ?? [];
  const dias = useMemo(() => [...new Set(ejercicios.map((e) => e.dia))].sort((a, b) => a - b), [ejercicios]);
  const diaActual = dia ?? dias[0] ?? 1;
  const delDia = ejercicios.filter((e) => e.dia === diaActual).sort((a, b) => a.orden - b.orden);

  if (rutina.cargando) return <Cargando />;
  if (rutina.error) return <ErrorFormulario>{rutina.error}</ErrorFormulario>;
  const pref = rutina.datos!.preferencias;

  const alternar = (e: EjercicioRutina) => {
    // CU-003-009 2.1: no se puede completar un ejercicio con equipo no disponible.
    if (!e.disponible) return;
    setMarcados((m) => (m.includes(e.id) ? m.filter((x) => x !== e.id) : [...m, e.id]));
  };

  const guardarEntrenamiento = async () => {
    const ok = await accion.ejecutar(() => api.post('/socio/entrenamientos', { dia: diaActual, realizados: marcados }));
    if (ok) {
      setMarcados([]);
      setGuardar(false);
      toast('Entrenamiento guardado en tu historial.');
      void historial.recargar();
    }
  };

  const verVariante = async (item: EjercicioRutina) => {
    setVariante({ item, datos: null });
    const r = await accion.ejecutar(() => api.get<Variante>(`/socio/rutina/ejercicios/${item.id}/variante`));
    if (r) setVariante({ item, datos: r });
    else setVariante(null);
  };

  const aplicarVariante = async () => {
    if (!variante?.datos?.variante) return;
    const r = await accion.ejecutar(() => api.put(`/socio/rutina/ejercicios/${variante.item.id}/variante`, { ejercicioId: variante.datos!.variante!.id }));
    if (r) {
      setVariante(null);
      toast('Variante aplicada. Tu turno se mantiene.');
      void rutina.recargar();
    }
  };

  const completados = marcados.filter((id) => delDia.some((e) => e.id === id)).length;
  const progreso = delDia.length ? Math.round((completados / delDia.length) * 100) : 0;

  return (
    <>
      <Encabezado
        ceja="ENTRENAMIENTO PERSONALIZADO"
        titulo="Mi rutina"
        subtitulo="Revisá los ejercicios y ajustá series, repeticiones y pesos."
        accion={
          <Boton icono="sparkles" onClick={() => setGenerar(true)}>
            Generar rutina
          </Boton>
        }
      />
      <Pestanas
        valor={vista}
        onCambiar={setVista}
        opciones={[
          { valor: 'actual', texto: 'Rutina actual' },
          { valor: 'historial', texto: 'Historial de entrenamientos' },
        ]}
      />
      <ErrorFormulario>{accion.error}</ErrorFormulario>

      {vista === 'historial' ? (
        <section className="card">
          <CabeceraTarjeta titulo="Tus últimos entrenamientos" subtitulo="Sesiones guardadas." />
          {historial.datos?.map((h) => (
            <div key={h.id} className="history-item">
              <div className="date-square">
                <small>{new Date(`${h.fecha.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</small>
                <strong>{Number(h.fecha.slice(8, 10))}</strong>
              </div>
              <div>
                <h3>{pref?.objetivo ?? 'Entrenamiento'}</h3>
                <p>
                  {new Date(`${h.fecha.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long' })} · {h.ejerciciosCompletados} de {h.ejerciciosTotales} ejercicios completados
                </p>
              </div>
              <Insignia color={h.ejerciciosCompletados < h.ejerciciosTotales ? 'neutral' : ''}>{h.ejerciciosCompletados < h.ejerciciosTotales ? 'Parcial' : 'Completado'}</Insignia>
            </div>
          ))}
          {historial.datos?.length === 0 && <Vacio titulo="Todavía no hay entrenamientos" descripcion="Completá tu primera rutina para verla en el historial." icono="dumbbell" />}
        </section>
      ) : !ejercicios.length ? (
        <section className="card">
          <Vacio
            titulo="Todavía no tenés una rutina"
            descripcion="Elegí tu objetivo, tu experiencia y los días que entrenás para generarla."
            icono="sparkles"
            accion={
              <Boton icono="sparkles" onClick={() => setGenerar(true)}>
                Generar rutina
              </Boton>
            }
          />
        </section>
      ) : (
        <div className="two-col">
          <div>
            <div className="routine-banner">
              <div className="spread">
                <div className="eyebrow">TU PLAN ACTUAL</div>
                <Insignia color="lilac">Personalizada · IA</Insignia>
              </div>
              <h2>{pref?.objetivo}</h2>
              <p style={{ fontSize: 12 }}>
                {pref?.nivel} · {pref?.diasPorSemana} días por semana
              </p>
              <div className="routine-meta">
                <span>
                  <Icono n="clock" />
                  {Math.max(20, delDia.length * 11)} minutos
                </span>
                <span>
                  <Icono n="dumbbell" />
                  {delDia.length} ejercicios
                </span>
                <span>
                  <Icono n="pin" />
                  {conSede(perfil.datos?.sede.nombre ?? '')}
                </span>
              </div>
            </div>
            {dias.length > 1 && (
              <Pestanas
                valor={String(diaActual)}
                onCambiar={(v) => {
                  setDia(Number(v));
                  setMarcados([]);
                }}
                opciones={dias.map((d) => ({ valor: String(d), texto: `Día ${d}` }))}
              />
            )}
            <section className="card">
              {delDia.map((e, i) => {
                const hecho = marcados.includes(e.id);
                const equipo = e.equipos.find((q) => q.estado !== 'OPERATIVO');
                return (
                  <article key={e.id} className={`exercise-row ${hecho ? 'done' : ''}`.trim()}>
                    <div className="exercise-icon">
                      <Icono n={iconoEjercicio(e.grupoMuscular)} />
                    </div>
                    <div className="exercise-body">
                      <h3>
                        <span className="muted" style={{ fontSize: 10 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {e.nombre}
                        {!e.disponible && <Insignia color="warning">No disponible</Insignia>}
                      </h3>
                      <p>{e.grupoMuscular}</p>
                      <div className="exercise-stats">
                        <span>
                          <strong>{e.series}</strong> series
                        </span>
                        <span>
                          <strong>{e.repeticiones}</strong> reps
                        </span>
                        <span>
                          <strong>{e.pesoKg ?? '—'}</strong> {e.pesoKg !== null ? 'kg' : 'corporal'}
                        </span>
                        <span>
                          <strong>{e.descansoSeg ?? 0}</strong> s descanso
                        </span>
                      </div>
                      {!e.disponible && (
                        <div className="routine-warning">
                          <Icono n="warning" />
                          {equipo?.nombre ?? 'El equipo'} {e.mantenimientoHasta ? `en mantenimiento hasta el ${fechaLarga(e.mantenimientoHasta, false)}` : 'no está disponible'}. Elegí cómo continuar.
                        </div>
                      )}
                    </div>
                    <div className="exercise-actions">
                      {!e.disponible && (
                        <Boton estilo="soft" chico icono="sparkles" onClick={() => verVariante(e)}>
                          Ver variante
                        </Boton>
                      )}
                      <button className="icon-button" type="button" aria-label={`Editar ${e.nombre}`} onClick={() => setEditando(e)}>
                        <Icono n="edit" />
                      </button>
                      <button
                        className={`complete-check ${hecho ? 'active' : ''}`.trim()}
                        type="button"
                        aria-label={`Completar ${e.nombre}`}
                        aria-pressed={hecho}
                        disabled={!e.disponible}
                        title={!e.disponible ? 'Elegí una variante antes de completar este ejercicio' : undefined}
                        onClick={() => alternar(e)}
                      >
                        <Icono n="check" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
            <p className="page-note">
              Rutina generada el {fechaLarga(rutina.datos!.rutina!.fechaGeneracion)} con {rutina.datos!.generador}. Podés revisar y editar cada ejercicio.
            </p>
          </div>
          <div className="stack">
            <section className="card session-progress">
              <CabeceraTarjeta titulo="Tu sesión de hoy" subtitulo="Ejercicios completados." />
              <div className="progress-ring" style={{ ['--progress' as string]: `${progreso}%` }}>
                <div>
                  <strong>
                    {completados}/{delDia.length}
                  </strong>
                  <small>EJERCICIOS COMPLETADOS</small>
                </div>
              </div>
              <p>Marcá cada ejercicio al finalizarlo. Podés ajustar los pesos y repeticiones durante tu entrenamiento.</p>
              <Boton completo icono="check" disabled={completados === 0} onClick={() => setGuardar(true)}>
                Finalizar entrenamiento
              </Boton>
              <div className="divider" />
              <FilaDato etiqueta="Objetivo">{pref?.objetivo}</FilaDato>
              <FilaDato etiqueta="Experiencia">{pref?.nivel}</FilaDato>
              <FilaDato etiqueta="Tu reserva">Se mantiene sin cambios</FilaDato>
            </section>
            <aside className="soft-alert green">
              <Icono n="heart" />
              <div>
                <h4>El progreso también necesita pausas</h4>
                <p>Tomate los descansos de la rutina y revisá los ajustes con tu entrenador.</p>
              </div>
            </aside>
          </div>
        </div>
      )}

      {editando && (
        <EditarEjercicio
          item={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            toast('Ejercicio actualizado.');
            void rutina.recargar();
          }}
        />
      )}
      <GenerarRutina
        abierto={generar}
        actual={pref}
        alCerrar={() => setGenerar(false)}
        alGenerar={() => {
          setGenerar(false);
          setDia(null);
          setMarcados([]);
          toast('Tu nueva rutina está lista. Podés editar cada ejercicio.');
          void rutina.recargar();
        }}
      />

      {/* Figura 42 (a): variante sugerida ante un equipo no disponible (CU-003-007). */}
      <Modal
        titulo={`Variante para ${variante?.item.nombre.toLowerCase() ?? 'tu ejercicio'}`}
        subtitulo="El equipo no está disponible. Elegí qué hacer con tu entrenamiento."
        abierto={!!variante}
        onCerrar={() => setVariante(null)}
        pie={
          <>
            <Boton estilo="outline" icono="calendar" onClick={() => navegar('/socio/turnos')}>
              Elegir otro horario
            </Boton>
            <Boton icono="check" disabled={!variante?.datos?.variante} cargando={accion.enviando} onClick={aplicarVariante}>
              Usar variante y mantener turno
            </Boton>
          </>
        }
      >
        {!variante?.datos ? (
          <Cargando texto="Buscando una variante…" />
        ) : (
          <>
            <div className="comparison">
              <div>
                <div className="eyebrow">EJERCICIO ACTUAL</div>
                <h3>{variante.datos.actual.nombre}</h3>
                <p>{variante.datos.actual.grupoMuscular} · fuera de servicio</p>
                <Insignia color="warning">{variante.datos.actual.mantenimientoHasta ? `Hasta el ${fechaLarga(variante.datos.actual.mantenimientoHasta, false)}` : 'Pendiente de revisión'}</Insignia>
              </div>
              <div>
                <div className="eyebrow">VARIANTE SUGERIDA</div>
                {variante.datos.variante ? (
                  <>
                    <h3>{variante.datos.variante.nombre}</h3>
                    <p>
                      {variante.datos.variante.grupoMuscular} · {variante.item.series} series de {variante.item.repeticiones}
                    </p>
                    <Insignia>Mismo grupo muscular</Insignia>
                  </>
                ) : (
                  <p>No hay una variante disponible en tu sede para este grupo muscular.</p>
                )}
              </div>
            </div>
            <p className="modal-text">{variante.datos.fundamento}</p>
            <p className="page-note">Tu reserva se mantiene hasta que confirmes otro horario. El cambio se aplica solo si lo elegís.</p>
          </>
        )}
      </Modal>

      {/* Figura 42 (b): registro del entrenamiento realizado (CU-003-009). */}
      <Modal
        titulo="Guardar entrenamiento"
        subtitulo="Guardá el entrenamiento que acabás de realizar."
        abierto={guardar}
        onCerrar={() => setGuardar(false)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setGuardar(false)}>
              Volver a la rutina
            </Boton>
            <Boton icono="check" cargando={accion.enviando} onClick={guardarEntrenamiento}>
              Guardar entrenamiento
            </Boton>
          </>
        }
      >
        <div className="modal-hero-icon">
          <Icono n="dumbbell" />
        </div>
        <h3>
          {completados} de {delDia.length} ejercicios completados
        </h3>
        <p className="modal-text" style={{ marginTop: 15 }}>
          {completados < delDia.length ? 'Podés finalizar con los ejercicios realizados o volver a la rutina.' : 'Tu entrenamiento está completo. Guardalo en tu historial.'}
        </p>
        <p className="page-note">La asistencia al gimnasio se registra al ingresar, de manera independiente del entrenamiento.</p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
      </Modal>
    </>
  );
}

/** "Ajustá tu ejercicio." (Figura 41, CU-003-003). */
function EditarEjercicio({ item, alCerrar, alGuardar }: { item: EjercicioRutina; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({ nombre: item.nombre, series: item.series, repeticiones: item.repeticiones, pesoKg: item.pesoKg, descansoSeg: item.descansoSeg });
  const [error, setError] = useState<string | null>(null);
  const accion = useAccion();
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = validarEjercicio(f);
    setError(problema);
    if (problema) return;
    const ok = await accion.ejecutar(() =>
      api.put(`/socio/rutina/ejercicios/${item.id}`, {
        nombreEjercicio: f.nombre,
        series: f.series,
        repeticiones: f.repeticiones,
        pesoKg: f.pesoKg,
        descansoSeg: f.descansoSeg,
      }),
    );
    if (ok) alGuardar();
  };
  const numero = (v: string) => (v === '' ? null : Number(v));
  return (
    <Modal titulo="Ajustá tu ejercicio." subtitulo="Editá series, repeticiones y peso." abierto onCerrar={alCerrar}>
      <form onSubmit={guardar} noValidate>
        <ErrorFormulario>{error ?? accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label className="wide">
            Nombre del ejercicio
            <input required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label>
            Series
            <input type="number" min={1} max={10} value={f.series} onChange={(e) => setF({ ...f, series: Number(e.target.value) })} />
          </label>
          <label>
            Repeticiones
            <input type="number" min={1} max={100} value={f.repeticiones} onChange={(e) => setF({ ...f, repeticiones: Number(e.target.value) })} />
          </label>
          <label>
            Peso (kg)
            <input type="number" min={0} max={500} step="0.5" value={f.pesoKg ?? ''} onChange={(e) => setF({ ...f, pesoKg: numero(e.target.value) })} />
          </label>
          <label>
            Descanso (segundos)
            <input type="number" min={0} max={600} step={5} value={f.descansoSeg ?? ''} onChange={(e) => setF({ ...f, descansoSeg: numero(e.target.value) })} />
          </label>
        </div>
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Cancelar
          </Boton>
          <button className="btn primary" type="submit" disabled={accion.enviando}>
            Guardar ejercicio
          </button>
        </div>
      </form>
    </Modal>
  );
}

const PASOS_GENERACION = ['Analizando tus preferencias', 'Eligiendo ejercicios disponibles en tu sede', 'Armando series, repeticiones y descansos', 'Revisando que la rutina sea segura'];

/** Indicador mientras la IA arma la rutina (puede tardar unos 20 a 30 segundos). */
function ProgresoGeneracion() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const paso = PASOS_GENERACION[Math.min(Math.floor(segundos / 6), PASOS_GENERACION.length - 1)];
  return (
    <div className="generando" role="status" aria-live="polite">
      <div className="generando-cabecera">
        <span className="spinner spinner-grande" aria-hidden="true" />
        <div>
          <strong>La IA está preparando tu rutina…</strong>
          <p>
            {paso} · {segundos} s
          </p>
        </div>
      </div>
      <div className="generando-barra" aria-hidden="true">
        <span />
      </div>
      <p className="generando-nota">Suele tardar entre 20 y 30 segundos. No cierres esta ventana.</p>
    </div>
  );
}

/** "Generar rutina" (Figura 39, CU-003): la nueva rutina reemplaza a la vigente. */
function GenerarRutina({ abierto, actual, alCerrar, alGenerar }: { abierto: boolean; actual: RespuestaRutina['preferencias']; alCerrar: () => void; alGenerar: () => void }) {
  const [f, setF] = useState({ objetivo: actual?.objetivo ?? 'Fuerza y bienestar', nivel: actual?.nivel ?? 'Principiante', diasPorSemana: actual?.diasPorSemana ?? 3 });
  const accion = useAccion();
  const generar = async (e: FormEvent) => {
    e.preventDefault();
    if (await accion.ejecutar(() => api.post('/socio/rutina', f))) alGenerar();
  };
  return (
    <Modal titulo="Generar rutina" subtitulo="Elegí tus preferencias para preparar una nueva rutina." abierto={abierto} onCerrar={alCerrar}>
      <form onSubmit={generar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label className="wide">
            Objetivo
            <select value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })}>
              {['Fuerza y bienestar', 'Resistencia', 'Hipertrofia', 'Movilidad'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Experiencia
            <select value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })}>
              {['Principiante', 'Intermedio', 'Avanzado'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Días por semana
            <select value={f.diasPorSemana} onChange={(e) => setF({ ...f, diasPorSemana: Number(e.target.value) })}>
              {[2, 3, 4, 5].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
        {accion.enviando ? (
          <ProgresoGeneracion />
        ) : (
          <p className="page-note">La nueva rutina reemplaza la actual; podés revisar los ejercicios antes de entrenar. No se solicitan datos biométricos.</p>
        )}
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Cancelar
          </Boton>
          <button className="btn primary" type="submit" disabled={accion.enviando} aria-busy={accion.enviando}>
            {accion.enviando ? <span className="spinner" aria-hidden="true" /> : <Icono n="sparkles" />}
            {accion.enviando ? 'Generando…' : 'Generar rutina'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
