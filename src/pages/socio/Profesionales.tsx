import { useState, type FormEvent } from 'react';
import { AccionesTurnoProfesional, EstadoConsulta, pagoDeConsulta } from '../../components/AccionesTurnoProfesional';
import { Icono } from '../../components/Icono';
import { ModalPremium, type PreciosPlanes } from '../../components/ModalPremium';
import { Avatar, Boton, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, inicialesDe, Modal, ModalExito, Pestanas, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { MetodoPago, TurnoProfesional } from '../../types';
import { dinero, etiqueta, fechaLarga, hoyIso } from '../../utils/formato';

interface Profesional {
  id: number;
  nombre: string;
  especialidad: string;
  modalidadAtencion: string;
  valorConsulta: number;
  promocionado: boolean;
  servicios: { id: number; nombre: string; descripcion: string }[];
  metodosPago: MetodoPago[];
}
interface PerfilPublico extends Profesional {
  disponibilidad: { id: number; diaSemana: string; horaInicio: string; horaFin: string }[];
}

const profesion = (e: string) => (e === 'NUTRICION' ? 'Nutricionista' : 'Deportólogo/a');
const metodo = (m: MetodoPago) => (m.obraSocial ? `${etiqueta(m.tipo)} · ${m.obraSocial}` : etiqueta(m.tipo));
const dia = (d: string) => d.charAt(0) + d.slice(1).toLowerCase().replace('miercoles', 'miércoles').replace('sabado', 'sábado');

/** Profesionales (RF13, RD5, Figuras 52 y 53): marketplace C2C para socios Premium. */
export function Profesionales() {
  const [tipo, setTipo] = useState<'' | 'NUTRICION' | 'DEPORTOLOGIA'>('');
  const [filtros, setFiltros] = useState({ busqueda: '', modalidad: '' });
  const perfil = useApi(() => api.get<{ esPremium: boolean; preciosPlanes: PreciosPlanes }>('/socio/perfil'));
  const lista = useApi(
    () => api.get<Profesional[]>('/socio/profesionales', { ...(tipo ? { especialidad: tipo } : {}), ...(filtros.modalidad ? { modalidad: filtros.modalidad } : {}) }),
    [tipo, filtros.modalidad],
  );
  const consultas = useApi(() => api.get<TurnoProfesional[]>('/socio/turnos-profesionales'));
  const [verPerfil, setVerPerfil] = useState<number | null>(null);
  const [solicitar, setSolicitar] = useState<Profesional | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [premium, setPremium] = useState(false);

  if (perfil.cargando) return <Cargando />;
  const esPremium = !!perfil.datos?.esPremium;
  const q = filtros.busqueda.trim().toLowerCase();
  const visibles = (lista.datos ?? []).filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.servicios.some((s) => s.nombre.toLowerCase().includes(q)));

  const tablaConsultas = (
    <section className="card section-gap">
      <CabeceraTarjeta titulo="Mis solicitudes y consultas" subtitulo="Consultá el estado, cancelá una solicitud o reprogramá una consulta confirmada." />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Profesional</th>
              <th>Turno</th>
              <th>Modalidad y pago</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {consultas.datos?.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.profesional}</strong>
                  <small>{profesion(t.especialidad)}</small>
                </td>
                <td>
                  {fechaLarga(t.fecha, false)} · {t.horaInicio}
                </td>
                <td>
                  {etiqueta(t.modalidad)}
                  <small>{pagoDeConsulta(t)}</small>
                </td>
                <td>
                  <EstadoConsulta estado={t.estado} />
                  {t.motivo && <small>{t.motivo}</small>}
                </td>
                <td>
                  <AccionesTurnoProfesional turno={t} alCambiar={consultas.recargar} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {consultas.datos?.length === 0 && <p className="page-note">Todavía no solicitaste consultas.</p>}
    </section>
  );

  return (
    <>
      <Encabezado
        ceja="MARKETPLACE C2C"
        titulo="Profesionales para tu bienestar"
        subtitulo={esPremium ? 'Nutricionistas y deportólogos independientes de los gimnasios.' : 'Acceso opcional para socios con Plan Premium.'}
        accion={<Insignia color="lilac">{esPremium ? 'Premium activo' : 'Acceso con Premium'}</Insignia>}
      />
      {!esPremium ? (
        <>
          <section className="premium-banner">
            <div>
              <div className="eyebrow">PLAN PREMIUM</div>
              <h2>Sumá un acompañamiento profesional.</h2>
              <p>Accedé a nutricionistas y deportólogos independientes de todos los gimnasios clientes. Las consultas se contratan y abonan por separado.</p>
            </div>
            <Boton estilo="mint" icono="sparkles" onClick={() => setPremium(true)}>
              Conocer Premium
            </Boton>
          </section>
          {!!consultas.datos?.length && tablaConsultas}
        </>
      ) : (
        <>
          <Pestanas
            valor={tipo}
            onCambiar={setTipo}
            opciones={[
              { valor: '', texto: 'Todos' },
              { valor: 'NUTRICION', texto: 'Nutricionista' },
              { valor: 'DEPORTOLOGIA', texto: 'Deportólogo' },
            ]}
          />
          <div className="list-filters" aria-label="Filtros de búsqueda">
            <label className="filter-field filter-search">
              <span>Buscar</span>
              <div className="search-input">
                <Icono n="search" />
                <input type="search" aria-label="Buscar nombre o especialidad" placeholder="Buscar nombre o especialidad" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
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
            <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={() => setFiltros({ busqueda: '', modalidad: '' })}>
              Limpiar filtros
            </Boton>
          </div>
          <div className="three-col">
            {visibles.map((p) => (
              <article key={p.id} className={`pro-directory-card ${p.promocionado ? 'promoted' : ''}`.trim()}>
                <div className="pro-card-top">
                  <Avatar iniciales={inicialesDe(p.nombre)} color="lilac" grande />
                  {p.promocionado ? <Insignia color="lilac">Perfil promocionado</Insignia> : <Insignia color="neutral">Independiente</Insignia>}
                </div>
                <div className="eyebrow">{profesion(p.especialidad)}</div>
                <h2>{p.nombre}</h2>
                <h3>{p.servicios[0]?.nombre ?? etiqueta(p.especialidad)}</h3>
                <p>{p.servicios[0]?.descripcion ?? ''}</p>
                <FilaDato etiqueta="Modalidad">{etiqueta(p.modalidadAtencion)}</FilaDato>
                <FilaDato etiqueta="Tarifa de referencia">{dinero(p.valorConsulta)}</FilaDato>
                <FilaDato etiqueta="Pago">{p.metodosPago.map(metodo).join(' · ') || '—'}</FilaDato>
                <div className="pro-actions">
                  <Boton estilo="outline" completo chico icono="user" onClick={() => setVerPerfil(p.id)}>
                    Ver perfil
                  </Boton>
                  <Boton completo chico icono="calendar" onClick={() => setSolicitar(p)}>
                    Solicitar turno
                  </Boton>
                </div>
              </article>
            ))}
          </div>
          {lista.datos && visibles.length === 0 && <Vacio titulo="No encontramos profesionales" descripcion="Probá otra especialidad o limpiá los filtros." icono="users" />}
          <p className="page-note">La promoción corresponde al plan Marketplace Profesional y no representa una valoración clínica.</p>
          {tablaConsultas}
        </>
      )}

      {verPerfil !== null && (
        <PerfilProfesionalModal
          id={verPerfil}
          alCerrar={() => setVerPerfil(null)}
          alSolicitar={(p) => {
            setVerPerfil(null);
            setSolicitar(p);
          }}
        />
      )}
      {solicitar && (
        <SolicitarTurno
          profesional={solicitar}
          alCerrar={() => setSolicitar(null)}
          alSolicitar={() => {
            setSolicitar(null);
            setEnviada(true);
            void consultas.recargar();
          }}
        />
      )}
      <ModalExito
        abierto={enviada}
        titulo="Solicitud enviada"
        descripcion="La modalidad de pago quedó registrada. El profesional confirmará o rechazará el horario y te avisaremos."
        boton="Ver mis consultas"
        onCerrar={() => setEnviada(false)}
      />
      <ModalPremium abierto={premium} onCerrar={() => setPremium(false)} precios={perfil.datos?.preciosPlanes} esPremium={false} onCambio={() => void perfil.recargar()} />
    </>
  );
}

/** Perfil del profesional (Figura 52 b). */
function PerfilProfesionalModal({ id, alCerrar, alSolicitar }: { id: number; alCerrar: () => void; alSolicitar: (p: Profesional) => void }) {
  const p = useApi(() => api.get<PerfilPublico>(`/socio/profesionales/${id}`), [id]);
  const d = p.datos;
  return (
    <Modal
      titulo={d?.nombre ?? 'Profesional'}
      subtitulo={d ? `${profesion(d.especialidad)} independiente` : ''}
      abierto
      onCerrar={alCerrar}
      pie={
        <>
          <Boton estilo="outline" onClick={alCerrar}>
            Volver
          </Boton>
          <Boton icono="calendar" disabled={!d} onClick={() => d && alSolicitar(d)}>
            Solicitar turno
          </Boton>
        </>
      }
    >
      {!d ? (
        <Cargando />
      ) : (
        <>
          <Avatar iniciales={inicialesDe(d.nombre)} color="lilac" grande />
          {d.servicios.map((s) => (
            <div key={s.id}>
              <h3>{s.nombre}</h3>
              <p className="modal-text">{s.descripcion}</p>
            </div>
          ))}
          <FilaDato etiqueta="Modalidad">{etiqueta(d.modalidadAtencion)}</FilaDato>
          <FilaDato etiqueta="Tarifa de referencia">{dinero(d.valorConsulta)}</FilaDato>
          <h4>Modalidades de pago aceptadas</h4>
          {d.metodosPago.map((m) => (
            <p key={m.id}>{metodo(m)}</p>
          ))}
          <h4>Disponibilidad habitual</h4>
          {d.disponibilidad.map((b) => (
            <p key={b.id}>
              {dia(b.diaSemana)} · {b.horaInicio} a {b.horaFin}
            </p>
          ))}
          {d.disponibilidad.length === 0 && <p>Sin bloques publicados.</p>}
          <p className="page-note">El importe final depende de la modalidad acordada. Cada consulta se abona directamente al profesional.</p>
        </>
      )}
    </Modal>
  );
}

/** "Tu consulta con …" (Figura 53 a, CU de solicitud de turno profesional, RF37). */
function SolicitarTurno({ profesional, alCerrar, alSolicitar }: { profesional: Profesional; alCerrar: () => void; alSolicitar: () => void }) {
  const [fecha, setFecha] = useState(hoyIso());
  const horarios = useApi(() => api.get<{ horaInicio: string; horaFin: string }[]>(`/socio/profesionales/${profesional.id}/horarios`, { fecha }), [fecha]);
  const modalidades = profesional.modalidadAtencion === 'ONLINE_Y_PRESENCIAL' ? ['ONLINE', 'PRESENCIAL'] : [profesional.modalidadAtencion];
  const [f, setF] = useState({ horaInicio: '', metodoPagoId: String(profesional.metodosPago[0]?.id ?? ''), modalidad: modalidades[0] });
  const accion = useAccion();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.horaInicio) return accion.setError('Elegí un horario disponible.');
    if (!f.metodoPagoId) return accion.setError('Elegí una modalidad de pago.');
    const ok = await accion.ejecutar(() =>
      api.post('/socio/turnos-profesionales', { profesionalId: profesional.id, metodoPagoId: Number(f.metodoPagoId), fecha, horaInicio: f.horaInicio, modalidad: f.modalidad }),
    );
    if (ok) alSolicitar();
  };
  return (
    <Modal titulo={`Tu consulta con ${profesional.nombre.split(' ')[0]}`} subtitulo={`${profesion(profesional.especialidad)} independiente`} abierto onCerrar={alCerrar}>
      <form onSubmit={enviar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label>
            Fecha
            <input
              type="date"
              min={hoyIso()}
              value={fecha}
              required
              onChange={(e) => {
                setFecha(e.target.value);
                setF({ ...f, horaInicio: '' });
              }}
            />
          </label>
          <label>
            Horario
            <select value={f.horaInicio} onChange={(e) => setF({ ...f, horaInicio: e.target.value })} required>
              <option value="">{horarios.cargando ? 'Buscando horarios…' : horarios.datos?.length ? 'Elegí un horario' : 'Sin horarios ese día'}</option>
              {horarios.datos?.map((h) => (
                <option key={h.horaInicio} value={h.horaInicio}>
                  {h.horaInicio} a {h.horaFin}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modalidad
            <select value={f.modalidad} onChange={(e) => setF({ ...f, modalidad: e.target.value })}>
              {modalidades.map((m) => (
                <option key={m} value={m}>
                  {etiqueta(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modalidad de pago
            <select value={f.metodoPagoId} onChange={(e) => setF({ ...f, metodoPagoId: e.target.value })} required>
              {profesional.metodosPago.map((m) => (
                <option key={m.id} value={m.id}>
                  {metodo(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FilaDato etiqueta="Tarifa de referencia">{dinero(profesional.valorConsulta)} / consulta</FilaDato>
        <p className="page-note">La solicitud queda pendiente hasta que el profesional confirme. La consulta se abona directamente al profesional.</p>
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Volver
          </Boton>
          <button className="btn primary" type="submit" disabled={accion.enviando}>
            <Icono n="calendar" />
            Solicitar turno
          </button>
        </div>
      </form>
    </Modal>
  );
}
