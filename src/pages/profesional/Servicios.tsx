import { useEffect, useState, type FormEvent } from 'react';
import { Icono } from '../../components/Icono';
import { Boton, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, Modal } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { PerfilProfesionalDatos } from './Agenda';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const diaTexto = (d: string) => ({ MIERCOLES: 'Miércoles', SABADO: 'Sábado' })[d] ?? d.charAt(0) + d.slice(1).toLowerCase();

/** Servicio y disponibilidad (RF29, RF36, Figuras 55 y 56 b): servicio publicado, horarios y modalidades de pago. */
export function Servicios() {
  const toast = useToast();
  const perfil = useApi(() => api.get<PerfilProfesionalDatos>('/profesional/perfil'));
  const p = perfil.datos;
  const servicio = p?.servicios[0];
  const [f, setF] = useState({ nombre: '', descripcion: '', modalidad: 'ONLINE_Y_PRESENCIAL', valor: '' });
  const [pagos, setPagos] = useState({ particular: false, acuerdo: false, obras: '' });
  const [horarios, setHorarios] = useState(false);
  const accion = useAccion();
  const accionPagos = useAccion();

  useEffect(() => {
    if (!p) return;
    setF({ nombre: p.servicios[0]?.nombre ?? '', descripcion: p.servicios[0]?.descripcion ?? '', modalidad: p.modalidadAtencion, valor: String(Number(p.valorConsulta)) });
    setPagos({
      particular: p.metodosPago.some((m) => m.tipo === 'PARTICULAR'),
      acuerdo: p.metodosPago.some((m) => m.tipo === 'ACUERDO_CONSULTA'),
      obras: p.metodosPago.filter((m) => m.tipo === 'OBRA_SOCIAL').map((m) => m.obraSocial).join('\n'),
    });
  }, [p]);

  if (perfil.cargando || !p) return <Cargando />;

  const guardarServicio = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.nombre.trim() || !f.descripcion.trim()) return accion.setError('Completá la especialidad y la descripción del servicio.');
    if (!(Number(f.valor) >= 0) || f.valor === '') return accion.setError('Ingresá un valor de consulta válido.');
    const ok = await accion.ejecutar(async () => {
      await api.put('/profesional/perfil', { modalidadAtencion: f.modalidad, valorConsulta: Number(f.valor) });
      if (servicio) await api.put(`/profesional/servicios/${servicio.id}`, { nombre: f.nombre, descripcion: f.descripcion });
      else await api.post('/profesional/servicios', { nombre: f.nombre, descripcion: f.descripcion });
      return true;
    });
    if (ok) {
      toast('Servicio guardado.');
      void perfil.recargar();
    }
  };
  const alternarVisible = async () => {
    if (!servicio) return;
    if (await accion.ejecutar(() => api.put(`/profesional/servicios/${servicio.id}`, { visible: !servicio.visible }))) {
      toast(servicio.visible ? 'El servicio dejó de mostrarse a los socios.' : 'El servicio vuelve a mostrarse a los socios.');
      void perfil.recargar();
    }
  };
  /** Sincroniza las modalidades elegidas con los métodos de pago registrados (RF36). */
  const guardarPagos = async (e: FormEvent) => {
    e.preventDefault();
    const obras = [...new Set(pagos.obras.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))];
    if (!pagos.particular && !pagos.acuerdo && obras.length === 0) return accionPagos.setError('Habilitá al menos una modalidad de pago.');
    if (obras.length > 15 || obras.some((o) => o.length > 100)) return accionPagos.setError('Indicá hasta 15 obras sociales con nombres de hasta 100 caracteres.');
    const actuales = p.metodosPago;
    const quiere = (tipo: string, obra?: string) => (tipo === 'PARTICULAR' ? pagos.particular : tipo === 'ACUERDO_CONSULTA' ? pagos.acuerdo : obras.includes(obra ?? ''));
    const ok = await accionPagos.ejecutar(async () => {
      for (const m of actuales) if (!quiere(m.tipo, m.obraSocial ?? undefined)) await api.delete(`/profesional/metodos-pago/${m.id}`);
      if (pagos.particular && !actuales.some((m) => m.tipo === 'PARTICULAR')) await api.post('/profesional/metodos-pago', { tipo: 'PARTICULAR' });
      if (pagos.acuerdo && !actuales.some((m) => m.tipo === 'ACUERDO_CONSULTA')) await api.post('/profesional/metodos-pago', { tipo: 'ACUERDO_CONSULTA' });
      for (const o of obras) if (!actuales.some((m) => m.tipo === 'OBRA_SOCIAL' && m.obraSocial === o)) await api.post('/profesional/metodos-pago', { tipo: 'OBRA_SOCIAL', obraSocial: o });
      return true;
    });
    if (ok) toast('Modalidades de pago guardadas.');
    void perfil.recargar();
  };

  return (
    <>
      <Encabezado ceja="MI SERVICIO" titulo="Servicio y disponibilidad" subtitulo="Editá la descripción, la modalidad y el valor de tu consulta." />
      <div className="two-col">
        <section className="card">
          <CabeceraTarjeta titulo={servicio?.nombre ?? 'Tu servicio'} subtitulo="Información del servicio." />
          <form onSubmit={guardarServicio}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            <div className="form-grid">
              <label className="wide">
                Especialidad
                <input required maxLength={100} placeholder="Por ejemplo: Nutrición deportiva" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
              </label>
              <label className="wide">
                Descripción del servicio
                <textarea required maxLength={2000} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
              </label>
              <label>
                Modalidad
                <select value={f.modalidad} onChange={(e) => setF({ ...f, modalidad: e.target.value })}>
                  <option value="ONLINE">Online</option>
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="ONLINE_Y_PRESENCIAL">Online y presencial</option>
                </select>
              </label>
              <label>
                Valor de la consulta (ARS)
                <input type="number" min={0} step={500} required value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
              </label>
            </div>
            {servicio && (
              <div className="preference-row">
                <div>
                  <h4>Servicio visible</h4>
                  <p>Mostrar en la lista de profesionales</p>
                </div>
                <button type="button" className={`toggle ${servicio.visible ? 'on' : ''}`.trim()} aria-label="Cambiar visibilidad del servicio" aria-pressed={servicio.visible} onClick={alternarVisible}>
                  <span />
                </button>
              </div>
            )}
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={accion.enviando}>
                <Icono n="check" />
                Guardar servicio
              </button>
            </div>
          </form>
        </section>
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Disponibilidad habitual" subtitulo="Horarios para recibir consultas." />
            <div className="notice-list">
              {p.disponibilidad.map((b) => (
                <div key={b.id} className="notice">
                  <Icono n="calendar" />
                  <div>
                    <h4>
                      {diaTexto(b.diaSemana)} · {b.horaInicio} a {b.horaFin}
                    </h4>
                    <p>Consultas de {b.duracionConsultaMin} minutos</p>
                  </div>
                </div>
              ))}
              {p.disponibilidad.length === 0 && <p className="page-note">Todavía no cargaste horarios: los socios no pueden solicitar turnos.</p>}
            </div>
            <div style={{ marginTop: 20 }}>
              <Boton estilo="outline" completo chico icono="calendar" onClick={() => setHorarios(true)}>
                Editar horarios
              </Boton>
            </div>
          </section>
          <aside className="soft-alert green">
            <Icono n="users" />
            <div>
              <h4>Atención independiente</h4>
              <p>Cada consulta se acuerda directamente con el socio.</p>
            </div>
          </aside>
        </div>
      </div>
      <section className="card section-gap">
        <CabeceraTarjeta titulo="Modalidades de pago aceptadas" subtitulo="El socio elige una de estas opciones al solicitar la consulta." />
        <form onSubmit={guardarPagos}>
          <ErrorFormulario>{accionPagos.error}</ErrorFormulario>
          <div className="form-grid">
            <label className="check-field">
              <input type="checkbox" checked={pagos.particular} onChange={(e) => setPagos({ ...pagos, particular: e.target.checked })} />
              Atención particular
            </label>
            <label className="check-field">
              <input type="checkbox" checked={pagos.acuerdo} onChange={(e) => setPagos({ ...pagos, acuerdo: e.target.checked })} />
              Acuerdo en consulta
            </label>
            <label className="wide">
              Obras sociales aceptadas
              <textarea maxLength={1600} placeholder="Una obra social por línea; dejá vacío si no aceptás" value={pagos.obras} onChange={(e) => setPagos({ ...pagos, obras: e.target.value })} />
            </label>
          </div>
          <p className="page-note">Se debe habilitar al menos una opción. Las modalidades de las consultas anteriores se conservan.</p>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={accionPagos.enviando}>
              <Icono n="check" />
              Guardar modalidades de pago
            </button>
          </div>
        </form>
      </section>
      {horarios && <EditarHorarios perfil={p} alCerrar={() => setHorarios(false)} alCambiar={() => void perfil.recargar()} />}
    </>
  );
}

/** "Editar disponibilidad" (Figura 56 b): bloques semanales de atención. */
function EditarHorarios({ perfil, alCerrar, alCambiar }: { perfil: PerfilProfesionalDatos; alCerrar: () => void; alCambiar: () => void }) {
  const toast = useToast();
  const [b, setB] = useState({ diaSemana: 'LUNES', horaInicio: '10:00', horaFin: '13:00', duracionConsultaMin: 45 });
  const accion = useAccion();
  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    if (b.horaFin <= b.horaInicio) return accion.setError('El fin debe ser posterior al inicio.');
    if (await accion.ejecutar(() => api.post('/profesional/disponibilidad', b))) {
      toast('Horario agregado.');
      alCambiar();
    }
  };
  const quitar = async (id: number) => {
    if (await accion.ejecutar(() => api.delete(`/profesional/disponibilidad/${id}`))) {
      toast('Horario eliminado. Las consultas ya confirmadas se mantienen.');
      alCambiar();
    }
  };
  return (
    <Modal titulo="Editar disponibilidad" subtitulo="Horarios semanales en los que recibís consultas." abierto onCerrar={alCerrar} pie={<Boton onClick={alCerrar}>Listo</Boton>}>
      <ErrorFormulario>{accion.error}</ErrorFormulario>
      <div className="notice-list">
        {perfil.disponibilidad.map((d) => (
          <div key={d.id} className="notice">
            <Icono n="calendar" />
            <div className="spread" style={{ width: '100%' }}>
              <div>
                <h4>
                  {diaTexto(d.diaSemana)} · {d.horaInicio} a {d.horaFin}
                </h4>
                <p>Consultas de {d.duracionConsultaMin} minutos</p>
              </div>
              <Boton estilo="outline" chico icono="close" onClick={() => quitar(d.id)}>
                Quitar
              </Boton>
            </div>
          </div>
        ))}
      </div>
      <div className="divider" />
      <form onSubmit={agregar}>
        <div className="form-grid">
          <label>
            Día
            <select value={b.diaSemana} onChange={(e) => setB({ ...b, diaSemana: e.target.value })}>
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  {diaTexto(d)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Duración de cada consulta (min)
            <input type="number" min={15} max={180} step={5} value={b.duracionConsultaMin} onChange={(e) => setB({ ...b, duracionConsultaMin: Number(e.target.value) })} />
          </label>
          <label>
            Desde
            <input type="time" required value={b.horaInicio} onChange={(e) => setB({ ...b, horaInicio: e.target.value })} />
          </label>
          <label>
            Hasta
            <input type="time" required value={b.horaFin} onChange={(e) => setB({ ...b, horaFin: e.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn outline small" type="submit" disabled={accion.enviando}>
            <Icono n="plus" />
            Agregar horario
          </button>
        </div>
      </form>
    </Modal>
  );
}
