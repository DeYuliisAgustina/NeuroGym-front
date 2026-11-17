import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, Insignia, Modal, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede, Turno } from '../../types';
import { hoyIso, sumarDiasIso, conSede } from '../../utils/formato';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Lunes de la semana de una fecha ISO. */
function lunesDe(fechaIso: string) {
  const d = new Date(`${fechaIso}T12:00:00Z`).getUTCDay();
  return sumarDiasIso(fechaIso, d === 0 ? -6 : 1 - d);
}
const rango = (lunes: string) => {
  const fin = sumarDiasIso(lunes, 5);
  const f = (x: string, opciones: Intl.DateTimeFormatOptions) => new Date(`${x}T12:00:00`).toLocaleDateString('es-AR', opciones);
  return `${f(lunes, { day: 'numeric' })} al ${f(fin, { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')}`;
};
const diaCorto = (x: string) => {
  const t = new Date(`${x}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Sedes del gimnasio (RF16, Figura 64): alta, edición, habilitación y horarios y cupos de cada sede. */
export function Sedes() {
  const [parametros, setParametros] = useSearchParams();
  const sedeElegida = parametros.get('sede');
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes'));
  const sede = sedes.datos?.find((s) => String(s.id) === sedeElegida);
  if (sedeElegida && sede) return <HorariosSede sede={sede} alVolver={() => setParametros({})} />;
  return <ListaSedes sedes={sedes.datos} recargar={sedes.recargar} verHorarios={(id) => setParametros({ sede: String(id) })} />;
}

function ListaSedes({ sedes, recargar, verHorarios }: { sedes: Sede[] | null; recargar: () => void; verHorarios: (id: number) => void }) {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('SEDES', 'GESTION');
  const [editando, setEditando] = useState<Partial<Sede> | null>(null);
  const accion = useAccion();

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    const datos = { nombre: editando.nombre ?? '', direccion: editando.direccion ?? '', horarios: editando.horarios ?? '' };
    if (!datos.nombre.trim() || !datos.direccion.trim() || !datos.horarios.trim()) return accion.setError('Completá el nombre, la dirección y el horario de atención.');
    const ok = await accion.ejecutar(() => (editando.id ? api.put(`/admin/sedes/${editando.id}`, datos) : api.post('/admin/sedes', datos)));
    if (ok) {
      toast(editando.id ? 'Sede actualizada.' : 'Sede agregada.');
      setEditando(null);
      recargar();
    }
  };
  const habilitar = async () => {
    if (!editando?.id) return;
    const habilitada = !editando.habilitada;
    if (await accion.ejecutar(() => api.patch(`/admin/sedes/${editando.id}/habilitacion`, { habilitada }))) {
      toast(habilitada ? 'Sede habilitada.' : 'Sede deshabilitada: no admite nuevos socios ni reservas.');
      setEditando(null);
      recargar();
    }
  };

  return (
    <>
      <Encabezado
        ceja="GESTIÓN MULTISEDE"
        titulo="Sedes del gimnasio"
        subtitulo="Cada sede pertenece a la misma suscripción SaaS por empresa."
        accion={
          gestion && (
            <Boton
              icono="plus"
              onClick={() => {
                accion.limpiar();
                setEditando({ nombre: '', direccion: '', horarios: 'Lunes a sábado · 07:00 a 21:00' });
              }}
            >
              Agregar sede
            </Boton>
          )
        }
      />
      <div className="three-col">
        {sedes?.map((s) => (
          <article key={s.id} className="card branch-card">
            <div className="feature-icon">
              <Icono n="building" />
            </div>
            <Insignia color={s.habilitada ? '' : 'neutral'}>{s.habilitada ? 'Habilitada' : 'Deshabilitada'}</Insignia>
            <h2>{s.nombre}</h2>
            <p>{s.direccion}</p>
            <p>{s.horarios}</p>
            {s._count && (
              <p>
                {s._count.socios} socios · {s._count.equipos} equipos
              </p>
            )}
            <div className="flex">
              <Boton estilo="outline" chico icono="calendar" onClick={() => verHorarios(s.id)}>
                Horarios y cupos
              </Boton>
              {gestion && (
                <Boton
                  estilo="outline"
                  chico
                  icono="edit"
                  onClick={() => {
                    accion.limpiar();
                    setEditando(s);
                  }}
                >
                  Editar sede
                </Boton>
              )}
            </div>
          </article>
        ))}
      </div>
      {sedes?.length === 0 && <Vacio titulo="Todavía no hay sedes" descripcion="Agregá la primera sede del gimnasio." icono="building" />}
      <p className="page-note">La cantidad de sedes habilitadas está limitada por la suscripción del gimnasio. Deshabilitar una sede conserva su historial.</p>

      <Modal titulo={editando?.id ? 'Editar sede' : 'Agregar sede'} subtitulo="Datos visibles para socios y personal." abierto={!!editando} onCerrar={() => setEditando(null)}>
        {editando && (
          <form onSubmit={guardar}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            <div className="form-grid">
              <label className="wide">
                Nombre de la sede
                <input required maxLength={100} value={editando.nombre ?? ''} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
              </label>
              <label className="wide">
                Dirección
                <input required maxLength={200} value={editando.direccion ?? ''} onChange={(e) => setEditando({ ...editando, direccion: e.target.value })} />
              </label>
              <label className="wide">
                Horario de atención
                <input required maxLength={200} value={editando.horarios ?? ''} onChange={(e) => setEditando({ ...editando, horarios: e.target.value })} />
              </label>
            </div>
            {editando.id && (
              <p className="page-note">{editando.habilitada ? 'Al deshabilitarla deja de admitir nuevos socios y reservas; los datos se conservan.' : 'La sede está deshabilitada. Podés volver a habilitarla.'}</p>
            )}
            <div className="form-actions split">
              {editando.id ? (
                <Boton estilo={editando.habilitada ? 'danger' : 'soft'} cargando={accion.enviando} onClick={habilitar}>
                  {editando.habilitada ? 'Deshabilitar sede' : 'Habilitar sede'}
                </Boton>
              ) : (
                <span />
              )}
              <div>
                <Boton estilo="outline" onClick={() => setEditando(null)}>
                  Cancelar
                </Boton>
                <button type="submit" className="btn primary" disabled={accion.enviando}>
                  Guardar sede
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

type FormTurno = { id?: number; actividad: string; fecha: string; horaInicio: string; horaFin: string; cupo: number; reservadas: number; repetir: boolean; hasta: string; diasSemana: number[] };

/** "Horarios y cupos · Sede" (Figura 64 c). Los cambios no alteran reservas existentes (RD23). */
function HorariosSede({ sede, alVolver }: { sede: Sede; alVolver: () => void }) {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('SEDES', 'GESTION');
  const [lunes, setLunes] = useState(lunesDe(hoyIso()));
  const [filtros, setFiltros] = useState({ actividad: '', estado: '' });
  const turnos = useApi(() => api.get<Turno[]>('/admin/turnos', { sedeId: String(sede.id), desde: lunes, hasta: sumarDiasIso(lunes, 6) }), [lunes, sede.id]);
  const [form, setForm] = useState<FormTurno | null>(null);
  const accion = useAccion();
  const semanas = Array.from({ length: 6 }, (_, i) => sumarDiasIso(lunesDe(hoyIso()), i * 7));
  const actividades = [...new Set(turnos.datos?.map((t) => t.actividad))];
  const lista = (turnos.datos ?? []).filter((t) => (!filtros.actividad || t.actividad === filtros.actividad) && (!filtros.estado || (filtros.estado === 'H') === t.habilitado));

  const nuevo = () => {
    accion.limpiar();
    setForm({ actividad: 'Musculación', fecha: hoyIso(), horaInicio: '07:00', horaFin: '08:00', cupo: 20, reservadas: 0, repetir: false, hasta: sumarDiasIso(hoyIso(), 28), diasSemana: [1, 3, 5] });
  };
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.actividad.trim()) return accion.setError('Indicá la actividad.');
    if (form.horaFin <= form.horaInicio) return accion.setError('El horario de fin debe ser posterior al de inicio.');
    const base = { actividad: form.actividad, horaInicio: form.horaInicio, horaFin: form.horaFin, cupo: form.cupo };
    const r = await accion.ejecutar(async () => {
      if (form.id) return api.put(`/admin/turnos/${form.id}`, form.reservadas > 0 ? { actividad: form.actividad, cupo: form.cupo } : { ...base, fecha: form.fecha });
      if (form.repetir) return api.post<{ creados: number }>('/admin/turnos/serie', { ...base, sedeId: sede.id, desde: form.fecha, hasta: form.hasta, diasSemana: form.diasSemana });
      return api.post('/admin/turnos', { ...base, sedeId: sede.id, fecha: form.fecha });
    });
    if (r) {
      const creados = (r as { creados?: number }).creados;
      toast(form.id ? 'Turno actualizado.' : creados ? `Se crearon ${creados} turnos.` : 'Turno agregado.');
      setForm(null);
      void turnos.recargar();
    }
  };
  const habilitar = async (t: Turno) => {
    if (await accion.ejecutar(() => api.patch(`/admin/turnos/${t.id}/habilitacion`, { habilitado: !t.habilitado }))) {
      toast(t.habilitado ? 'El turno dejó de admitir nuevas reservas.' : 'Turno habilitado.');
      void turnos.recargar();
    }
  };

  return (
    <>
      <header className="page-heading">
        <div>
          <button type="button" className="eyebrow text-link" onClick={alVolver}>
            <Icono n="back" />
            GESTIÓN MULTISEDE · SEDES
          </button>
          <h1>Horarios y cupos · {sede.nombre}</h1>
          <p>
            {sede.direccion} · Horario de atención: {sede.horarios}
          </p>
        </div>
        {gestion && (
          <Boton icono="plus" disabled={!sede.habilitada} onClick={nuevo}>
            Agregar turno
          </Boton>
        )}
      </header>
      <ErrorFormulario>{!form ? accion.error : null}</ErrorFormulario>
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field">
          <span>Semana</span>
          <select value={lunes} onChange={(e) => setLunes(e.target.value)}>
            {semanas.map((s) => (
              <option key={s} value={s}>
                {rango(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Actividad</span>
          <select value={filtros.actividad} onChange={(e) => setFiltros({ ...filtros, actividad: e.target.value })}>
            <option value="">Todas</option>
            {actividades.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="H">Habilitado</option>
            <option value="D">Deshabilitado</option>
          </select>
        </label>
      </div>
      <section className="card">
        <CabeceraTarjeta titulo="Turnos de clases y musculación" subtitulo="Cada turno define actividad, fecha, horario y cupo de la sede." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Cupo</th>
                <th>Reservas</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.actividad}</strong>
                  </td>
                  <td>{diaCorto(t.fecha)}</td>
                  <td>
                    {t.horaInicio} a {t.horaFin}
                  </td>
                  <td>{t.cupo}</td>
                  <td>
                    {t.reservadas}
                    {t.reservadas >= t.cupo && <span style={{ color: '#a06a1b', fontWeight: 600 }}> · Completo</span>}
                  </td>
                  <td>
                    <Insignia color={t.habilitado ? '' : 'neutral'}>{t.habilitado ? 'Habilitado' : 'Deshabilitado'}</Insignia>
                  </td>
                  <td>
                    {gestion && (
                      <div className="table-actions">
                        <Boton
                          estilo="outline"
                          chico
                          icono="edit"
                          onClick={() => {
                            accion.limpiar();
                            setForm({ ...t, repetir: false, hasta: t.fecha, diasSemana: [] });
                          }}
                        >
                          Editar
                        </Boton>
                        <Boton estilo="outline" chico icono={t.habilitado ? 'close' : 'check'} onClick={() => habilitar(t)}>
                          {t.habilitado ? 'Deshabilitar' : 'Habilitar'}
                        </Boton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {turnos.datos && lista.length === 0 && <Vacio titulo="No hay turnos esta semana" descripcion="Agregá un turno o elegí otra semana." icono="calendar" />}
      </section>
      <aside className="soft-alert section-gap">
        <div>
          <p>
            Los cambios no alteran las reservas existentes: el cupo no puede ser menor que las reservas registradas, la fecha y el horario de un turno con reservas no se modifican, y un turno
            deshabilitado solo deja de admitir nuevas reservas.
          </p>
        </div>
      </aside>

      <Modal titulo={form?.id ? 'Editar turno' : 'Agregar turno'} subtitulo={`${conSede(sede.nombre)}`} abierto={!!form} onCerrar={() => setForm(null)}>
        {form && (
          <form onSubmit={guardar}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            {form.reservadas > 0 && <p className="page-note">El turno tiene {form.reservadas} reservas: no se cambian la fecha ni el horario, y el cupo no puede ser menor.</p>}
            <div className="form-grid">
              <label className="wide">
                Actividad
                <input required maxLength={100} value={form.actividad} onChange={(e) => setForm({ ...form, actividad: e.target.value })} />
              </label>
              <label>
                {form.repetir ? 'Desde' : 'Fecha'}
                <input type="date" required disabled={form.reservadas > 0} min={form.id ? undefined : hoyIso()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </label>
              <label>
                Cupo
                <input type="number" required min={Math.max(1, form.reservadas)} max={500} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: Number(e.target.value) })} />
              </label>
              <label>
                Inicio
                <input type="time" required disabled={form.reservadas > 0} value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
              </label>
              <label>
                Fin
                <input type="time" required disabled={form.reservadas > 0} value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} />
              </label>
              {!form.id && (
                <label className="check-field wide">
                  <input type="checkbox" checked={form.repetir} onChange={(e) => setForm({ ...form, repetir: e.target.checked })} />
                  Repetir el turno en varios días de la semana
                </label>
              )}
              {form.repetir && (
                <>
                  <label>
                    Hasta
                    <input type="date" required min={form.fecha} value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                  </label>
                  <div className="wide">
                    <div className="tabs" role="group" aria-label="Días de la semana">
                      {DIAS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          className={`tab ${form.diasSemana.includes(i + 1) ? 'active' : ''}`.trim()}
                          aria-pressed={form.diasSemana.includes(i + 1)}
                          onClick={() => setForm({ ...form, diasSemana: form.diasSemana.includes(i + 1) ? form.diasSemana.filter((x) => x !== i + 1) : [...form.diasSemana, i + 1] })}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="form-actions">
              <Boton estilo="outline" onClick={() => setForm(null)}>
                Cancelar
              </Boton>
              <button type="submit" className="btn primary" disabled={accion.enviando || (form.repetir && form.diasSemana.length === 0)}>
                Guardar turno
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
