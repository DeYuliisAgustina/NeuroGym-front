import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AccionesTurnoProfesional } from '../../components/AccionesTurnoProfesional';
import { CalendarioConsulta } from '../../components/CalendarioConsulta';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Modal, Pestanas, Selector, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { MetodoPago, TurnoProfesional } from '../../types';
import { dinero, etiqueta, fecha, hoyIso } from '../../utils/formato';

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

/** Marketplace (RF13, RD5): profesionales, solicitud de turnos y seguimiento de consultas. */
export function Profesionales() {
  const [vista, setVista] = useState<'buscar' | 'consultas'>('buscar');
  const [especialidad, setEspecialidad] = useState('');
  const perfil = useApi(() => api.get<{ esPremium: boolean }>('/socio/perfil'));
  const lista = useApi(() => api.get<Profesional[]>('/socio/profesionales', { especialidad }), [especialidad]);
  const consultas = useApi(() => api.get<TurnoProfesional[]>('/socio/turnos-profesionales'));
  const [elegido, setElegido] = useState<Profesional | null>(null);

  if (perfil.cargando) return <Cargando />;
  if (!perfil.datos?.esPremium) {
    return (
      <div>
        <EncabezadoPagina titulo="Consultas con profesionales." />
        <div className="tarjeta tarjeta-oscura">
          <h2>Exclusivo del Plan Premium</h2>
          <p>Con Premium accedés a nutricionistas y deportólogos independientes de todo el marketplace.</p>
          <Link to="/socio/perfil" className="btn btn-acento">
            Contratar Premium
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <EncabezadoPagina titulo="Consultas con profesionales." descripcion="La consulta se abona directamente al profesional." />
      <Pestanas valor={vista} onCambiar={setVista} opciones={[{ valor: 'buscar', texto: 'Profesionales' }, { valor: 'consultas', texto: `Mis consultas (${consultas.datos?.length ?? 0})` }]} />
      {vista === 'buscar' && (
        <>
          <Pestanas
            valor={especialidad}
            onCambiar={setEspecialidad}
            opciones={[
              { valor: '', texto: 'Todos' },
              { valor: 'NUTRICION', texto: 'Nutricionistas' },
              { valor: 'DEPORTOLOGIA', texto: 'Deportólogos' },
            ]}
          />
          <div className="grilla-2">
            {lista.datos?.length === 0 && <Vacio>No hay profesionales publicados.</Vacio>}
            {lista.datos?.map((p) => (
              <div key={p.id} className="tarjeta pila">
                <div className="fila-entre">
                  <h3>{p.nombre}</h3>
                  {p.promocionado && <span className="etiqueta etiqueta-violeta">Destacado</span>}
                </div>
                <small>
                  {etiqueta(p.especialidad)} · {etiqueta(p.modalidadAtencion)} · {dinero(p.valorConsulta)}
                </small>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {p.servicios.map((s) => (
                    <li key={s.id}>{s.nombre}</li>
                  ))}
                </ul>
                <small>Pago: {p.metodosPago.map((m) => (m.obraSocial ? `${etiqueta(m.tipo)} (${m.obraSocial})` : etiqueta(m.tipo))).join(' · ')}</small>
                <Boton onClick={() => setElegido(p)}>Solicitar turno</Boton>
              </div>
            ))}
          </div>
        </>
      )}
      {vista === 'consultas' && (
        <div className="pila">
          {consultas.datos?.length === 0 && <Vacio>Todavía no solicitaste consultas.</Vacio>}
          {consultas.datos?.map((t) => (
            <div key={t.id} className="tarjeta">
              <div className="fila-entre">
                <strong>{t.profesional}</strong>
                <Estado valor={t.estado} />
              </div>
              <div className="tenue">
                {fecha(t.fecha)} · {t.horaInicio} a {t.horaFin} · {etiqueta(t.modalidad)} · {etiqueta(t.metodoPago.tipo)}
              </div>
              {t.motivo && <small>Motivo: {t.motivo}</small>}
              <div className="fila">
                {['CONFIRMADO', 'REPROGRAMADO'].includes(t.estado) && <CalendarioConsulta turnoId={t.id} />}
                <AccionesTurnoProfesional turno={t} alCambiar={consultas.recargar} />
              </div>
            </div>
          ))}
        </div>
      )}
      {elegido && <SolicitarTurno profesional={elegido} alCerrar={() => setElegido(null)} alSolicitar={() => { setElegido(null); setVista('consultas'); void consultas.recargar(); }} />}
    </div>
  );
}

function SolicitarTurno({ profesional, alCerrar, alSolicitar }: { profesional: Profesional; alCerrar: () => void; alSolicitar: () => void }) {
  const [dia, setDia] = useState(hoyIso());
  const horarios = useApi(() => api.get<{ horaInicio: string; horaFin: string }[]>(`/socio/profesionales/${profesional.id}/horarios`, { fecha: dia }), [dia]);
  const modalidades = profesional.modalidadAtencion === 'ONLINE_Y_PRESENCIAL' ? ['ONLINE', 'PRESENCIAL'] : [profesional.modalidadAtencion];
  const [f, setF] = useState({ horaInicio: '', metodoPagoId: String(profesional.metodosPago[0]?.id ?? ''), modalidad: modalidades[0] });
  const accion = useAccion();
  const enviar = async () => {
    if (!f.horaInicio) return accion.setError('Elegí un horario disponible');
    if (!f.metodoPagoId) return accion.setError('Elegí un método de pago');
    const ok = await accion.ejecutar(() =>
      api.post('/socio/turnos-profesionales', { profesionalId: profesional.id, metodoPagoId: Number(f.metodoPagoId), fecha: dia, horaInicio: f.horaInicio, modalidad: f.modalidad }),
    );
    if (ok) alSolicitar();
  };
  return (
    <Modal titulo={`Solicitar turno con ${profesional.nombre}`} abierto onCerrar={alCerrar}>
      <Aviso tipo="error">{accion.error}</Aviso>
      <Campo etiqueta="Fecha" type="date" min={hoyIso()} value={dia} onChange={(e) => { setDia(e.target.value); setF({ ...f, horaInicio: '' }); }} />
      <Selector
        etiqueta="Horario"
        vacio={horarios.datos?.length ? 'Elegí un horario' : 'Sin horarios disponibles ese día'}
        value={f.horaInicio}
        onChange={(e) => setF({ ...f, horaInicio: e.target.value })}
        opciones={(horarios.datos ?? []).map((h) => ({ valor: h.horaInicio, texto: `${h.horaInicio} a ${h.horaFin}` }))}
      />
      <Selector etiqueta="Modalidad" value={f.modalidad} onChange={(e) => setF({ ...f, modalidad: e.target.value })} opciones={modalidades.map((m) => ({ valor: m, texto: etiqueta(m) }))} />
      <Selector
        etiqueta="Método de pago (RF37)"
        value={f.metodoPagoId}
        onChange={(e) => setF({ ...f, metodoPagoId: e.target.value })}
        opciones={profesional.metodosPago.map((m) => ({ valor: m.id, texto: m.obraSocial ? `${etiqueta(m.tipo)}: ${m.obraSocial}` : etiqueta(m.tipo) }))}
      />
      <div className="fila">
        <Boton variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton cargando={accion.enviando} onClick={enviar}>
          Enviar solicitud
        </Boton>
      </div>
    </Modal>
  );
}
