import { useState } from 'react';
import { Aviso, Boton, Cargando, EncabezadoPagina, Estado, Pestanas, Selector, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede, Turno } from '../../types';
import { diaSemanaCorto, fecha, hoyIso, sumarDiasIso } from '../../utils/formato';

interface Reserva {
  id: number;
  estado: string;
  asistencia: { fechaHoraReal: string; forma: string } | null;
  turno: Turno;
}

/** Mis turnos (RF3): reservar y cancelar según sede, horario y cupos. La reserva no es asistencia. */
export function Turnos() {
  const [vista, setVista] = useState<'reservar' | 'mios'>('reservar');
  const [sedeId, setSedeId] = useState('');
  const [dia, setDia] = useState(hoyIso());
  const sedes = useApi(() => api.get<Sede[]>('/socio/sedes'));
  const disponibles = useApi(() => api.get<Turno[]>('/socio/turnos/disponibles', { sedeId, fecha: dia }), [sedeId, dia]);
  const mias = useApi(() => api.get<{ proximas: Reserva[]; historial: Reserva[] }>('/socio/reservas'));
  const accion = useAccion();
  const dias = Array.from({ length: 7 }, (_, i) => sumarDiasIso(hoyIso(), i));

  const recargar = () => Promise.all([disponibles.recargar(), mias.recargar()]);
  const reservar = async (t: Turno) => {
    if (await accion.ejecutar(() => api.post('/socio/reservas', { turnoId: t.id }), `Reservaste ${t.actividad} a las ${t.horaInicio} h.`)) void recargar();
  };
  const cancelar = async (reservaId: number) => {
    if (!window.confirm('¿Cancelar la reserva?')) return;
    if (await accion.ejecutar(() => api.patch(`/socio/reservas/${reservaId}/cancelacion`), 'Reserva cancelada.')) void recargar();
  };

  return (
    <div>
      <EncabezadoPagina titulo="Mis turnos" descripcion="Reservá musculación o clases. La asistencia se confirma con tu QR en recepción." />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <Pestanas valor={vista} onCambiar={setVista} opciones={[{ valor: 'reservar', texto: 'Reservar' }, { valor: 'mios', texto: `Mis reservas (${mias.datos?.proximas.length ?? 0})` }]} />
      {vista === 'reservar' && (
        <div className="tarjeta">
          <Selector etiqueta="Sede" vacio="Todas las sedes" value={sedeId} onChange={(e) => setSedeId(e.target.value)} opciones={(sedes.datos ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
          <div className="pestanas">
            {dias.map((d) => (
              <button key={d} className={`dia-chip ${dia === d ? 'activa' : ''}`} onClick={() => setDia(d)}>
                {diaSemanaCorto(d)}
              </button>
            ))}
          </div>
          {disponibles.cargando && <Cargando />}
          {disponibles.datos?.length === 0 && <Vacio>No hay turnos disponibles para ese día.</Vacio>}
          {disponibles.datos?.map((t) => (
            <div key={t.id} className="fila-entre" style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--borde)' }}>
              <div>
                <strong>
                  {t.horaInicio} – {t.horaFin} · {t.actividad}
                </strong>
                <div className="tenue" style={{ fontSize: '0.88rem' }}>
                  {t.sede} · {t.disponibles} de {t.cupo} cupos libres
                </div>
              </div>
              {t.reservaPropiaId ? (
                <Boton variante="secundario" chico onClick={() => cancelar(t.reservaPropiaId!)}>
                  Cancelar
                </Boton>
              ) : (
                <Boton chico disabled={t.disponibles === 0} cargando={accion.enviando} onClick={() => reservar(t)}>
                  {t.disponibles === 0 ? 'Sin cupo' : 'Reservar'}
                </Boton>
              )}
            </div>
          ))}
        </div>
      )}
      {vista === 'mios' && (
        <div className="pila">
          <div className="tarjeta">
            <h3>Próximos</h3>
            {mias.datos?.proximas.length === 0 && <Vacio>No tenés reservas próximas.</Vacio>}
            {mias.datos?.proximas.map((r) => (
              <div key={r.id} className="fila-entre" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--borde)' }}>
                <div>
                  <strong>{r.turno.actividad}</strong>
                  <div className="tenue">
                    {diaSemanaCorto(r.turno.fecha)} · {r.turno.horaInicio} h · {r.turno.sede}
                  </div>
                </div>
                <Boton variante="secundario" chico onClick={() => cancelar(r.id)}>
                  Cancelar
                </Boton>
              </div>
            ))}
          </div>
          <div className="tarjeta">
            <h3>Historial de turnos</h3>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Actividad</th>
                    <th>Reserva</th>
                    <th>Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {mias.datos?.historial.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {fecha(r.turno.fecha)} {r.turno.horaInicio}
                      </td>
                      <td>{r.turno.actividad}</td>
                      <td>
                        <Estado valor={r.estado} />
                      </td>
                      <td>{r.asistencia ? `✓ ${fecha(r.asistencia.fechaHoraReal, true)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
