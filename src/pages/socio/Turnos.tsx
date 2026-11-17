import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, BotonEnlace, CabeceraTarjeta, Encabezado, ErrorFormulario, FilaDato, Insignia, Modal, Pestanas, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { EjercicioRutina, Sede, Turno } from '../../types';
import { hoyIso, mesAnio, sumarDiasIso } from '../../utils/formato';

interface Reserva {
  id: number;
  estado: string;
  asistencia: { fechaHoraReal: string; forma: string } | null;
  turno: Turno;
}
type Tipo = 'Todas' | 'Musculación' | 'Clases';

const esLibre = (t: Turno) => /musculaci/i.test(t.actividad);
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const franja = (h: string) => {
  const n = Number(h.slice(0, 2));
  return n < 12 ? 'Mañana' : n < 15 ? 'Mediodía' : n < 19 ? 'Tarde' : 'Noche';
};
const dia = (iso: string, opciones: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', opciones).replace('.', '');

/** Turno con fecha y horario (appointment del prototipo). */
export function Cita({ turno }: { turno: Turno }) {
  return (
    <div className="appointment">
      <div className="date-square">
        <small>{dia(turno.fecha, { month: 'short' }).toUpperCase()}</small>
        <strong>{Number(turno.fecha.slice(8, 10))}</strong>
      </div>
      <div>
        <h4>{turno.actividad}</h4>
        <p>
          {dia(turno.fecha, { weekday: 'long', day: 'numeric', month: 'short' })} · {turno.horaInicio} a {turno.horaFin}
        </p>
        <p>Sede {turno.sede}</p>
      </div>
    </div>
  );
}

/** Mis turnos (RF3, Figura 48): reservar, cambiar y cancelar. La reserva no es asistencia. */
export function Turnos() {
  const toast = useToast();
  const perfil = useApi(() => api.get<{ sedeId: number }>('/socio/perfil'));
  const [sedeId, setSedeId] = useState('');
  const [fecha, setFecha] = useState(hoyIso());
  const [tipo, setTipo] = useState<Tipo>('Todas');
  const [filtros, setFiltros] = useState({ busqueda: '', franja: '', cupos: '' });
  const sedes = useApi(() => api.get<Sede[]>('/socio/sedes'));
  const disponibles = useApi(() => api.get<Turno[]>('/socio/turnos/disponibles', { ...(sedeId ? { sedeId } : {}), fecha }), [sedeId, fecha]);
  const mias = useApi(() => api.get<{ proximas: Reserva[]; historial: Reserva[] }>('/socio/reservas'));
  const rutina = useApi(() => api.get<{ rutina: { ejercicios: EjercicioRutina[] } | null }>('/socio/rutina'));
  const [confirmar, setConfirmar] = useState<Turno | null>(null);
  const [cancelar, setCancelar] = useState<Reserva | null>(null);
  const [cambiando, setCambiando] = useState<Reserva | null>(null);
  const accion = useAccion();
  const dias = Array.from({ length: 7 }, (_, i) => sumarDiasIso(hoyIso(), i));

  useEffect(() => {
    if (perfil.datos && !sedeId) setSedeId(String(perfil.datos.sedeId));
  }, [perfil.datos, sedeId]);

  const recargar = () => Promise.all([disponibles.recargar(), mias.recargar()]);
  const reservar = async () => {
    if (!confirmar) return;
    const ok = await accion.ejecutar(async () => {
      await api.post('/socio/reservas', { turnoId: confirmar.id });
      // Cambio de horario: el turno anterior se cancela solo cuando el nuevo quedó confirmado.
      if (cambiando) await api.patch(`/socio/reservas/${cambiando.id}/cancelacion`);
      return true;
    });
    if (ok) {
      setConfirmar(null);
      setCambiando(null);
      toast(cambiando ? 'Tu turno cambió de horario.' : 'Tu reserva está confirmada. ¡Nos vemos en el gimnasio!');
      void recargar();
    }
  };
  const darDeBaja = async () => {
    if (!cancelar) return;
    if (await accion.ejecutar(() => api.patch(`/socio/reservas/${cancelar.id}/cancelacion`))) {
      setCancelar(null);
      toast('Reserva cancelada.');
      void recargar();
    }
  };

  const reservados = new Set(mias.datos?.proximas.map((r) => r.turno.id));
  const lista = (disponibles.datos ?? []).filter((t) => {
    if (tipo === 'Musculación' && !esLibre(t)) return false;
    if (tipo === 'Clases' && esLibre(t)) return false;
    if (filtros.franja && franja(t.horaInicio) !== filtros.franja) return false;
    if (filtros.cupos && t.disponibles <= 0) return false;
    const q = filtros.busqueda.trim().toLowerCase();
    return !q || t.actividad.toLowerCase().includes(q) || t.horaInicio.includes(q);
  });
  const sinEquipo = rutina.datos?.rutina?.ejercicios.find((e) => !e.disponible);

  return (
    <>
      <Encabezado ceja="MIS TURNOS" titulo="Reservar un turno" subtitulo="Elegí la sede, la actividad y el horario." accion={<Insignia color="neutral">Reserva obligatoria</Insignia>} />
      <ErrorFormulario>{!confirmar && !cancelar ? accion.error : null}</ErrorFormulario>
      <div className="two-col">
        <div>
          <div className="toolbar">
            <Pestanas
              valor={tipo}
              onCambiar={setTipo}
              opciones={[
                { valor: 'Todas', texto: 'Todas' },
                { valor: 'Musculación', texto: 'Musculación' },
                { valor: 'Clases', texto: 'Clases' },
              ]}
            />
            <select aria-label="Sede para reservar" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              {sedes.datos?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="spread" style={{ marginBottom: 16 }}>
            <h3>{mesAnio(fecha.slice(0, 7))}</h3>
            {cambiando && (
              <button type="button" className="text-link" onClick={() => setCambiando(null)}>
                Cancelar el cambio de horario
              </button>
            )}
          </div>
          <div className="day-picker" aria-label="Elegir fecha">
            {dias.map((d) => (
              <button key={d} type="button" className={`day ${d === fecha ? 'active' : ''}`.trim()} aria-label={dia(d, { weekday: 'short', day: 'numeric', month: 'long' })} onClick={() => setFecha(d)}>
                {dia(d, { weekday: 'short' }).replace(/^./, (c) => c.toUpperCase())}
                <strong>{Number(d.slice(8, 10))}</strong>
                {dia(d, { month: 'short' }).toUpperCase()}
              </button>
            ))}
          </div>
          <div className="list-filters" aria-label="Filtros de búsqueda">
            <label className="filter-field filter-search">
              <span>Buscar</span>
              <div className="search-input">
                <Icono n="search" />
                <input type="search" aria-label="Buscar actividad u horario" placeholder="Buscar actividad u horario" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
              </div>
            </label>
            <label className="filter-field">
              <span>Franja horaria</span>
              <select aria-label="Franja horaria" value={filtros.franja} onChange={(e) => setFiltros({ ...filtros, franja: e.target.value })}>
                <option value="">Todos</option>
                {['Mañana', 'Mediodía', 'Tarde', 'Noche'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Cupos</span>
              <select aria-label="Cupos" value={filtros.cupos} onChange={(e) => setFiltros({ ...filtros, cupos: e.target.value })}>
                <option value="">Todos</option>
                <option value="disponibles">Solo disponibles</option>
              </select>
            </label>
            <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={() => setFiltros({ busqueda: '', franja: '', cupos: '' })}>
              Limpiar filtros
            </Boton>
          </div>
          <div className="slots-grid">
            {lista.map((t) => {
              const mio = reservados.has(t.id);
              const lleno = t.disponibles <= 0;
              return (
                <article key={t.id} className={`slot ${lleno && !mio ? 'full' : ''}`.trim()}>
                  <div className="mini-meta">
                    <Icono n={esLibre(t) ? 'dumbbell' : 'activity'} />
                    {esLibre(t) ? 'Entrenamiento libre' : 'Clase grupal'}
                  </div>
                  <div className="slot-time">{t.horaInicio}</div>
                  <h3>{t.actividad}</h3>
                  <p>
                    {minutos(t.horaFin) - minutos(t.horaInicio)} minutos · Sede {t.sede}
                  </p>
                  <div style={{ marginTop: 14 }}>
                    {mio ? <Insignia>Tu turno</Insignia> : lleno ? <Insignia color="neutral">Sin cupos</Insignia> : <Insignia>{t.disponibles} cupos disponibles</Insignia>}
                  </div>
                  <Boton
                    estilo={mio || lleno ? 'soft' : 'outline'}
                    chico
                    icono="calendar"
                    disabled={mio || lleno}
                    onClick={() => {
                      accion.limpiar();
                      setConfirmar(t);
                    }}
                  >
                    {mio ? 'Ya reservado' : lleno ? 'Completo' : 'Reservar'}
                  </Boton>
                </article>
              );
            })}
          </div>
          {disponibles.datos && lista.length === 0 && (
            <Vacio titulo="No hay horarios para estos filtros" descripcion="Probá con otro día, otra sede o limpiá los filtros." icono="calendar" />
          )}
          <p className="page-note">Se muestran los horarios habilitados de la sede elegida. Los cupos se actualizan con cada reserva.</p>
        </div>
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Mis próximos turnos" subtitulo={`${mias.datos?.proximas.length ?? 0} ${mias.datos?.proximas.length === 1 ? 'reserva confirmada' : 'reservas confirmadas'}`} />
            <div className="bookings-list">
              {mias.datos?.proximas.map((r) => (
                <article key={r.id} className="booking-item">
                  <Insignia>{cambiando?.id === r.id ? 'Cambiando horario' : 'Confirmado'}</Insignia>
                  <Cita turno={r.turno} />
                  <div className="booking-foot">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setCambiando(r);
                        setFecha(r.turno.fecha);
                        setSedeId(String(r.turno.sedeId));
                        toast('Elegí otro horario. Tu reserva actual sigue confirmada.');
                      }}
                    >
                      Cambiar horario
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      style={{ color: '#b0957c' }}
                      onClick={() => {
                        accion.limpiar();
                        setCancelar(r);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </article>
              ))}
              {mias.datos?.proximas.length === 0 && <Vacio titulo="Sin reservas próximas" descripcion="Elegí un horario para entrenar." icono="calendar" />}
            </div>
          </section>
          {sinEquipo && (
            <aside className="soft-alert">
              <Icono n="tool" />
              <div>
                <h4>Equipamiento no disponible</h4>
                <p>{sinEquipo.equipos.find((q) => q.estado !== 'OPERATIVO')?.nombre ?? 'Un equipo de tu rutina'} está fuera de servicio. Podés mantener tu turno usando una variante de ejercicio.</p>
                <Link to="/socio/rutina">Ver mi rutina</Link>
              </div>
            </aside>
          )}
        </div>
      </div>
      <section className="card section-gap">
        <CabeceraTarjeta
          titulo="La reserva y la asistencia son pasos distintos"
          subtitulo="Al llegar a la sede, presentá tu QR personal ante recepción."
          accion={
            <BotonEnlace a="/socio/qr" chico icono="camera">
              Ver mi QR
            </BotonEnlace>
          }
        />
        <p>Reservar guarda tu lugar. La asistencia se confirma al validar el ingreso. Completar una rutina tampoco registra una asistencia.</p>
      </section>

      <Modal
        titulo={cambiando ? 'Tu nuevo horario.' : 'Confirmar reserva'}
        subtitulo="Revisá tu entrenamiento antes de confirmar."
        abierto={!!confirmar}
        onCerrar={() => setConfirmar(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setConfirmar(null)}>
              Volver
            </Boton>
            <Boton icono="check" cargando={accion.enviando} onClick={reservar}>
              Confirmar reserva
            </Boton>
          </>
        }
      >
        {confirmar && (
          <>
            <Cita turno={confirmar} />
            <div className="divider" />
            <FilaDato etiqueta="Duración">{minutos(confirmar.horaFin) - minutos(confirmar.horaInicio)} minutos</FilaDato>
            <FilaDato etiqueta="Actividad">{confirmar.actividad}</FilaDato>
            <p className="page-note">
              {cambiando ? 'El turno anterior se reemplaza solo al confirmar este cambio.' : 'El ingreso al gimnasio requiere una reserva. Podés cancelarla o cambiarla desde Mis turnos.'}
            </p>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
          </>
        )}
      </Modal>
      <Modal
        titulo="Cancelar reserva"
        subtitulo="Podés reservar otro entrenamiento cuando quieras."
        abierto={!!cancelar}
        onCerrar={() => setCancelar(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setCancelar(null)}>
              Mantener mi turno
            </Boton>
            <Boton estilo="danger" icono="close" cargando={accion.enviando} onClick={darDeBaja}>
              Cancelar reserva
            </Boton>
          </>
        }
      >
        {cancelar && <Cita turno={cancelar.turno} />}
        <p className="page-note">La cancelación afecta únicamente a esta reserva.</p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
      </Modal>
    </>
  );
}
