import { useState } from 'react';
import { AccionesTurnoProfesional, EstadoConsulta } from '../../components/AccionesTurnoProfesional';
import { RegistroConsultas } from '../../components/RegistroConsultas';
import { CabeceraTarjeta, Encabezado, Vacio } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { TurnoProfesional } from '../../types';
import { etiqueta, fechaCorta } from '../../utils/formato';
import { FiltrosConsultas, filtrar, type PerfilProfesionalDatos } from './Agenda';

/** Solicitudes y turnos (Figuras 57 y 58): confirmar, rechazar, reprogramar y cancelar consultas. */
export function Solicitudes() {
  const perfil = useApi(() => api.get<PerfilProfesionalDatos>('/profesional/perfil'));
  const turnos = useApi(() => api.get<TurnoProfesional[]>('/profesional/agenda'));
  const [filtros, setFiltros] = useState({ busqueda: '', modalidad: '', fecha: '', estado: '' });
  const lista = filtrar(turnos.datos ?? [], filtros);
  return (
    <>
      <Encabezado ceja="CONSULTAS" titulo="Solicitudes y turnos" subtitulo="Confirmá solicitudes y administrá los cambios de tus consultas." />
      <FiltrosConsultas filtros={filtros} setFiltros={setFiltros} conEstado />
      <section className="card">
        <CabeceraTarjeta titulo="Consultas recibidas" subtitulo="Los cambios de estado generan avisos para ambas cuentas." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Modalidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.socio}</strong>
                  </td>
                  <td>{fechaCorta(t.fecha)}</td>
                  <td>{t.horaInicio}</td>
                  <td>{etiqueta(t.modalidad)}</td>
                  <td>
                    <EstadoConsulta estado={t.estado} />
                    {t.motivo && <small>{t.motivo}</small>}
                  </td>
                  <td>
                    <AccionesTurnoProfesional turno={t} comoProfesional alCambiar={turnos.recargar} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {turnos.datos && lista.length === 0 && <Vacio titulo="No hay consultas para estos filtros" descripcion="Las solicitudes de socios Premium aparecen en este espacio." icono="message" />}
      </section>
      <RegistroConsultas turnos={turnos.datos ?? []} valorReferencia={Number(perfil.datos?.valorConsulta ?? 0)} alCambiar={turnos.recargar} />
    </>
  );
}
