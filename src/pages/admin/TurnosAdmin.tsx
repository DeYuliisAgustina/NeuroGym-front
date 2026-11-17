import { useState } from 'react';
import { Icono } from '../../components/Icono';
import { Boton, BotonEnlace, Encabezado, ErrorFormulario, Insignia, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede, Turno } from '../../types';
import { fechaCorta, hoyIso } from '../../utils/formato';

interface ReservaTurno {
  id: number;
  estado: string;
  socio: { usuario: { nombre: string; apellido: string } };
  asistencia: { fechaHoraReal: string; forma: string } | null;
}
interface Fila extends ReservaTurno {
  turno: Turno;
}

const hora = (f: string) => new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
const estadoDe = (r: Fila) => (r.asistencia ? 'Asistió' : r.estado === 'CANCELADO' ? 'Cancelado' : 'Confirmado');

/** Turnos y asistencia: reservas del día por sede y su ingreso validado (la reserva no es asistencia). */
export function TurnosAdmin() {
  const { puede } = useAuth();
  const { sedeId, setSedeId } = useSedeVista();
  const [filtros, setFiltros] = useState({ busqueda: '', fecha: hoyIso(), estado: '' });
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes'));
  const filas = useApi(async () => {
    const turnos = await api.get<Turno[]>('/admin/turnos', { desde: filtros.fecha, hasta: filtros.fecha, ...(sedeId ? { sedeId } : {}) });
    const reservas = await Promise.all(turnos.map((t) => api.get<ReservaTurno[]>(`/admin/turnos/${t.id}/reservas`).then((l) => l.map((r) => ({ ...r, turno: t })))));
    return reservas.flat().sort((a, b) => a.turno.horaInicio.localeCompare(b.turno.horaInicio));
  }, [filtros.fecha, sedeId]);

  const q = filtros.busqueda.trim().toLowerCase();
  const lista = (filas.datos ?? []).filter(
    (r) =>
      (!q || `${r.socio.usuario.nombre} ${r.socio.usuario.apellido}`.toLowerCase().includes(q) || r.turno.actividad.toLowerCase().includes(q)) && (!filtros.estado || estadoDe(r) === filtros.estado),
  );
  const limpiar = () => {
    setFiltros({ busqueda: '', fecha: hoyIso(), estado: '' });
    setSedeId('');
  };

  return (
    <>
      <Encabezado
        ceja="OPERACIÓN DIARIA"
        titulo="Turnos y asistencia"
        subtitulo="Una reserva guarda el lugar; el ingreso validado confirma la asistencia."
        accion={
          puede('RECEPCION') && (
            <BotonEnlace a="/admin/recepcion" icono="camera">
              Ir a recepción
            </BotonEnlace>
          )
        }
      />
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar socio o actividad" placeholder="Buscar socio o actividad" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
          </div>
        </label>
        <label className="filter-field">
          <span>Sede</span>
          <select aria-label="Filtrar por sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Todas las sedes</option>
            {sedes.datos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Fecha</span>
          <input type="date" aria-label="Fecha" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value || hoyIso() })} />
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select aria-label="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option>Confirmado</option>
            <option>Asistió</option>
            <option>Cancelado</option>
          </select>
        </label>
        <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={limpiar}>
          Limpiar filtros
        </Boton>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Actividad / sede</th>
                <th>Reserva</th>
                <th>Estado</th>
                <th>Llegada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => {
                const estado = estadoDe(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>
                        {r.socio.usuario.nombre} {r.socio.usuario.apellido}
                      </strong>
                    </td>
                    <td>
                      {r.turno.actividad}
                      <small>{r.turno.sede}</small>
                    </td>
                    <td>
                      {fechaCorta(r.turno.fecha)} · {r.turno.horaInicio}
                    </td>
                    <td>
                      <Insignia color={estado === 'Cancelado' ? 'neutral' : ''}>{estado}</Insignia>
                    </td>
                    <td>{r.asistencia ? `${hora(r.asistencia.fechaHoraReal)} · ${r.asistencia.forma === 'QR' ? 'QR' : 'Manual'}` : 'Sin ingreso validado'}</td>
                    <td>
                      {!r.asistencia && estado === 'Confirmado' && puede('RECEPCION') && (
                        <BotonEnlace a="/admin/recepcion" estilo="outline" chico icono="camera">
                          Validar ingreso
                        </BotonEnlace>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filas.datos && lista.length === 0 && <Vacio titulo="No hay reservas para estos filtros" descripcion="Probá con otra fecha, otra sede o limpiá los filtros." icono="calendar" />}
        <ErrorFormulario>{filas.error}</ErrorFormulario>
      </section>
      <p className="page-note">Los horarios y cupos de cada sede se gestionan desde Sedes. La cancelación de una reserva la realiza el socio desde su cuenta.</p>
    </>
  );
}
