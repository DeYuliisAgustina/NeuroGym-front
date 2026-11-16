import { useState } from 'react';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Modal, Selector, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede, Turno } from '../../types';
import { diaSemanaCorto, fecha, hoyIso, sumarDiasIso } from '../../utils/formato';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Horarios, actividades y cupos (RF16). Los cambios no alteran reservas existentes (RD23). */
export function TurnosAdmin() {
  const { puede } = useAuth();
  const gestion = puede('SEDES', 'GESTION');
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes'));
  const [filtros, setFiltros] = useState({ sedeId: '', desde: hoyIso(), hasta: sumarDiasIso(hoyIso(), 7) });
  const turnos = useApi(() => api.get<Turno[]>('/admin/turnos', filtros), [filtros.sedeId, filtros.desde, filtros.hasta]);
  const [serie, setSerie] = useState<null | { sedeId: string; actividad: string; horaInicio: string; horaFin: string; cupo: number; desde: string; hasta: string; diasSemana: number[] }>(null);
  const [editando, setEditando] = useState<Turno | null>(null);
  const [reservas, setReservas] = useState<{ turno: Turno; lista: { id: number; estado: string; socio: { usuario: { nombre: string; apellido: string } }; asistencia: unknown }[] } | null>(null);
  const accion = useAccion();

  const crearSerie = async () => {
    if (!serie!.sedeId || !serie!.actividad.trim() || serie!.diasSemana.length === 0) return accion.setError('Completá sede, actividad y días.');
    const r = await accion.ejecutar(() => api.post<{ creados: number }>('/admin/turnos/serie', { ...serie, sedeId: Number(serie!.sedeId) }));
    if (r) {
      accion.setExito(`Se crearon ${r.creados} turnos.`);
      setSerie(null);
      void turnos.recargar();
    }
  };
  const guardarEdicion = async () => {
    const { id, actividad, cupo, fecha: f, horaInicio, horaFin } = editando!;
    if (await accion.ejecutar(() => api.put(`/admin/turnos/${id}`, { actividad, cupo, fecha: f, horaInicio, horaFin }), 'Turno actualizado.')) {
      setEditando(null);
      void turnos.recargar();
    }
  };
  const habilitar = async (t: Turno) => {
    if (await accion.ejecutar(() => api.patch(`/admin/turnos/${t.id}/habilitacion`, { habilitado: !t.habilitado }), t.habilitado ? 'El turno dejó de admitir nuevas reservas.' : 'Turno habilitado.')) void turnos.recargar();
  };
  const verReservas = async (t: Turno) => {
    const lista = await accion.ejecutar(() => api.get<NonNullable<typeof reservas>['lista']>(`/admin/turnos/${t.id}/reservas`));
    if (lista) setReservas({ turno: t, lista });
  };

  return (
    <div>
      <EncabezadoPagina
        titulo="Horarios y cupos"
        acciones={gestion && <Boton onClick={() => setSerie({ sedeId: '', actividad: 'Musculación', horaInicio: '18:00', horaFin: '19:30', cupo: 30, desde: hoyIso(), hasta: sumarDiasIso(hoyIso(), 28), diasSemana: [1, 3, 5] })}>Programar turnos</Boton>}
      />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="tarjeta">
        <div className="grilla-3">
          <Selector etiqueta="Sede" vacio="Todas" value={filtros.sedeId} onChange={(e) => setFiltros({ ...filtros, sedeId: e.target.value })} opciones={(sedes.datos ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
          <Campo etiqueta="Desde" type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          <Campo etiqueta="Hasta" type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
        </div>
        {turnos.cargando && <Cargando />}
        {turnos.datos?.length === 0 && <Vacio>No hay turnos en el período.</Vacio>}
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Horario</th><th>Actividad</th><th>Sede</th><th>Reservas</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {turnos.datos?.map((t) => (
                <tr key={t.id}>
                  <td>{diaSemanaCorto(t.fecha)}</td>
                  <td>{t.horaInicio}–{t.horaFin}</td>
                  <td>{t.actividad}</td>
                  <td>{t.sede}</td>
                  <td>
                    <button className="btn btn-texto btn-chico" onClick={() => verReservas(t)}>{t.reservadas}/{t.cupo}</button>
                  </td>
                  <td>{t.habilitado ? <span className="etiqueta etiqueta-ok">Habilitado</span> : <span className="etiqueta">Sin nuevas reservas</span>}</td>
                  <td>
                    {gestion && (
                      <div className="fila">
                        <Boton variante="texto" chico onClick={() => setEditando(t)}>Editar</Boton>
                        <Boton variante="texto" chico onClick={() => habilitar(t)}>{t.habilitado ? 'Deshabilitar' : 'Habilitar'}</Boton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal titulo="Programar turnos" abierto={!!serie} onCerrar={() => setSerie(null)}>
        {serie && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            <Selector etiqueta="Sede" vacio="Elegí una sede" value={serie.sedeId} onChange={(e) => setSerie({ ...serie, sedeId: e.target.value })} opciones={(sedes.datos ?? []).filter((s) => s.habilitada).map((s) => ({ valor: s.id, texto: s.nombre }))} />
            <Campo etiqueta="Actividad" value={serie.actividad} onChange={(e) => setSerie({ ...serie, actividad: e.target.value })} />
            <div className="grilla-3">
              <Campo etiqueta="Inicio" type="time" value={serie.horaInicio} onChange={(e) => setSerie({ ...serie, horaInicio: e.target.value })} />
              <Campo etiqueta="Fin" type="time" value={serie.horaFin} onChange={(e) => setSerie({ ...serie, horaFin: e.target.value })} />
              <Campo etiqueta="Cupo" type="number" min={1} value={serie.cupo} onChange={(e) => setSerie({ ...serie, cupo: Number(e.target.value) })} />
              <Campo etiqueta="Desde" type="date" value={serie.desde} onChange={(e) => setSerie({ ...serie, desde: e.target.value })} />
              <Campo etiqueta="Hasta" type="date" value={serie.hasta} onChange={(e) => setSerie({ ...serie, hasta: e.target.value })} />
            </div>
            <div className="fila" style={{ marginBottom: '1rem' }}>
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  className={`dia-chip ${serie.diasSemana.includes(i + 1) ? 'activa' : ''}`}
                  onClick={() => setSerie({ ...serie, diasSemana: serie.diasSemana.includes(i + 1) ? serie.diasSemana.filter((x) => x !== i + 1) : [...serie.diasSemana, i + 1] })}
                >
                  {d}
                </button>
              ))}
            </div>
            <Boton bloque cargando={accion.enviando} onClick={crearSerie}>Crear turnos</Boton>
          </>
        )}
      </Modal>

      <Modal titulo="Modificar turno" abierto={!!editando} onCerrar={() => setEditando(null)}>
        {editando && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            {editando.reservadas > 0 && <Aviso tipo="info">El turno tiene {editando.reservadas} reservas: no se pueden cambiar la fecha ni el horario, y el cupo no puede ser menor.</Aviso>}
            <Campo etiqueta="Actividad" value={editando.actividad} onChange={(e) => setEditando({ ...editando, actividad: e.target.value })} />
            <div className="grilla-2">
              <Campo etiqueta="Fecha" type="date" disabled={editando.reservadas > 0} value={editando.fecha} onChange={(e) => setEditando({ ...editando, fecha: e.target.value })} />
              <Campo etiqueta="Cupo" type="number" min={Math.max(1, editando.reservadas)} value={editando.cupo} onChange={(e) => setEditando({ ...editando, cupo: Number(e.target.value) })} />
              <Campo etiqueta="Inicio" type="time" disabled={editando.reservadas > 0} value={editando.horaInicio} onChange={(e) => setEditando({ ...editando, horaInicio: e.target.value })} />
              <Campo etiqueta="Fin" type="time" disabled={editando.reservadas > 0} value={editando.horaFin} onChange={(e) => setEditando({ ...editando, horaFin: e.target.value })} />
            </div>
            <Boton bloque cargando={accion.enviando} onClick={guardarEdicion}>Guardar</Boton>
          </>
        )}
      </Modal>

      <Modal titulo={reservas ? `Reservas · ${reservas.turno.actividad} ${fecha(reservas.turno.fecha)} ${reservas.turno.horaInicio}` : ''} abierto={!!reservas} onCerrar={() => setReservas(null)}>
        {reservas?.lista.length === 0 && <Vacio>Sin reservas.</Vacio>}
        {reservas?.lista.map((r) => (
          <div key={r.id} className="fila-entre">
            <span>{r.socio.usuario.apellido}, {r.socio.usuario.nombre}</span>
            {r.asistencia ? <span className="etiqueta etiqueta-ok">Asistió</span> : <Estado valor={r.estado} />}
          </div>
        ))}
      </Modal>
    </div>
  );
}
