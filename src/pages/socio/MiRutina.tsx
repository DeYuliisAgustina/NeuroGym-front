import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaTexto, Aviso, Boton, Campo, Cargando, EncabezadoPagina, Modal, Pestanas, Selector, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { EjercicioRutina } from '../../types';
import { fecha } from '../../utils/formato';
import { validarEjercicio } from '../../validations/formularios';

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

/** Mi rutina (CU-003): consulta, edición, variantes y registro del entrenamiento. */
export function MiRutina() {
  const [vista, setVista] = useState<'actual' | 'historial'>('actual');
  const rutina = useApi(() => api.get<RespuestaRutina>('/socio/rutina'));
  const historial = useApi(() => api.get<{ id: number; fecha: string; ejerciciosCompletados: number; ejerciciosTotales: number }[]>('/socio/entrenamientos'));
  const opciones = useApi(() => api.get<{ objetivos: string[]; niveles: string[] }>('/socio/rutina/opciones'));
  const [dia, setDia] = useState(1);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [editando, setEditando] = useState<EjercicioRutina | null>(null);
  const [variante, setVariante] = useState<{ item: EjercicioRutina; datos: Variante | null } | null>(null);
  const [generando, setGenerando] = useState(false);
  const [resumen, setResumen] = useState(false);
  const accion = useAccion();

  const ejerciciosDia = useMemo(() => rutina.datos?.rutina?.ejercicios.filter((e) => e.dia === dia) ?? [], [rutina.datos, dia]);
  const dias = useMemo(() => [...new Set(rutina.datos?.rutina?.ejercicios.map((e) => e.dia) ?? [])], [rutina.datos]);

  if (rutina.cargando) return <Cargando />;
  if (rutina.error) return <Aviso tipo="error">{rutina.error}</Aviso>;
  const datos = rutina.datos!;

  const alternar = (e: EjercicioRutina) => {
    // CU-003-009 2.1: no se puede marcar un ejercicio con equipo no disponible.
    if (!e.disponible) return accion.setError('Elegí una variante para este equipo.');
    setMarcados((m) => (m.includes(e.id) ? m.filter((x) => x !== e.id) : [...m, e.id]));
  };

  const guardarEntrenamiento = async () => {
    const ok = await accion.ejecutar(() => api.post('/socio/entrenamientos', { dia, realizados: marcados }), 'Entrenamiento guardado en tu historial.');
    if (ok) {
      setMarcados([]);
      setResumen(false);
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
    const r = await accion.ejecutar(
      () => api.put<{ mensaje: string }>(`/socio/rutina/ejercicios/${variante.item.id}/variante`, { ejercicioId: variante.datos!.variante!.id }),
      'Variante aplicada. Tu turno se mantiene.',
    );
    if (r) {
      setVariante(null);
      void rutina.recargar();
    }
  };

  return (
    <div>
      <EncabezadoPagina
        titulo="Mi rutina"
        descripcion={datos.preferencias ? `${datos.preferencias.objetivo} · ${datos.preferencias.nivel} · ${datos.preferencias.diasPorSemana} días por semana` : undefined}
        acciones={<Boton variante="secundario" onClick={() => setGenerando(true)}>Generar rutina</Boton>}
      />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <Pestanas valor={vista} onCambiar={setVista} opciones={[{ valor: 'actual', texto: 'Rutina actual' }, { valor: 'historial', texto: 'Historial de entrenamientos' }]} />

      {vista === 'actual' && !datos.rutina && (
        <Vacio>
          Todavía no tenés una rutina. <Boton onClick={() => setGenerando(true)}>Generar rutina</Boton>
        </Vacio>
      )}
      {vista === 'actual' && datos.rutina && (
        <div className="tarjeta">
          <div className="fila" style={{ marginBottom: '0.6rem' }}>
            {dias.map((d) => (
              <button key={d} className={`dia-chip ${dia === d ? 'activa' : ''}`} onClick={() => { setDia(d); setMarcados([]); }}>
                Día {d}
              </button>
            ))}
          </div>
          <small>
            Generada el {fecha(datos.rutina.fechaGeneracion)} · {datos.generador}
          </small>
          {ejerciciosDia.map((e) => (
            <div key={e.id} className={`ejercicio ${e.disponible ? '' : 'no-disponible'}`}>
              <button
                className={`marcador ${marcados.includes(e.id) ? 'hecho' : ''}`}
                aria-pressed={marcados.includes(e.id)}
                aria-label={`Marcar ${e.nombre} como realizado`}
                onClick={() => alternar(e)}
                disabled={!e.disponible}
              >
                {marcados.includes(e.id) ? '✓' : ''}
              </button>
              <div>
                <strong>{e.nombre}</strong>
                <div className="tenue" style={{ fontSize: '0.88rem' }}>
                  {e.series} × {e.repeticiones}
                  {e.pesoKg !== null ? ` · ${e.pesoKg} kg` : ''}
                  {e.descansoSeg ? ` · descanso ${e.descansoSeg} s` : ''} · {e.grupoMuscular}
                </div>
                {!e.disponible && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <span className="etiqueta etiqueta-alerta">No disponible</span>
                    {e.mantenimientoHasta && ` Mantenimiento hasta ${fecha(e.mantenimientoHasta, true)}`}{' '}
                    <button className="btn btn-texto btn-chico" onClick={() => verVariante(e)}>
                      Ver variante
                    </button>
                  </div>
                )}
              </div>
              <Boton variante="texto" chico aria-label={`Editar ${e.nombre}`} onClick={() => setEditando(e)}>
                ✎
              </Boton>
            </div>
          ))}
          <div className="fila" style={{ marginTop: '1rem' }}>
            <Boton disabled={ejerciciosDia.length === 0} onClick={() => setResumen(true)}>
              Finalizar entrenamiento
            </Boton>
          </div>
        </div>
      )}

      {vista === 'historial' && (
        <div className="tarjeta">
          {historial.datos?.length === 0 && <Vacio>Todavía no registraste entrenamientos.</Vacio>}
          {historial.datos?.map((h) => (
            <div key={h.id} className="fila-entre" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--borde)' }}>
              <span>{fecha(h.fecha)}</span>
              <strong>
                {h.ejerciciosCompletados} de {h.ejerciciosTotales} ejercicios
              </strong>
            </div>
          ))}
          <small>El registro del entrenamiento no reemplaza la asistencia, que se confirma en recepción.</small>
        </div>
      )}

      <Modal titulo="Finalizar entrenamiento" abierto={resumen} onCerrar={() => setResumen(false)}>
        <p>
          Completaste <strong>{marcados.length}</strong> de <strong>{ejerciciosDia.length}</strong> ejercicios.
        </p>
        {marcados.length === 0 && <Aviso tipo="alerta">Marcá al menos un ejercicio para registrar el entrenamiento.</Aviso>}
        <div className="fila">
          <Boton variante="secundario" onClick={() => setResumen(false)}>
            Volver a la rutina
          </Boton>
          <Boton disabled={marcados.length === 0} cargando={accion.enviando} onClick={guardarEntrenamiento}>
            Guardar entrenamiento
          </Boton>
        </div>
      </Modal>

      {editando && <EditarEjercicio item={editando} alCerrar={() => setEditando(null)} alGuardar={() => { setEditando(null); void rutina.recargar(); }} />}

      <Modal titulo="Variante sugerida" abierto={!!variante} onCerrar={() => setVariante(null)}>
        {!variante?.datos ? (
          <Cargando texto="Consultando al servicio de IA…" />
        ) : (
          <div className="pila">
            <div>
              <small>Ejercicio actual</small>
              <div>
                <strong>{variante.datos.actual.nombre}</strong> <span className="etiqueta etiqueta-alerta">No disponible</span>
              </div>
            </div>
            {variante.datos.variante ? (
              <div className="tarjeta">
                <small>Variante sugerida</small>
                <h3>{variante.datos.variante.nombre}</h3>
                <span className="etiqueta etiqueta-ok">Disponible</span>
                <p className="tenue">{variante.datos.fundamento}</p>
              </div>
            ) : (
              <Aviso tipo="alerta">No encontramos una variante disponible. Tu rutina no cambió.</Aviso>
            )}
            <div className="fila">
              {variante.datos.variante && (
                <Boton cargando={accion.enviando} onClick={aplicarVariante}>
                  Usar variante y mantener turno
                </Boton>
              )}
              <Link to="/socio/turnos" className="btn btn-secundario">
                Elegir otro horario
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <GenerarRutina abierto={generando} opciones={opciones.datos} actual={datos.preferencias} alCerrar={() => setGenerando(false)} alGenerar={() => { setGenerando(false); void rutina.recargar(); }} />
    </div>
  );
}

function EditarEjercicio({ item, alCerrar, alGuardar }: { item: EjercicioRutina; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({ nombre: item.nombre, series: item.series, repeticiones: item.repeticiones, pesoKg: item.pesoKg, descansoSeg: item.descansoSeg });
  const [error, setError] = useState<string | null>(null);
  const accion = useAccion();
  const guardar = async () => {
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
    <Modal titulo="Ajustá tu ejercicio." abierto onCerrar={alCerrar}>
      <Aviso tipo="error">{error ?? accion.error}</Aviso>
      <Campo etiqueta="Nombre del ejercicio" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      <div className="grilla-2">
        <Campo etiqueta="Series" type="number" min={1} max={10} value={f.series} onChange={(e) => setF({ ...f, series: Number(e.target.value) })} />
        <Campo etiqueta="Repeticiones" type="number" min={1} max={100} value={f.repeticiones} onChange={(e) => setF({ ...f, repeticiones: Number(e.target.value) })} />
        <Campo etiqueta="Peso (kg)" type="number" min={0} step="0.5" value={f.pesoKg ?? ''} onChange={(e) => setF({ ...f, pesoKg: numero(e.target.value) })} />
        <Campo etiqueta="Descanso (s)" type="number" min={0} value={f.descansoSeg ?? ''} onChange={(e) => setF({ ...f, descansoSeg: numero(e.target.value) })} />
      </div>
      <div className="fila">
        <Boton variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton cargando={accion.enviando} onClick={guardar}>
          Guardar ejercicio
        </Boton>
      </div>
    </Modal>
  );
}

function GenerarRutina({
  abierto,
  opciones,
  actual,
  alCerrar,
  alGenerar,
}: {
  abierto: boolean;
  opciones: { objetivos: string[]; niveles: string[] } | null;
  actual: RespuestaRutina['preferencias'];
  alCerrar: () => void;
  alGenerar: () => void;
}) {
  const [f, setF] = useState({ objetivo: actual?.objetivo ?? '', nivel: actual?.nivel ?? '', diasPorSemana: actual?.diasPorSemana ?? 3 });
  const accion = useAccion();
  const generar = async () => {
    if (!f.objetivo || !f.nivel) return accion.setError('Completá el objetivo y la experiencia.');
    const ok = await accion.ejecutar(() => api.post('/socio/rutina', f));
    if (ok) alGenerar();
  };
  return (
    <Modal titulo="Generar rutina" abierto={abierto} onCerrar={alCerrar}>
      <Aviso tipo="error">{accion.error}</Aviso>
      <Selector etiqueta="Objetivo" vacio="Elegí tu objetivo" value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} opciones={(opciones?.objetivos ?? []).map((o) => ({ valor: o, texto: o }))} />
      <Selector etiqueta="Experiencia" vacio="Elegí tu experiencia" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })} opciones={(opciones?.niveles ?? []).map((o) => ({ valor: o, texto: o }))} />
      <Campo etiqueta="Días por semana" type="number" min={1} max={7} value={f.diasPorSemana} onChange={(e) => setF({ ...f, diasPorSemana: Number(e.target.value) })} />
      <AreaTexto etiqueta="Importante" readOnly value="La nueva rutina reemplaza a la vigente. No se solicitan datos biométricos." rows={2} />
      <div className="fila">
        <Boton variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton cargando={accion.enviando} onClick={generar}>
          Generar rutina
        </Boton>
      </div>
    </Modal>
  );
}
