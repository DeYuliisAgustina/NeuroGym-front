import { useState } from 'react';
import { AccionesTurnoProfesional, EstadoConsulta } from '../../components/AccionesTurnoProfesional';
import { Icono } from '../../components/Icono';
import { RegistroConsultas } from '../../components/RegistroConsultas';
import { Avatar, Boton, BotonEnlace, CabeceraTarjeta, Cargando, Encabezado, EnlaceTexto, Kpi, Vacio, inicialesDe } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { TurnoProfesional } from '../../types';
import { etiqueta, fechaCorta, hoyIso } from '../../utils/formato';

export interface PerfilProfesionalDatos {
  id: number;
  especialidad: string;
  modalidadAtencion: string;
  valorConsulta: string;
  publicacionPausada: boolean;
  codigoReferido: string | null;
  consultasExentas: number;
  usuario: { nombre: string; apellido: string; email: string };
  plan: { tipo: 'BASICO' | 'PROFESIONAL'; porcentajeComision: string; perfilPromocionado: boolean; precioMensualUsd: string };
  servicios: { id: number; nombre: string; descripcion: string; visible: boolean }[];
  disponibilidad: { id: number; diaSemana: string; horaInicio: string; horaFin: string; duracionConsultaMin: number }[];
  metodosPago: { id: number; tipo: 'OBRA_SOCIAL' | 'PARTICULAR' | 'ACUERDO_CONSULTA'; obraSocial: string | null }[];
}

export const profesionDe = (e: string) => (e === 'NUTRICION' ? 'Nutricionista' : 'Deportólogo/a');
const largo = (iso: string, hora: string) => `${new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '')} · ${hora}`;

/** Filtros compartidos por la agenda y las solicitudes del profesional. */
export function FiltrosConsultas({ filtros, setFiltros, conEstado }: { filtros: { busqueda: string; modalidad: string; fecha: string; estado: string }; setFiltros: (f: typeof filtros) => void; conEstado?: boolean }) {
  return (
    <div className="list-filters" aria-label="Filtros de búsqueda">
      <label className="filter-field filter-search">
        <span>Buscar</span>
        <div className="search-input">
          <Icono n="search" />
          <input type="search" aria-label="Buscar socio u horario" placeholder="Buscar socio u horario" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
        </div>
      </label>
      <label className="filter-field">
        <span>Modalidad</span>
        <select aria-label="Modalidad" value={filtros.modalidad} onChange={(e) => setFiltros({ ...filtros, modalidad: e.target.value })}>
          <option value="">Todos</option>
          <option value="ONLINE">Online</option>
          <option value="PRESENCIAL">Presencial</option>
        </select>
      </label>
      <label className="filter-field">
        <span>Fecha de consulta</span>
        <input type="date" aria-label="Fecha de consulta" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })} />
      </label>
      {conEstado && (
        <label className="filter-field">
          <span>Estado</span>
          <select aria-label="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="SOLICITADO">Pendiente</option>
            <option value="CONFIRMADO">Confirmada</option>
            <option value="REPROGRAMADO">Reprogramada</option>
            <option value="COMPLETADO">Realizada</option>
            <option value="RECHAZADO">Rechazada</option>
            <option value="CANCELADO">Cancelada</option>
          </select>
        </label>
      )}
      <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={() => setFiltros({ busqueda: '', modalidad: '', fecha: '', estado: '' })}>
        Limpiar filtros
      </Boton>
    </div>
  );
}
export const filtrar = (lista: TurnoProfesional[], f: { busqueda: string; modalidad: string; fecha: string; estado: string }) => {
  const q = f.busqueda.trim().toLowerCase();
  return lista.filter(
    (t) => (!q || t.socio.toLowerCase().includes(q) || t.horaInicio.includes(q)) && (!f.modalidad || t.modalidad === f.modalidad) && (!f.fecha || t.fecha === f.fecha) && (!f.estado || t.estado === f.estado),
  );
};

/** Mi agenda (Figura 56 a): próximas consultas, solicitudes pendientes y registro de pagos. */
export function Agenda() {
  const toast = useToast();
  const perfil = useApi(() => api.get<PerfilProfesionalDatos>('/profesional/perfil'));
  const turnos = useApi(() => api.get<TurnoProfesional[]>('/profesional/agenda'));
  const [filtros, setFiltros] = useState({ busqueda: '', modalidad: '', fecha: '', estado: '' });
  const accion = useAccion();
  if (perfil.cargando) return <Cargando />;
  const p = perfil.datos;
  const lista = filtrar(turnos.datos ?? [], filtros);
  const proximas = lista.filter((t) => ['CONFIRMADO', 'REPROGRAMADO'].includes(t.estado) && t.fecha >= hoyIso());
  const pendientes = lista.filter((t) => t.estado === 'SOLICITADO');
  const nombre = p ? `${p.usuario.nombre} ${p.usuario.apellido}` : '';
  const servicio = p?.servicios.find((s) => s.visible);

  const confirmar = async (t: TurnoProfesional) => {
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${t.id}/confirmacion`))) {
      toast('Consulta confirmada. Avisamos al socio.');
      void turnos.recargar();
    }
  };

  return (
    <>
      <Encabezado
        ceja="MI AGENDA"
        titulo={`Hola, ${p?.usuario.nombre ?? ''}.`}
        subtitulo="Consultas confirmadas y solicitudes pendientes."
        accion={
          <BotonEnlace a="/profesional/servicios" estilo="outline" icono="calendar">
            Editar disponibilidad
          </BotonEnlace>
        }
      />
      <FiltrosConsultas filtros={filtros} setFiltros={setFiltros} />
      <div className="kpi-grid">
        <Kpi etiqueta="Solicitudes pendientes" valor={pendientes.length} pie="Para revisar" icono="message" />
        <Kpi etiqueta="Turnos confirmados" valor={proximas.length} pie="Próximas consultas" icono="calendar" />
        <Kpi etiqueta="Mi servicio" valor={p?.publicacionPausada ? 'Pausado' : 'Activo'} pie={servicio?.nombre ?? 'Sin servicios visibles'} icono="clipboard" />
        <Kpi etiqueta="Modalidad" valor={p?.modalidadAtencion === 'ONLINE_Y_PRESENCIAL' ? 'Mixta' : etiqueta(p?.modalidadAtencion)} pie={etiqueta(p?.modalidadAtencion)} icono="globe" />
      </div>
      <div className="two-col">
        <section className="card">
          <CabeceraTarjeta titulo="Próximas consultas" subtitulo="Podés consultar el detalle, reprogramar o cancelar un turno." />
          {proximas.map((t) => (
            <article key={t.id} className="confirmed-consultation">
              <div className="consultation-date">
                <Icono n="calendar" />
                <span>{largo(t.fecha, t.horaInicio)}</span>
                <EstadoConsulta estado={t.estado} />
              </div>
              <div className="spread wrap">
                <div>
                  <h3>{t.socio}</h3>
                  <p>
                    {servicio?.nombre ?? profesionDe(t.especialidad)} · {etiqueta(t.modalidad)} · {t.horaInicio} a {t.horaFin}
                  </p>
                </div>
                <AccionesTurnoProfesional turno={t} comoProfesional alCambiar={turnos.recargar} />
              </div>
            </article>
          ))}
          {turnos.datos && proximas.length === 0 && <Vacio titulo="Sin consultas confirmadas" descripcion="Cuando confirmes una solicitud, aparecerá en tu agenda." icono="calendar" />}
        </section>
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Solicitudes pendientes" subtitulo={`${pendientes.length} para revisar`} accion={<EnlaceTexto a="/profesional/solicitudes">Ver todas</EnlaceTexto>} />
            {pendientes.slice(0, 4).map((t) => (
              <div key={t.id} className="appointment-request">
                <div className="flex">
                  <Avatar iniciales={inicialesDe(t.socio)} color="peach" />
                  <div>
                    <h4>{t.socio}</h4>
                    <p>
                      {fechaCorta(t.fecha)} · {t.horaInicio} · {etiqueta(t.modalidad)}
                    </p>
                  </div>
                </div>
                <div className="request-actions">
                  <Boton estilo="soft" chico icono="check" cargando={accion.enviando} onClick={() => confirmar(t)}>
                    Confirmar
                  </Boton>
                  <BotonEnlace a="/profesional/solicitudes" estilo="outline" chico icono="chevron">
                    Ver solicitud
                  </BotonEnlace>
                </div>
              </div>
            ))}
            {turnos.datos && pendientes.length === 0 && <p className="page-note">No hay solicitudes pendientes.</p>}
            {accion.error && <small role="alert">{accion.error}</small>}
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Mi perfil" subtitulo="Información que ven los socios." />
            <div className="flex" style={{ marginBottom: 18 }}>
              <Avatar iniciales={inicialesDe(nombre)} color="peach" grande />
              <div>
                <h3>{nombre}</h3>
                <p style={{ fontSize: 12, marginTop: 4 }}>{p ? `${profesionDe(p.especialidad)} independiente` : ''}</p>
              </div>
            </div>
            <BotonEnlace a="/profesional/perfil" estilo="outline" chico icono="arrow">
              Editar mi perfil
            </BotonEnlace>
          </section>
        </div>
      </div>
      <RegistroConsultas turnos={turnos.datos ?? []} valorReferencia={Number(p?.valorConsulta ?? 0)} alCambiar={turnos.recargar} />
    </>
  );
}
