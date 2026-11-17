import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import type { TurnoProfesional } from '../types';
import { dinero, etiqueta, fechaLarga, hoyIso } from '../utils/formato';
import { Boton, ErrorFormulario, FilaDato, Insignia, Modal, type ColorInsignia } from './ui';

/** Etiqueta y color del estado de una consulta (como statusBadge del prototipo). */
export const ESTADO_CONSULTA: Record<string, [string, ColorInsignia]> = {
  SOLICITADO: ['Pendiente', 'warning'],
  CONFIRMADO: ['Confirmada', ''],
  REPROGRAMADO: ['Reprogramada', ''],
  RECHAZADO: ['Rechazada', 'danger'],
  CANCELADO: ['Cancelada', 'danger'],
  COMPLETADO: ['Realizada', 'neutral'],
};
export function EstadoConsulta({ estado }: { estado: string }) {
  const [texto, color] = ESTADO_CONSULTA[estado] ?? [estado, 'neutral'];
  return <Insignia color={color}>{texto}</Insignia>;
}
export const pagoDeConsulta = (t: TurnoProfesional) => (t.metodoPago.obraSocial ? `${etiqueta(t.metodoPago.tipo)} · ${t.metodoPago.obraSocial}` : etiqueta(t.metodoPago.tipo));
const CONFIRMADAS = ['CONFIRMADO', 'REPROGRAMADO'];

/** RF43: guardar la consulta confirmada en un calendario externo (enlace de Google o archivo .ics). */
export function BotonesCalendario({ turnoId }: { turnoId: number }) {
  const [error, setError] = useState<string | null>(null);
  const google = async () => {
    try {
      const { enlaceGoogle } = await api.get<{ enlaceGoogle: string }>(`/turnos-profesionales/${turnoId}/calendario`);
      window.open(enlaceGoogle, '_blank', 'noopener');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Boton estilo="outline" icono="calendar" onClick={google}>
        Google Calendar
      </Boton>
      <Boton icono="download" onClick={() => api.descargar(`/turnos-profesionales/${turnoId}/calendario`, `consulta-${turnoId}.ics`, { formato: 'ics' }).catch((e: Error) => setError(e.message))}>
        Guardar recordatorio en calendario
      </Boton>
      {error && <small role="alert">{error}</small>}
    </>
  );
}

type Modo = 'detalle' | 'cancelar' | 'reprogramar' | 'rechazar' | 'confirmada' | null;

/**
 * Acciones de una consulta (Figuras 53, 57 y 58): detalle, confirmación y
 * rechazo (profesional), reprogramación (RF39) y cancelación (RF30, RF38).
 */
export function AccionesTurnoProfesional({ turno: t, comoProfesional = false, alCambiar }: { turno: TurnoProfesional; comoProfesional?: boolean; alCambiar: () => void }) {
  const toast = useToast();
  const [modo, setModo] = useState<Modo>(null);
  const [motivo, setMotivo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState(t.fecha >= hoyIso() ? t.fecha : hoyIso());
  const [horarios, setHorarios] = useState<{ horaInicio: string; horaFin: string }[] | null>(null);
  const [hora, setHora] = useState('');
  const accion = useAccion();
  const cancelable = comoProfesional ? CONFIRMADAS.includes(t.estado) : ['SOLICITADO', ...CONFIRMADAS].includes(t.estado);
  const reprogramable = CONFIRMADAS.includes(t.estado);
  const contraparte = comoProfesional ? t.socio : t.profesional;

  useEffect(() => {
    if (modo !== 'reprogramar') return;
    setHora('');
    setHorarios(null);
    const ruta = comoProfesional ? '/profesional/horarios' : `/socio/profesionales/${t.profesionalId}/horarios`;
    api
      .get<{ horaInicio: string; horaFin: string }[]>(ruta, { fecha: nuevaFecha })
      .then(setHorarios)
      .catch(() => setHorarios([]));
  }, [modo, nuevaFecha, comoProfesional, t.profesionalId]);

  const abrir = (m: Modo) => {
    accion.limpiar();
    setMotivo('');
    setModo(m);
  };
  const terminar = (mensaje: string, siguiente: Modo = null) => {
    toast(mensaje);
    setModo(siguiente);
    alCambiar();
  };

  const confirmar = async () => {
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${t.id}/confirmacion`))) terminar('Consulta confirmada. Avisamos al socio.', 'confirmada');
  };
  const rechazar = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return accion.setError('Indicá el motivo del rechazo.');
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${t.id}/rechazo`, { motivo }))) terminar('Solicitud rechazada. El socio puede elegir otro horario.');
  };
  const cancelar = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return accion.setError('Indicá el motivo de la cancelación.');
    if (await accion.ejecutar(() => api.patch(`/turnos-profesionales/${t.id}/cancelacion`, { motivo }))) terminar('Consulta cancelada. Se liberó el horario.');
  };
  const reprogramar = async (e: FormEvent) => {
    e.preventDefault();
    if (!hora) return accion.setError('Elegí un horario disponible.');
    if (await accion.ejecutar(() => api.patch(`/turnos-profesionales/${t.id}/reprogramacion`, { fecha: nuevaFecha, horaInicio: hora }))) terminar('Consulta reprogramada. Avisamos a ambas cuentas.');
  };

  return (
    <>
      <div className="table-actions">
        <Boton estilo="outline" chico icono="chevron" onClick={() => abrir('detalle')}>
          Ver detalle
        </Boton>
        {comoProfesional && t.estado === 'SOLICITADO' && (
          <>
            <Boton estilo="soft" chico icono="check" cargando={accion.enviando && modo === null} onClick={confirmar}>
              Confirmar
            </Boton>
            <Boton estilo="outline" chico icono="close" onClick={() => abrir('rechazar')}>
              Rechazar
            </Boton>
          </>
        )}
        {reprogramable && (
          <Boton estilo="outline" chico icono="calendar" onClick={() => abrir('reprogramar')}>
            Reprogramar
          </Boton>
        )}
        {cancelable && (
          <Boton estilo="danger" chico icono="close" onClick={() => abrir('cancelar')}>
            Cancelar consulta
          </Boton>
        )}
      </div>
      {modo === null && accion.error && <small role="alert">{accion.error}</small>}

      <Modal
        titulo="Detalle de la consulta"
        subtitulo={`${t.socio} · ${t.profesional}`}
        abierto={modo === 'detalle'}
        onCerrar={() => setModo(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setModo(null)}>
              Cerrar
            </Boton>
            {reprogramable && (
              <Boton icono="calendar" onClick={() => abrir('reprogramar')}>
                Reprogramar
              </Boton>
            )}
          </>
        }
      >
        <FilaDato etiqueta="Fecha y horario">
          {fechaLarga(t.fecha)} · {t.horaInicio} a {t.horaFin}
        </FilaDato>
        <FilaDato etiqueta="Modalidad">{etiqueta(t.modalidad)}</FilaDato>
        <FilaDato etiqueta="Estado">{ESTADO_CONSULTA[t.estado]?.[0] ?? t.estado}</FilaDato>
        <FilaDato etiqueta="Pago acordado">{pagoDeConsulta(t)}</FilaDato>
        {t.comision && <FilaDato etiqueta="Importe cobrado declarado">{dinero(t.comision.importeDeclarado)}</FilaDato>}
        {t.motivo && (
          <div className="ticket-detail">
            <h3>Motivo informado</h3>
            <p>{t.motivo}</p>
          </div>
        )}
        {reprogramable && (
          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <BotonesCalendario turnoId={t.id} />
          </div>
        )}
        <p className="page-note">La modalidad de pago queda registrada con la consulta. El pago se acuerda directamente con el profesional.</p>
      </Modal>

      <Modal titulo="¡Consulta confirmada!" subtitulo={`Confirmaste la solicitud de ${t.socio}.`} abierto={modo === 'confirmada'} onCerrar={() => setModo(null)} pie={<><Boton estilo="outline" onClick={() => setModo(null)}>Cerrar</Boton><BotonesCalendario turnoId={t.id} /></>}>
        <Insignia>Confirmada</Insignia>
        <section className="receipt">
          <FilaDato etiqueta="Socio">{t.socio}</FilaDato>
          <FilaDato etiqueta="Modalidad">{etiqueta(t.modalidad)}</FilaDato>
          <FilaDato etiqueta="Fecha">{fechaLarga(t.fecha)}</FilaDato>
          <FilaDato etiqueta="Hora">
            {t.horaInicio} a {t.horaFin}
          </FilaDato>
        </section>
        <p className="page-note">Podés guardar un recordatorio en Google Calendar, Outlook u otro calendario compatible.</p>
      </Modal>

      <Modal titulo="Rechazar solicitud" subtitulo={`${t.socio} · ${fechaLarga(t.fecha, false)} ${t.horaInicio}`} abierto={modo === 'rechazar'} onCerrar={() => setModo(null)}>
        <form onSubmit={rechazar}>
          <ErrorFormulario>{accion.error}</ErrorFormulario>
          <p className="modal-text">La solicitud quedará rechazada. El socio podrá elegir otro horario y ambas cuentas recibirán un aviso.</p>
          <label>
            Motivo del rechazo
            <textarea maxLength={255} required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El motivo quedará visible para el socio." />
          </label>
          <div className="form-actions">
            <Boton estilo="outline" onClick={() => setModo(null)}>
              Volver
            </Boton>
            <button type="submit" className="btn danger" disabled={accion.enviando}>
              Rechazar solicitud
            </button>
          </div>
        </form>
      </Modal>

      <Modal titulo="Cancelar consulta" subtitulo={`${fechaLarga(t.fecha, false)} · ${t.horaInicio} · ${contraparte}`} abierto={modo === 'cancelar'} onCerrar={() => setModo(null)}>
        <form onSubmit={cancelar}>
          <ErrorFormulario>{accion.error}</ErrorFormulario>
          <label>
            Motivo de cancelación
            <textarea maxLength={255} required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El motivo quedará visible para la otra persona." />
          </label>
          <p className="page-note">Se libera el horario y se notifica a ambas cuentas.</p>
          <div className="form-actions">
            <Boton estilo="outline" onClick={() => setModo(null)}>
              Mantener consulta
            </Boton>
            <button type="submit" className="btn danger" disabled={accion.enviando}>
              Confirmar cancelación
            </button>
          </div>
        </form>
      </Modal>

      <Modal titulo="Reprogramar consulta" subtitulo={`${contraparte} · horario actual: ${fechaLarga(t.fecha, false)} ${t.horaInicio}`} abierto={modo === 'reprogramar'} onCerrar={() => setModo(null)}>
        <form onSubmit={reprogramar}>
          <ErrorFormulario>{accion.error}</ErrorFormulario>
          <div className="form-grid">
            <label>
              Nueva fecha
              <input type="date" min={hoyIso()} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} required />
            </label>
            <label>
              Nuevo horario
              <select value={hora} onChange={(e) => setHora(e.target.value)} required>
                <option value="">{horarios === null ? 'Buscando horarios…' : horarios.length ? 'Elegí un horario' : 'Sin horarios para esta fecha'}</option>
                {horarios?.map((h) => (
                  <option key={h.horaInicio} value={h.horaInicio}>
                    {h.horaInicio} a {h.horaFin}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="page-note">El turno actual se mantiene hasta confirmar. Se conserva la modalidad de pago y se notifica el nuevo horario a ambas cuentas.</p>
          <div className="form-actions">
            <Boton estilo="outline" onClick={() => setModo(null)}>
              Volver
            </Boton>
            <button className="btn primary" type="submit" disabled={!horarios?.length || accion.enviando}>
              Confirmar nuevo horario
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
