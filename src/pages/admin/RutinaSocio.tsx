import { useMemo, useState } from 'react';
import { Icono } from '../../components/Icono';
import { Boton, Cargando, ErrorFormulario, Insignia, Modal, Pestanas, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { PreferenciasRutina } from '../../services/generacionRutina';
import type { EjercicioRutina } from '../../types';
import { fechaLarga } from '../../utils/formato';
import { iconoEjercicio } from '../socio/InicioSocio';
import { EditarEjercicio, GenerarRutina, identificarIA, type RespuestaRutina } from '../socio/MiRutina';

/**
 * RF5: rutina de un socio vista por el personal. Con permiso de gestión sobre Socios
 * puede generarla con IA (reemplaza a la vigente) y editar cada ejercicio; con
 * consulta, solo verla. El socio la encuentra en «Mi rutina». Las variantes ante
 * un equipo no disponible las decide el socio (RD11).
 */
export function RutinaSocio({ socioId, nombre, activo, gestion, alCerrar }: { socioId: number; nombre: string; activo: boolean; gestion: boolean; alCerrar: () => void }) {
  const toast = useToast();
  const base = `/admin/socios/${socioId}/rutina`;
  const rutina = useApi(() => api.get<RespuestaRutina>(base), [socioId]);
  const [dia, setDia] = useState<number | null>(null);
  const [generar, setGenerar] = useState(false);
  const [editando, setEditando] = useState<EjercicioRutina | null>(null);
  const generacion = useAccion();
  const puedeModificar = gestion && activo;

  const ejercicios = rutina.datos?.rutina?.ejercicios ?? [];
  const dias = useMemo(() => [...new Set(ejercicios.map((e) => e.dia))].sort((a, b) => a - b), [ejercicios]);
  const diaActual = dia !== null && dias.includes(dia) ? dia : (dias[0] ?? 1);
  const delDia = ejercicios.filter((e) => e.dia === diaActual).sort((a, b) => a.orden - b.orden);
  const pref = rutina.datos?.preferencias ?? null;

  const generarRutina = async (preferencias: PreferenciasRutina) => {
    setGenerar(false);
    const r = await generacion.ejecutar(() => api.post<RespuestaRutina>(base, preferencias));
    if (r) {
      setDia(null);
      toast(`Rutina generada para ${nombre}. Ya la ve en «Mi rutina».`);
      void rutina.recargar();
    }
  };

  const botonGenerar = puedeModificar && (
    <Boton icono="sparkles" cargando={generacion.enviando} disabled={generacion.enviando} onClick={() => setGenerar(true)}>
      {generacion.enviando ? 'Generando…' : ejercicios.length ? 'Generar nueva rutina' : 'Generar rutina con IA'}
    </Boton>
  );

  return (
    <>
      <Modal titulo={`Rutina de ${nombre}`} subtitulo="La rutina que el socio ve en «Mi rutina»." ancho="wide" abierto onCerrar={alCerrar}>
        {rutina.cargando ? (
          <Cargando />
        ) : rutina.error ? (
          <ErrorFormulario>{rutina.error}</ErrorFormulario>
        ) : (
          <>
            <ErrorFormulario>{generacion.error}</ErrorFormulario>
            {generacion.enviando && (
              <div className="soft-alert green" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <div>
                  <h4>Generando la rutina con IA…</h4>
                  <p>Suele tardar entre 20 y 30 segundos. La nueva rutina reemplaza a la actual.</p>
                </div>
              </div>
            )}
            {!activo && <p className="page-note">El socio está desactivado: podés consultar su rutina, pero no modificarla.</p>}
            {!ejercicios.length ? (
              !generacion.enviando && (
                <Vacio
                  titulo="Todavía no tiene una rutina"
                  descripcion={puedeModificar ? 'Elegí el objetivo, la experiencia y los días que entrena para generarla con IA.' : 'El socio puede generarla desde «Mi rutina».'}
                  icono="sparkles"
                  accion={botonGenerar || undefined}
                />
              )
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>
                    {pref?.objetivo ?? 'Rutina'}{' '}
                    <Insignia color="lilac">{identificarIA(rutina.datos!.generador).real ? `Con ${identificarIA(rutina.datos!.generador).nombre}` : 'Simulación'}</Insignia>
                  </h3>
                  <p className="muted" style={{ margin: '4px 0 12px' }}>
                    {pref ? `${pref.nivel} · ${pref.diasPorSemana} días por semana · ` : ''}generada el {fechaLarga(rutina.datos!.rutina!.fechaGeneracion)}
                  </p>
                  {botonGenerar}
                </div>
                {dias.length > 1 && <Pestanas valor={String(diaActual)} onCambiar={(v) => setDia(Number(v))} opciones={dias.map((d) => ({ valor: String(d), texto: `Día ${d}` }))} />}
                <section className="card">
                  {delDia.map((e, i) => (
                    <article key={e.id} className="exercise-row">
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
                      </div>
                      {puedeModificar && (
                        <div className="exercise-actions">
                          <button className="icon-button" type="button" aria-label={`Editar ${e.nombre}`} onClick={() => setEditando(e)}>
                            <Icono n="edit" />
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </section>
                <p className="page-note">Si un equipo no está disponible, el socio elige la variante desde «Mi rutina».</p>
              </>
            )}
          </>
        )}
      </Modal>

      {generar && (
        <GenerarRutina
          abierto
          actual={pref}
          generador={rutina.datos?.generador}
          alCerrar={() => setGenerar(false)}
          alIniciar={generarRutina}
          subtitulo={`Elegí las preferencias de ${nombre} para preparar su rutina.`}
          nota="La nueva rutina reemplaza la actual y el socio la ve en «Mi rutina». La IA tarda unos segundos. No se solicitan datos biométricos."
        />
      )}
      {editando && (
        <EditarEjercicio
          item={editando}
          ruta={`${base}/ejercicios/${editando.id}`}
          titulo="Ajustar ejercicio"
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            toast('Ejercicio actualizado.');
            void rutina.recargar();
          }}
        />
      )}
    </>
  );
}
