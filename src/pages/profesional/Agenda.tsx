import { useState } from 'react';
import { AccionesTurnoProfesional } from '../../components/AccionesTurnoProfesional';
import { CalendarioConsulta } from '../../components/CalendarioConsulta';
import { Aviso, Boton, Campo, EncabezadoPagina, Estado, Kpi, Modal, Pestanas, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { TurnoProfesional } from '../../types';
import { dinero, etiqueta, fecha, hoyIso } from '../../utils/formato';
import { motivoObligatorio } from '../../validations/formularios';

/** Mi agenda: solicitudes, confirmaciones, rechazos y registro de consultas realizadas (RF30, RF40, RF41). */
export function Agenda() {
  const [vista, setVista] = useState<'solicitudes' | 'agenda' | 'historial'>('solicitudes');
  const turnos = useApi(() => api.get<TurnoProfesional[]>('/profesional/agenda'));
  const comisiones = useApi(() => api.get<{ total: number; comisiones: unknown[] }>('/profesional/comisiones'));
  const [rechazando, setRechazando] = useState<TurnoProfesional | null>(null);
  const [completando, setCompletando] = useState<TurnoProfesional | null>(null);
  const [motivo, setMotivo] = useState('');
  const [importe, setImporte] = useState('');
  const accion = useAccion();
  const recargar = () => Promise.all([turnos.recargar(), comisiones.recargar()]);

  const lista = turnos.datos ?? [];
  const solicitudes = lista.filter((t) => t.estado === 'SOLICITADO');
  const proximos = lista.filter((t) => ['CONFIRMADO', 'REPROGRAMADO'].includes(t.estado));
  const historial = lista.filter((t) => ['RECHAZADO', 'CANCELADO', 'COMPLETADO'].includes(t.estado));

  const confirmar = async (t: TurnoProfesional) => {
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${t.id}/confirmacion`), 'Turno confirmado. Avisamos al socio.')) void recargar();
  };
  const rechazar = async () => {
    const problema = motivoObligatorio(motivo);
    if (problema) return accion.setError(problema);
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${rechazando!.id}/rechazo`, { motivo }), 'Solicitud rechazada.')) {
      setRechazando(null);
      setMotivo('');
      void recargar();
    }
  };
  const completar = async () => {
    if (!(Number(importe) > 0)) return accion.setError('Informá el importe efectivamente cobrado.');
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${completando!.id}/completado`, { importeDeclarado: Number(importe) }), 'Consulta registrada como realizada y pagada.')) {
      setCompletando(null);
      setImporte('');
      void recargar();
    }
  };
  const yaPaso = (t: TurnoProfesional) => t.fecha < hoyIso() || (t.fecha === hoyIso() && t.horaFin <= new Date().toTimeString().slice(0, 5));

  const fila = (t: TurnoProfesional, acciones: React.ReactNode) => (
    <div key={t.id} className="tarjeta">
      <div className="fila-entre">
        <strong>{t.socio}</strong>
        <Estado valor={t.estado} />
      </div>
      <div className="tenue">
        {fecha(t.fecha)} · {t.horaInicio} a {t.horaFin} · {etiqueta(t.modalidad)} · Pago: {etiqueta(t.metodoPago.tipo)}
        {t.metodoPago.obraSocial ? ` (${t.metodoPago.obraSocial})` : ''}
      </div>
      {t.motivo && <small>Motivo: {t.motivo}</small>}
      {t.comision && (
        <small>
          Cobrado {dinero(t.comision.importeDeclarado)} · comisión {t.comision.exenta ? 'exenta (Profesionales Fundadores)' : dinero(t.comision.importeComision)}
        </small>
      )}
      <div className="fila">{acciones}</div>
    </div>
  );

  return (
    <div>
      <EncabezadoPagina titulo="Mi agenda" />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-3" style={{ marginBottom: '1rem' }}>
        <Kpi titulo="Solicitudes pendientes" valor={solicitudes.length} />
        <Kpi titulo="Próximas consultas" valor={proximos.length} />
        <Kpi titulo="Comisiones registradas" valor={dinero(comisiones.datos?.total ?? 0)} detalle="Se abonan por un procedimiento externo a Mercado Pago." />
      </div>
      <Pestanas
        valor={vista}
        onCambiar={setVista}
        opciones={[
          { valor: 'solicitudes', texto: `Solicitudes (${solicitudes.length})` },
          { valor: 'agenda', texto: `Agenda (${proximos.length})` },
          { valor: 'historial', texto: 'Historial' },
        ]}
      />
      <div className="pila">
        {vista === 'solicitudes' &&
          (solicitudes.length ? (
            solicitudes.map((t) =>
              fila(
                t,
                <>
                  <Boton chico onClick={() => confirmar(t)}>
                    Confirmar
                  </Boton>
                  <Boton variante="secundario" chico onClick={() => setRechazando(t)}>
                    Rechazar
                  </Boton>
                </>,
              ),
            )
          ) : (
            <Vacio>No tenés solicitudes pendientes.</Vacio>
          ))}
        {vista === 'agenda' &&
          (proximos.length ? (
            proximos.map((t) =>
              fila(
                t,
                <>
                  <CalendarioConsulta turnoId={t.id} />
                  <AccionesTurnoProfesional turno={t} comoProfesional alCambiar={recargar} />
                  {yaPaso(t) && (
                    <Boton chico onClick={() => setCompletando(t)}>
                      Registrar realizada y pagada
                    </Boton>
                  )}
                </>,
              ),
            )
          ) : (
            <Vacio>No tenés consultas confirmadas.</Vacio>
          ))}
        {vista === 'historial' && (historial.length ? historial.map((t) => fila(t, null)) : <Vacio>Sin consultas anteriores.</Vacio>)}
      </div>
      <Modal titulo="Rechazar solicitud" abierto={!!rechazando} onCerrar={() => setRechazando(null)}>
        <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <Boton variante="peligro" cargando={accion.enviando} onClick={rechazar}>
          Rechazar
        </Boton>
      </Modal>
      <Modal titulo="Registrar consulta realizada y pagada" abierto={!!completando} onCerrar={() => setCompletando(null)}>
        <p className="tenue">El registro es declarativo y posterior al cobro. Se calcula una única comisión según tu plan.</p>
        <Campo etiqueta="Importe efectivamente cobrado (ARS)" type="number" min={1} value={importe} onChange={(e) => setImporte(e.target.value)} />
        <Boton cargando={accion.enviando} onClick={completar}>
          Registrar
        </Boton>
      </Modal>
    </div>
  );
}
