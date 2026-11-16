import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaTexto, Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Kpi, Modal, Pestanas, Selector, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { etiqueta, fecha } from '../../utils/formato';

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
  periodo: { desde: string; hasta: string };
  ultimaEjecucionEtl: string | null;
  intelligenceDisponible: boolean;
  indicadores: { sedeId: number; sede: string; asistencias: number }[];
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

const INCENTIVOS = ['7 días de Premium bonificado', 'Clase de prueba para un invitado', 'Evaluación con entrenador', 'Puntos extra de constancia'];

/** Constancia y regreso (CU-002): indicadores, señales, incentivos con aprobación y beneficios. */
export function Retencion() {
  const { puede } = useAuth();
  const gestion = puede('RETENCION', 'GESTION');
  const [vista, setVista] = useState<'senales' | 'todos' | 'propuestas' | 'beneficios'>('senales');
  const [filtros, setFiltros] = useState({ sedeId: '', plan: '', estadoCuota: '', nivel: '', busqueda: '' });
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const tablero = useApi(() => api.get<Dashboard>('/admin/retencion/dashboard', filtros), [filtros.sedeId, filtros.plan, filtros.estadoCuota, filtros.nivel, filtros.busqueda]);
  const propuestas = useApi(() => api.get<Propuesta[]>('/admin/retencion/propuestas'));
  const beneficios = useApi(() => api.get<Beneficio[]>('/admin/beneficios'));
  const [propuesta, setPropuesta] = useState<{ socio: SocioFila; incentivo: string; mensaje: string; premium: boolean; dias: number; porcentaje: number } | null>(null);
  const [beneficio, setBeneficio] = useState<Partial<Beneficio> | null>(null);
  const accion = useAccion();
  const hayFiltros = Object.values(filtros).some(Boolean);

  const guardarPropuesta = async () => {
    const p = propuesta!;
    if (!p.mensaje.trim()) return accion.setError('El mensaje es obligatorio.');
    const ok = await accion.ejecutar(
      () =>
        api.post('/admin/retencion/propuestas', {
          socioId: p.socio.socioId,
          senalId: p.socio.senal?.id,
          incentivo: p.incentivo,
          mensaje: p.mensaje,
          ...(p.premium ? { premiumDias: p.dias, premiumPorcentaje: p.porcentaje } : {}),
        }),
      'Propuesta guardada para revisión. No se comunicó al socio.',
    );
    if (ok) {
      setPropuesta(null);
      void propuestas.recargar();
    }
  };
  const aprobar = async (p: Propuesta) => {
    if (!window.confirm(`¿Aprobar "${p.incentivo}" y comunicarlo al socio?`)) return;
    if (await accion.ejecutar(() => api.patch(`/admin/retencion/propuestas/${p.id}/aprobacion`), 'El incentivo fue aprobado y comunicado al socio.')) void propuestas.recargar();
  };
  const posponer = async (p: Propuesta) => {
    if (await accion.ejecutar(() => api.patch(`/admin/retencion/propuestas/${p.id}/pendiente`), 'La propuesta quedó pendiente.')) void propuestas.recargar();
  };
  const guardarBeneficio = async () => {
    const b = beneficio!;
    if (!b.nombre?.trim() || !b.descripcion?.trim() || !b.costoPuntos || !b.vigenciaDias) return accion.setError('Completá todos los campos.');
    const datos = { nombre: b.nombre, descripcion: b.descripcion, costoPuntos: Number(b.costoPuntos), vigenciaDias: Number(b.vigenciaDias), disponible: b.disponible ?? true };
    if (await accion.ejecutar(() => (b.id ? api.put(`/admin/beneficios/${b.id}`, datos) : api.post('/admin/beneficios', datos)), 'Beneficio guardado.')) {
      setBeneficio(null);
      void beneficios.recargar();
    }
  };
  const ejecutarEtl = async () => {
    if (await accion.ejecutar(() => api.post('/admin/retencion/etl'), 'Indicadores y señales actualizados.')) void tablero.recargar();
  };

  const t = tablero.datos;
  const listado = vista === 'senales' ? t?.socios.filter((s) => s.senal) : t?.socios;

  return (
    <div>
      <EncabezadoPagina
        titulo="Constancia y regreso"
        descripcion={t ? `Período ${fecha(t.periodo.desde)} – ${fecha(t.periodo.hasta)} · última actualización ${fecha(t.ultimaEjecucionEtl, true)}` : undefined}
        acciones={
          <>
            {gestion && <Boton variante="secundario" onClick={ejecutarEtl}>Actualizar indicadores</Boton>}
            {t?.intelligenceDisponible && puede('INTELLIGENCE') && <Link className="btn btn-acento" to="/admin/intelligence">NeuroGym Intelligence</Link>}
          </>
        }
      />
      <Aviso tipo="error">{accion.error ?? tablero.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      {t && !t.intelligenceDisponible && <Aviso tipo="info">La analítica avanzada está disponible con NeuroGym Intelligence.</Aviso>}
      {t && (
        <div className="grilla-4" style={{ marginBottom: '1rem' }}>
          <Kpi titulo="Socios activos" valor={t.resumen.sociosActivos} />
          <Kpi titulo="Con señales de posible abandono" valor={t.resumen.conSenal} />
          <Kpi titulo="Sin asistencia en el período" valor={t.resumen.sinAsistenciaEnPeriodo} />
          <Kpi titulo="Asistencias confirmadas" valor={t.indicadores.reduce((s, i) => s + i.asistencias, 0)} detalle={t.indicadores.map((i) => `${i.sede}: ${i.asistencias}`).join(' · ')} />
        </div>
      )}
      <Pestanas
        valor={vista}
        onCambiar={setVista}
        opciones={[
          { valor: 'senales', texto: 'Señales de inactividad' },
          { valor: 'todos', texto: 'Constancia y beneficios' },
          { valor: 'propuestas', texto: `Propuestas de incentivo (${propuestas.datos?.filter((p) => p.estado !== 'APROBADA').length ?? 0})` },
          { valor: 'beneficios', texto: 'Beneficios' },
        ]}
      />
      {(vista === 'senales' || vista === 'todos') && (
        <div className="tarjeta">
          <div className="grilla-4">
            <Campo etiqueta="Buscar" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
            <Selector etiqueta="Sede" vacio="Todas" value={filtros.sedeId} onChange={(e) => setFiltros({ ...filtros, sedeId: e.target.value })} opciones={(sedes.datos ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
            <Selector etiqueta="Plan" vacio="Todos" value={filtros.plan} onChange={(e) => setFiltros({ ...filtros, plan: e.target.value })} opciones={[{ valor: 'BASICO', texto: 'Básico' }, { valor: 'PREMIUM', texto: 'Premium' }]} />
            <Selector etiqueta="Nivel de señal" vacio="Todos" value={filtros.nivel} onChange={(e) => setFiltros({ ...filtros, nivel: e.target.value })} opciones={['ALTO', 'MEDIO', 'BAJO'].map((n) => ({ valor: n, texto: etiqueta(n) }))} />
          </div>
          {hayFiltros && <Boton variante="texto" chico onClick={() => setFiltros({ sedeId: '', plan: '', estadoCuota: '', nivel: '', busqueda: '' })}>Limpiar filtros</Boton>}
          {tablero.cargando && <Cargando />}
          {listado?.length === 0 && <Vacio>{vista === 'senales' ? 'No hay socios con señales de posible abandono.' : 'No encontramos socios.'}</Vacio>}
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Socio</th><th>Plan</th><th>Asistencias</th><th>Última visita</th><th>{vista === 'senales' ? 'Señal' : 'Puntos'}</th><th /></tr></thead>
              <tbody>
                {listado?.map((s) => (
                  <tr key={s.socioId}>
                    <td>{s.nombre}<div className="tenue" style={{ fontSize: '0.8rem' }}>{s.sede}</div></td>
                    <td>{etiqueta(s.plan)}</td>
                    <td>{s.asistenciasPeriodo}</td>
                    <td>{fecha(s.ultimaVisita)}</td>
                    <td>
                      {vista === 'senales' && s.senal ? (
                        <>
                          <Estado valor={s.senal.nivel} /> {s.senal.tipo}
                          <div className="tenue" style={{ fontSize: '0.8rem' }}>{s.senal.detalle}</div>
                        </>
                      ) : (
                        s.saldoPuntos
                      )}
                    </td>
                    <td>
                      {gestion && (
                        <div className="fila">
                          {s.senal && <Boton chico onClick={() => setPropuesta({ socio: s, incentivo: INCENTIVOS[0], mensaje: `¡Te extrañamos, ${s.nombre.split(', ')[1] ?? ''}! Volvé a entrenar con un beneficio especial.`, premium: true, dias: 7, porcentaje: 100 })}>Crear incentivo</Boton>}
                          {!s.senal && <Boton variante="texto" chico onClick={() => setPropuesta({ socio: s, incentivo: '7 días de Premium bonificado', mensaje: 'Reconocemos tu constancia con 7 días de Premium.', premium: true, dias: 7, porcentaje: 100 })}>Bonificar Premium</Boton>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!gestion && <small>Tu rol solo tiene permiso de consulta: no podés registrar propuestas ni aprobaciones.</small>}
        </div>
      )}
      {vista === 'propuestas' && (
        <div className="pila">
          {propuestas.datos?.length === 0 && <Vacio>No hay propuestas registradas.</Vacio>}
          {propuestas.datos?.map((p) => (
            <div key={p.id} className="tarjeta">
              <div className="fila-entre">
                <strong>{p.socio.usuario.apellido}, {p.socio.usuario.nombre} · {p.incentivo}</strong>
                <Estado valor={p.estado} />
              </div>
              <p>{p.mensaje}</p>
              <small>
                {p.premiumDias ? `Premium ${Number(p.premiumPorcentaje)} % durante ${p.premiumDias} días · ` : ''}
                {p.responsable.usuario.nombre} {p.responsable.usuario.apellido} · {fecha(p.fechaCreacion, true)}
              </small>
              {gestion && p.estado !== 'APROBADA' && (
                <div className="fila">
                  <Boton chico onClick={() => aprobar(p)}>Aprobar y comunicar</Boton>
                  {p.estado === 'PREPARADA' && <Boton variante="secundario" chico onClick={() => posponer(p)}>No aprobar por ahora</Boton>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {vista === 'beneficios' && (
        <div className="pila">
          {gestion && <Boton onClick={() => setBeneficio({ disponible: true })}>Nuevo beneficio</Boton>}
          <div className="grilla-3">
            {beneficios.datos?.map((b) => (
              <div key={b.id} className="tarjeta pila">
                <div className="fila-entre"><h3>{b.nombre}</h3>{!b.disponible && <span className="etiqueta">No disponible</span>}</div>
                <small>{b.descripcion}</small>
                <small>{b.costoPuntos} puntos · {b.vigenciaDias} días · {b._count.canjes} canjes</small>
                {gestion && <Boton variante="secundario" chico onClick={() => setBeneficio(b)}>Editar</Boton>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal titulo={`Incentivo para ${propuesta?.socio.nombre ?? ''}`} abierto={!!propuesta} onCerrar={() => setPropuesta(null)}>
        {propuesta && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            {propuesta.socio.senal && <Aviso tipo="info">{propuesta.socio.senal.tipo}: {propuesta.socio.senal.detalle}</Aviso>}
            <Selector etiqueta="Incentivo" value={propuesta.incentivo} onChange={(e) => setPropuesta({ ...propuesta, incentivo: e.target.value, premium: e.target.value.includes('Premium') })} opciones={INCENTIVOS.map((i) => ({ valor: i, texto: i }))} />
            {propuesta.premium && (
              <div className="grilla-2">
                <Campo etiqueta="Días de Premium" type="number" min={1} max={90} value={propuesta.dias} onChange={(e) => setPropuesta({ ...propuesta, dias: Number(e.target.value) })} />
                <Campo etiqueta="Bonificación (%)" type="number" min={1} max={100} value={propuesta.porcentaje} onChange={(e) => setPropuesta({ ...propuesta, porcentaje: Number(e.target.value) })} ayuda="100 % = gratuito" />
              </div>
            )}
            <AreaTexto etiqueta="Mensaje para el socio" value={propuesta.mensaje} onChange={(e) => setPropuesta({ ...propuesta, mensaje: e.target.value })} />
            <small>La propuesta no se comunica hasta que se apruebe.</small>
            <div className="fila" style={{ marginTop: '0.8rem' }}>
              <Boton variante="secundario" onClick={() => setPropuesta(null)}>Cancelar</Boton>
              <Boton cargando={accion.enviando} onClick={guardarPropuesta}>Guardar propuesta</Boton>
            </div>
          </>
        )}
      </Modal>
      <Modal titulo={beneficio?.id ? 'Modificar beneficio' : 'Nuevo beneficio'} abierto={!!beneficio} onCerrar={() => setBeneficio(null)}>
        {beneficio && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            <Campo etiqueta="Nombre" value={beneficio.nombre ?? ''} onChange={(e) => setBeneficio({ ...beneficio, nombre: e.target.value })} />
            <Campo etiqueta="Condiciones" value={beneficio.descripcion ?? ''} onChange={(e) => setBeneficio({ ...beneficio, descripcion: e.target.value })} />
            <div className="grilla-2">
              <Campo etiqueta="Costo en puntos" type="number" min={1} value={beneficio.costoPuntos ?? ''} onChange={(e) => setBeneficio({ ...beneficio, costoPuntos: Number(e.target.value) })} />
              <Campo etiqueta="Vigencia (días)" type="number" min={1} value={beneficio.vigenciaDias ?? ''} onChange={(e) => setBeneficio({ ...beneficio, vigenciaDias: Number(e.target.value) })} />
            </div>
            <label className="check"><input type="checkbox" checked={beneficio.disponible ?? true} onChange={(e) => setBeneficio({ ...beneficio, disponible: e.target.checked })} /> Disponible para canje</label>
            <Boton bloque cargando={accion.enviando} onClick={guardarBeneficio} style={{ marginTop: '0.8rem' }}>Guardar</Boton>
          </>
        )}
      </Modal>
    </div>
  );
}
