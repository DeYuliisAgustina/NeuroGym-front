import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AreaTexto, Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Kpi, Modal, Selector, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { fecha, hoyIso, sumarDiasIso } from '../../utils/formato';

interface Estimacion {
  estimacionId: number;
  socioId: number;
  socio: string;
  sede: string;
  nivel: string;
  fundamento: string;
  recomendacion: string;
  fecha: string;
  ultimaDecision: { decision: string; motivo: string } | null;
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

/** NeuroGym Intelligence (CU-002-006 a 009): analítica avanzada; nada se ejecuta automáticamente (RD10). */
export function Intelligence() {
  const { puede } = useAuth();
  const [filtros, setFiltros] = useState({ sedeId: '', desde: sumarDiasIso(hoyIso(), -180), hasta: hoyIso() });
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const analitica = useApi(() => api.get<Analitica>('/admin/intelligence/analitica', filtros), [filtros.sedeId, filtros.desde, filtros.hasta]);
  const [analisis, setAnalisis] = useState<{ estimacion: Estimacion; datos: AnalisisSocio } | null>(null);
  const [decision, setDecision] = useState<{ estimacion: Estimacion; tipo: 'MANTENER_EN_OBSERVACION' | 'PREPARAR_PROPUESTA'; motivo: string; incentivo: string; mensaje: string } | null>(null);
  const accion = useAccion();

  const verAnalisis = async (e: Estimacion) => {
    const d = await accion.ejecutar(() => api.get<AnalisisSocio>(`/admin/retencion/socios/${e.socioId}`));
    if (d) setAnalisis({ estimacion: e, datos: d });
  };
  const guardarDecision = async () => {
    const d = decision!;
    if (!d.motivo.trim()) return accion.setError('Indicá el motivo.');
    if (d.tipo === 'PREPARAR_PROPUESTA' && (!d.incentivo.trim() || !d.mensaje.trim())) return accion.setError('Completá el incentivo y el mensaje.');
    const ok = await accion.ejecutar(
      () => api.post(`/admin/intelligence/estimaciones/${d.estimacion.estimacionId}/decision`, { decision: d.tipo, motivo: d.motivo, incentivo: d.incentivo || undefined, mensaje: d.mensaje || undefined }),
      d.tipo === 'PREPARAR_PROPUESTA' ? 'Propuesta guardada para revisión en "Propuestas de incentivo".' : 'Decisión registrada.',
    );
    if (ok) {
      setDecision(null);
      void analitica.recargar();
    }
  };
  const exportar = () => accion.ejecutar(() => api.descargar('/admin/intelligence/reporte.xlsx', 'reporte-retencion-neurogym.xlsx', filtros), 'Informe exportado.');

  const a = analitica.datos;
  return (
    <div>
      <EncabezadoPagina titulo="NeuroGym Intelligence" descripcion="Estimaciones orientativas: no anticipan que un socio vaya a abandonar ni se aplican solas." acciones={a?.historialDisponible && <Boton variante="secundario" onClick={exportar}>Exportar informe Excel</Boton>} />
      <Aviso tipo="error">{accion.error ?? analitica.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="tarjeta grilla-3">
        <Selector etiqueta="Sede" vacio="Todas" value={filtros.sedeId} onChange={(e) => setFiltros({ ...filtros, sedeId: e.target.value })} opciones={(sedes.datos ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
        <Campo etiqueta="Desde" type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
      </div>
      {analitica.cargando && <Cargando />}
      {a && !a.historialDisponible && <Aviso tipo="alerta">{a.mensaje}. Elegí otra sede.</Aviso>}
      {a?.historialDisponible && (
        <>
          <div className="grilla-3" style={{ margin: '1rem 0' }}>
            <Kpi titulo="Riesgo alto" valor={a.riesgo?.alto ?? 0} />
            <Kpi titulo="Riesgo medio" valor={a.riesgo?.medio ?? 0} />
            <Kpi titulo="Riesgo bajo" valor={a.riesgo?.bajo ?? 0} />
          </div>
          <div className="grilla-2">
            <div className="tarjeta">
              <h3>Evolución de asistencias</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={a.evolucionMensual}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dde3dc" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="asistencias" stroke="#123b29" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="tarjeta">
              <h3>Comparación entre sedes (asistencias por socio)</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={a.comparacionSedes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dde3dc" />
                    <XAxis dataKey="sede" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="asistenciasPorSocio" fill="#7b61ff" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="tarjeta" style={{ marginTop: '1rem' }}>
            <h3>Estimación orientativa del riesgo y recomendaciones</h3>
            {a.estimaciones?.length === 0 && <Vacio>Sin estimaciones para el período.</Vacio>}
            {a.estimaciones?.map((e) => (
              <div key={e.estimacionId} style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--borde)' }}>
                <div className="fila-entre">
                  <strong>{e.socio} <span className="tenue">· {e.sede}</span></strong>
                  <Estado valor={e.nivel} />
                </div>
                <small>{e.fundamento}</small>
                <div><strong>Recomendación:</strong> {e.recomendacion}</div>
                {e.ultimaDecision && <small>Última decisión: {e.ultimaDecision.decision === 'PREPARAR_PROPUESTA' ? 'propuesta preparada' : 'en observación'} · {e.ultimaDecision.motivo}</small>}
                <div className="fila">
                  <Boton variante="texto" chico onClick={() => verAnalisis(e)}>Ver análisis</Boton>
                  {puede('RETENCION', 'GESTION') && (
                    <>
                      <Boton variante="texto" chico onClick={() => setDecision({ estimacion: e, tipo: 'PREPARAR_PROPUESTA', motivo: e.recomendacion, incentivo: '7 días de Premium bonificado', mensaje: '¡Te esperamos! Tenés un beneficio para volver a entrenar.' })}>Preparar propuesta</Boton>
                      <Boton variante="texto" chico onClick={() => setDecision({ estimacion: e, tipo: 'MANTENER_EN_OBSERVACION', motivo: '', incentivo: '', mensaje: '' })}>Mantener en observación</Boton>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <Modal titulo={`Análisis: ${analisis?.datos.socio.nombre ?? ''}`} abierto={!!analisis} onCerrar={() => setAnalisis(null)}>
        {analisis && (
          <div className="pila">
            <small>{analisis.datos.socio.sede} · Plan {analisis.datos.socio.plan}</small>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={analisis.datos.semanas.map((s) => ({ ...s, semana: fecha(s.desde).slice(0, 5) }))}>
                  <XAxis dataKey="semana" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="asistencias" fill="#123b29" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p>{analisis.estimacion.fundamento}</p>
            {analisis.datos.senales.map((s) => <div key={s.id}><Estado valor={s.nivel} /> {s.tipo} · {fecha(s.detectadaEl)}</div>)}
          </div>
        )}
      </Modal>
      <Modal titulo={decision?.tipo === 'PREPARAR_PROPUESTA' ? 'Preparar propuesta' : 'Mantener en observación'} abierto={!!decision} onCerrar={() => setDecision(null)}>
        {decision && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            {decision.tipo === 'PREPARAR_PROPUESTA' && (
              <>
                <Campo etiqueta="Incentivo propuesto" value={decision.incentivo} onChange={(e) => setDecision({ ...decision, incentivo: e.target.value })} />
                <AreaTexto etiqueta="Mensaje" value={decision.mensaje} onChange={(e) => setDecision({ ...decision, mensaje: e.target.value })} />
              </>
            )}
            <Campo etiqueta="Motivo" value={decision.motivo} onChange={(e) => setDecision({ ...decision, motivo: e.target.value })} />
            <div className="fila">
              <Boton variante="secundario" onClick={() => setDecision(null)}>Volver al análisis</Boton>
              <Boton cargando={accion.enviando} onClick={guardarDecision}>{decision.tipo === 'PREPARAR_PROPUESTA' ? 'Guardar propuesta para revisión' : 'Guardar decisión'}</Boton>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
