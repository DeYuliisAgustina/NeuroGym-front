import { useState } from 'react';
import { AreaTexto, Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Modal, Pestanas, Selector, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { EstadoEquipo, Sede } from '../../types';
import { etiqueta, fecha, hoyIso } from '../../utils/formato';

interface Equipo {
  id: number;
  nombre: string;
  categoria: string;
  estado: EstadoEquipo;
  fechaCompra: string | null;
  vidaUtilAnios: number | null;
  proximoService: string | null;
  fechaBaja: string | null;
  sede: { nombre: string };
  sedeId: number;
  ejercicios: { ejercicio: { id: number; nombre: string } }[];
  _count: { incidencias: number };
}
interface Incidencia {
  id: number;
  descripcion: string;
  estado: string;
  prioridad: string;
  fecha: string;
  equipoId: number;
  agrupadaEnId: number | null;
  equipo: { nombre: string; sede: { nombre: string } };
  reportante: { usuario: { nombre: string; apellido: string } };
  archivos: { id: number; url: string; tipo: string }[];
}
interface Mantenimiento {
  id: number;
  tipo: string;
  estado: string;
  inicioProgramado: string;
  finProgramado: string;
  intervencionPrevista: string | null;
  detalleRealizado: string | null;
  equipo: { nombre: string; sede: { nombre: string } };
}
interface Alerta {
  equipoId: number;
  equipo: string;
  sede: string;
  tipo: 'SERVICE' | 'RECAMBIO';
  fecha: string;
  vencida: boolean;
}

/** Equipamiento: inventario, disponibilidad, incidencias, mantenimientos y alertas (RF16, RF21–RF23, RD22). */
export function EquipamientoAdmin() {
  const { puede } = useAuth();
  const gestion = puede('EQUIPAMIENTO', 'GESTION');
  const [vista, setVista] = useState<'equipos' | 'incidencias' | 'mantenimientos' | 'alertas'>('equipos');
  const [sedeId, setSedeId] = useState('');
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const equipos = useApi(() => api.get<Equipo[]>('/admin/equipos', { sedeId, incluirBajas: 'true' }), [sedeId]);
  const incidencias = useApi(() => api.get<Incidencia[]>('/admin/incidencias', { sedeId }), [sedeId]);
  const mantenimientos = useApi(() => api.get<Mantenimiento[]>('/admin/mantenimientos', { sedeId }), [sedeId]);
  const alertas = useApi(() => api.get<Alerta[]>('/admin/equipos/alertas'));
  const [equipo, setEquipo] = useState<Partial<Equipo> & { sedeId?: number } | null>(null);
  const [baja, setBaja] = useState<Equipo | null>(null);
  const [programar, setProgramar] = useState<Equipo | null>(null);
  const [historial, setHistorial] = useState<{ equipo: Equipo; incidencias: Incidencia[]; mantenimientos: Mantenimiento[] } | null>(null);
  const [realizado, setRealizado] = useState<Mantenimiento | null>(null);
  const [texto, setTexto] = useState({ motivo: '', fechaBaja: hoyIso(), tipo: 'PREVENTIVO', inicio: '', fin: '', intervencion: '', detalle: '', proximoService: '' });
  const accion = useAccion();
  const recargarTodo = () => Promise.all([equipos.recargar(), incidencias.recargar(), mantenimientos.recargar(), alertas.recargar()]);

  const guardarEquipo = async () => {
    const e = equipo!;
    if (!e.nombre?.trim() || !e.categoria?.trim() || !e.sedeId) return accion.setError('Completá sede, nombre y categoría.');
    const datos = { nombre: e.nombre, categoria: e.categoria, fechaCompra: e.fechaCompra || null, vidaUtilAnios: e.vidaUtilAnios ? Number(e.vidaUtilAnios) : null, proximoService: e.proximoService || null };
    const ok = await accion.ejecutar(() => (e.id ? api.put(`/admin/equipos/${e.id}`, datos) : api.post('/admin/equipos', { ...datos, sedeId: Number(e.sedeId) })), 'Equipo guardado.');
    if (ok) {
      setEquipo(null);
      void equipos.recargar();
    }
  };
  const disponibilidad = async (e: Equipo, estado: EstadoEquipo) => {
    if (await accion.ejecutar(() => api.patch(`/admin/equipos/${e.id}/disponibilidad`, { estado }), 'Disponibilidad actualizada.')) void equipos.recargar();
  };
  const confirmarBaja = async () => {
    if (!texto.motivo.trim()) return accion.setError('Indicá el motivo de la baja.');
    if (await accion.ejecutar(() => api.patch(`/admin/equipos/${baja!.id}/baja`, { motivo: texto.motivo, fechaBaja: texto.fechaBaja }), 'Equipo dado de baja del inventario.')) {
      setBaja(null);
      void equipos.recargar();
    }
  };
  const confirmarProgramacion = async () => {
    if (!texto.inicio || !texto.fin) return accion.setError('Indicá el inicio y el fin.');
    const r = await accion.ejecutar(() =>
      api.post<{ sociosAvisados: number }>('/admin/mantenimientos', {
        equipoId: programar!.id,
        tipo: texto.tipo,
        inicioProgramado: new Date(texto.inicio).toISOString(),
        finProgramado: new Date(texto.fin).toISOString(),
        intervencionPrevista: texto.intervencion || undefined,
      }),
    );
    if (r) {
      accion.setExito(`Mantenimiento programado. Se avisó a ${r.sociosAvisados} socio(s) con turnos afectados.`);
      setProgramar(null);
      void recargarTodo();
    }
  };
  const confirmarRealizado = async () => {
    if (!texto.detalle.trim()) return accion.setError('Describí la intervención realizada.');
    if (await accion.ejecutar(() => api.patch(`/admin/mantenimientos/${realizado!.id}/realizado`, { detalleRealizado: texto.detalle, proximoService: texto.proximoService || undefined }), 'Mantenimiento registrado.')) {
      setRealizado(null);
      void recargarTodo();
    }
  };
  const gestionarIncidencia = async (i: Incidencia, datos: { estado?: string; prioridad?: string }) => {
    if (await accion.ejecutar(() => api.patch(`/admin/incidencias/${i.id}`, datos), 'Incidencia actualizada.')) void incidencias.recargar();
  };
  const agrupar = async (i: Incidencia, principalId: string) => {
    if (!principalId) return;
    if (await accion.ejecutar(() => api.patch(`/admin/incidencias/${i.id}/agrupacion`, { principalId: Number(principalId) }), 'Incidencias agrupadas.')) void incidencias.recargar();
  };
  const verHistorial = async (e: Equipo) => {
    const h = await accion.ejecutar(() => api.get<NonNullable<typeof historial>>(`/admin/equipos/${e.id}/historial`));
    if (h) setHistorial(h);
  };

  return (
    <div>
      <EncabezadoPagina titulo="Equipamiento" acciones={gestion && <Boton onClick={() => setEquipo({ nombre: '', categoria: '', sedeId: Number(sedeId) || undefined })}>Nuevo equipo</Boton>} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <Selector etiqueta="Sede" vacio="Todas las sedes" value={sedeId} onChange={(e) => setSedeId(e.target.value)} opciones={(sedes.datos ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
      <Pestanas
        valor={vista}
        onCambiar={setVista}
        opciones={[
          { valor: 'equipos', texto: 'Inventario' },
          { valor: 'incidencias', texto: `Incidencias (${incidencias.datos?.filter((i) => i.estado !== 'RESUELTA').length ?? 0})` },
          { valor: 'mantenimientos', texto: 'Mantenimientos' },
          { valor: 'alertas', texto: `Alertas (${alertas.datos?.length ?? 0})` },
        ]}
      />
      {vista === 'equipos' && (
        <div className="tarjeta tabla-scroll">
          {equipos.cargando && <Cargando />}
          <table>
            <thead><tr><th>Equipo</th><th>Sede</th><th>Estado</th><th>Próximo service</th><th /></tr></thead>
            <tbody>
              {equipos.datos?.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button className="btn btn-texto btn-chico" onClick={() => verHistorial(e)}>{e.nombre}</button>
                    <div className="tenue" style={{ fontSize: '0.8rem' }}>{e.categoria} · {e._count.incidencias} incidencias abiertas</div>
                  </td>
                  <td>{e.sede.nombre}</td>
                  <td><Estado valor={e.estado} />{e.fechaBaja && <div className="tenue" style={{ fontSize: '0.8rem' }}>Baja {fecha(e.fechaBaja)}</div>}</td>
                  <td>{fecha(e.proximoService)}</td>
                  <td>
                    {gestion && e.estado !== 'DADO_DE_BAJA' && (
                      <div className="fila">
                        <select aria-label="Disponibilidad" value={e.estado} onChange={(ev) => disponibilidad(e, ev.target.value as EstadoEquipo)}>
                          {['OPERATIVO', 'FUERA_DE_SERVICIO', 'SERVICE_PROGRAMADO'].map((x) => <option key={x} value={x}>{etiqueta(x)}</option>)}
                        </select>
                        <Boton variante="texto" chico onClick={() => setEquipo(e)}>Editar</Boton>
                        <Boton variante="texto" chico onClick={() => { setProgramar(e); setTexto({ ...texto, inicio: '', fin: '', intervencion: '' }); }}>Mantenimiento</Boton>
                        <Boton variante="texto" chico onClick={() => { setBaja(e); setTexto({ ...texto, motivo: '', fechaBaja: hoyIso() }); }}>Dar de baja</Boton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vista === 'incidencias' && (
        <div className="pila">
          {incidencias.datos?.length === 0 && <Vacio>No hay incidencias.</Vacio>}
          {incidencias.datos?.map((i) => (
            <div key={i.id} className="tarjeta">
              <div className="fila-entre">
                <strong>#{i.id} · {i.equipo.nombre} <span className="tenue">({i.equipo.sede.nombre})</span></strong>
                <span className="fila"><Estado valor={i.estado} /><span className="etiqueta">{etiqueta(i.prioridad)}</span></span>
              </div>
              <p>{i.descripcion}</p>
              <small>{i.reportante.usuario.nombre} {i.reportante.usuario.apellido} · {fecha(i.fecha, true)}{i.agrupadaEnId ? ` · agrupada en #${i.agrupadaEnId}` : ''}</small>
              <div className="fila">
                {i.archivos.map((a) => (a.tipo === 'FOTO' ? <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="Adjunto" style={{ width: 80, borderRadius: 8 }} /></a> : <a key={a.id} href={a.url} target="_blank" rel="noreferrer">Video</a>))}
              </div>
              {gestion && (
                <div className="grilla-3" style={{ marginTop: '0.5rem' }}>
                  <Selector etiqueta="Estado" value={i.estado} onChange={(e) => gestionarIncidencia(i, { estado: e.target.value })} opciones={['REPORTADA', 'EN_GESTION', 'RESUELTA'].map((x) => ({ valor: x, texto: etiqueta(x) }))} />
                  <Selector etiqueta="Prioridad" value={i.prioridad} onChange={(e) => gestionarIncidencia(i, { prioridad: e.target.value })} opciones={['BAJA', 'MEDIA', 'ALTA'].map((x) => ({ valor: x, texto: etiqueta(x) }))} />
                  {!i.agrupadaEnId && (
                    <Selector
                      etiqueta="Agrupar con"
                      vacio="—"
                      value=""
                      onChange={(e) => agrupar(i, e.target.value)}
                      opciones={(incidencias.datos ?? []).filter((o) => o.id !== i.id && o.equipoId === i.equipoId && !o.agrupadaEnId).map((o) => ({ valor: o.id, texto: `#${o.id}` }))}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {vista === 'mantenimientos' && (
        <div className="tarjeta tabla-scroll">
          <table>
            <thead><tr><th>Equipo</th><th>Tipo</th><th>Período</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {mantenimientos.datos?.map((m) => (
                <tr key={m.id}>
                  <td>{m.equipo.nombre}<div className="tenue" style={{ fontSize: '0.8rem' }}>{m.intervencionPrevista ?? m.detalleRealizado}</div></td>
                  <td>{etiqueta(m.tipo)}</td>
                  <td>{fecha(m.inicioProgramado, true)} – {fecha(m.finProgramado, true)}</td>
                  <td><Estado valor={m.estado} /></td>
                  <td>{gestion && m.estado === 'PROGRAMADO' && <Boton chico onClick={() => { setRealizado(m); setTexto({ ...texto, detalle: '', proximoService: '' }); }}>Registrar realizado</Boton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vista === 'alertas' && (
        <div className="tarjeta">
          {alertas.datos?.length === 0 && <Vacio>No hay services ni recambios próximos.</Vacio>}
          {alertas.datos?.map((a) => (
            <div key={`${a.equipoId}-${a.tipo}`} className="fila-entre" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--borde)' }}>
              <span><strong>{a.equipo}</strong> · {a.sede}</span>
              <span className={`etiqueta ${a.vencida ? 'etiqueta-mal' : 'etiqueta-alerta'}`}>{a.tipo === 'SERVICE' ? 'Service' : 'Revisión o recambio'} {a.vencida ? 'vencido' : ''} · {fecha(a.fecha)}</span>
            </div>
          ))}
        </div>
      )}

      <Modal titulo={equipo?.id ? 'Modificar equipo' : 'Nuevo equipo'} abierto={!!equipo} onCerrar={() => setEquipo(null)}>
        {equipo && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            {!equipo.id && <Selector etiqueta="Sede" vacio="Elegí la sede" value={equipo.sedeId ?? ''} onChange={(e) => setEquipo({ ...equipo, sedeId: Number(e.target.value) })} opciones={(sedes.datos ?? []).filter((s) => s.habilitada).map((s) => ({ valor: s.id, texto: s.nombre }))} />}
            <Campo etiqueta="Nombre" value={equipo.nombre ?? ''} onChange={(e) => setEquipo({ ...equipo, nombre: e.target.value })} />
            <Campo etiqueta="Categoría" value={equipo.categoria ?? ''} onChange={(e) => setEquipo({ ...equipo, categoria: e.target.value })} />
            <div className="grilla-3">
              <Campo etiqueta="Fecha de compra" type="date" value={equipo.fechaCompra?.slice(0, 10) ?? ''} onChange={(e) => setEquipo({ ...equipo, fechaCompra: e.target.value })} />
              <Campo etiqueta="Vida útil (años)" type="number" min={1} value={equipo.vidaUtilAnios ?? ''} onChange={(e) => setEquipo({ ...equipo, vidaUtilAnios: Number(e.target.value) || null })} />
              <Campo etiqueta="Próximo service" type="date" value={equipo.proximoService?.slice(0, 10) ?? ''} onChange={(e) => setEquipo({ ...equipo, proximoService: e.target.value })} />
            </div>
            <Boton bloque cargando={accion.enviando} onClick={guardarEquipo}>Guardar</Boton>
          </>
        )}
      </Modal>
      <Modal titulo={`Dar de baja: ${baja?.nombre ?? ''}`} abierto={!!baja} onCerrar={() => setBaja(null)}>
        <Aviso tipo="alerta">La baja del inventario es definitiva. Se conservan sus incidencias y mantenimientos. Para una indisponibilidad temporal usá “Fuera de servicio”.</Aviso>
        <Aviso tipo="error">{accion.error}</Aviso>
        <Campo etiqueta="Fecha de baja" type="date" value={texto.fechaBaja} onChange={(e) => setTexto({ ...texto, fechaBaja: e.target.value })} />
        <Campo etiqueta="Motivo" value={texto.motivo} onChange={(e) => setTexto({ ...texto, motivo: e.target.value })} />
        <Boton variante="peligro" bloque cargando={accion.enviando} onClick={confirmarBaja}>Dar de baja definitivamente</Boton>
      </Modal>
      <Modal titulo={`Programar mantenimiento: ${programar?.nombre ?? ''}`} abierto={!!programar} onCerrar={() => setProgramar(null)}>
        <Aviso tipo="error">{accion.error}</Aviso>
        <Selector etiqueta="Tipo" value={texto.tipo} onChange={(e) => setTexto({ ...texto, tipo: e.target.value })} opciones={[{ valor: 'PREVENTIVO', texto: 'Preventivo' }, { valor: 'CORRECTIVO', texto: 'Correctivo' }]} />
        <div className="grilla-2">
          <Campo etiqueta="Inicio" type="datetime-local" value={texto.inicio} onChange={(e) => setTexto({ ...texto, inicio: e.target.value })} />
          <Campo etiqueta="Fin" type="datetime-local" value={texto.fin} onChange={(e) => setTexto({ ...texto, fin: e.target.value })} />
        </div>
        <AreaTexto etiqueta="Intervención prevista" value={texto.intervencion} onChange={(e) => setTexto({ ...texto, intervencion: e.target.value })} />
        <small>Se avisará a los socios con turnos reservados en ese período cuya rutina use este equipo.</small>
        <Boton bloque cargando={accion.enviando} onClick={confirmarProgramacion}>Programar</Boton>
      </Modal>
      <Modal titulo="Registrar mantenimiento realizado" abierto={!!realizado} onCerrar={() => setRealizado(null)}>
        <Aviso tipo="error">{accion.error}</Aviso>
        <AreaTexto etiqueta="Detalle de la intervención" value={texto.detalle} onChange={(e) => setTexto({ ...texto, detalle: e.target.value })} />
        <Campo etiqueta="Próximo service (opcional)" type="date" value={texto.proximoService} onChange={(e) => setTexto({ ...texto, proximoService: e.target.value })} />
        <Boton bloque cargando={accion.enviando} onClick={confirmarRealizado}>Guardar</Boton>
      </Modal>
      <Modal titulo={`Historial: ${historial?.equipo.nombre ?? ''}`} abierto={!!historial} onCerrar={() => setHistorial(null)}>
        {historial && (
          <div className="pila">
            <small>Ejercicios asociados: {historial.equipo.ejercicios?.map((x) => x.ejercicio.nombre).join(', ') || '—'}</small>
            <h3>Incidencias</h3>
            {historial.incidencias.length === 0 && <small>Sin incidencias.</small>}
            {historial.incidencias.map((i) => <div key={i.id}><Estado valor={i.estado} /> {fecha(i.fecha)} · {i.descripcion}</div>)}
            <h3>Mantenimientos</h3>
            {historial.mantenimientos.length === 0 && <small>Sin mantenimientos.</small>}
            {historial.mantenimientos.map((m) => <div key={m.id}><Estado valor={m.estado} /> {etiqueta(m.tipo)} · {fecha(m.inicioProgramado)} · {m.detalleRealizado ?? m.intervencionPrevista ?? ''}</div>)}
          </div>
        )}
      </Modal>
    </div>
  );
}
