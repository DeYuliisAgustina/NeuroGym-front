import { useState } from 'react';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import type { TurnoProfesional } from '../types';
import { hoyIso } from '../utils/formato';
import { motivoObligatorio } from '../validations/formularios';
import { Aviso, Boton, Campo, Modal, Selector } from './ui';

/** Cancelar (RF30, RF38) o reprogramar (RF39) un turno profesional, para socio o profesional. */
export function AccionesTurnoProfesional({ turno, comoProfesional = false, alCambiar }: { turno: TurnoProfesional; comoProfesional?: boolean; alCambiar: () => void }) {
  const [modo, setModo] = useState<'cancelar' | 'reprogramar' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState(hoyIso());
  const [horarios, setHorarios] = useState<{ horaInicio: string; horaFin: string }[]>([]);
  const [hora, setHora] = useState('');
  const accion = useAccion();
  const activo = ['SOLICITADO', 'CONFIRMADO', 'REPROGRAMADO'].includes(turno.estado);
  const reprogramable = ['CONFIRMADO', 'REPROGRAMADO'].includes(turno.estado);
  if (!activo) return null;

  const buscarHorarios = async (f: string) => {
    setNuevaFecha(f);
    setHora('');
    const ruta = comoProfesional ? '/profesional/horarios' : `/socio/profesionales/${turno.profesionalId}/horarios`;
    const lista = await accion.ejecutar(() => api.get<{ horaInicio: string; horaFin: string }[]>(ruta, { fecha: f }));
    setHorarios(lista ?? []);
  };

  const confirmar = async () => {
    if (modo === 'cancelar') {
      const problema = motivoObligatorio(motivo);
      if (problema) return accion.setError(problema);
      if (await accion.ejecutar(() => api.patch(`/turnos-profesionales/${turno.id}/cancelacion`, { motivo }))) {
        setModo(null);
        alCambiar();
      }
    } else if (modo === 'reprogramar') {
      if (!hora) return accion.setError('Elegí un horario disponible');
      if (await accion.ejecutar(() => api.patch(`/turnos-profesionales/${turno.id}/reprogramacion`, { fecha: nuevaFecha, horaInicio: hora }))) {
        setModo(null);
        alCambiar();
      }
    }
  };

  return (
    <>
      {reprogramable && (
        <Boton variante="texto" chico onClick={() => { setModo('reprogramar'); void buscarHorarios(nuevaFecha); }}>
          Reprogramar
        </Boton>
      )}
      <Boton variante="texto" chico onClick={() => setModo('cancelar')}>
        Cancelar
      </Boton>
      <Modal titulo={modo === 'cancelar' ? 'Cancelar turno' : 'Reprogramar turno'} abierto={!!modo} onCerrar={() => setModo(null)}>
        <Aviso tipo="error">{accion.error}</Aviso>
        {modo === 'cancelar' && <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} />}
        {modo === 'reprogramar' && (
          <>
            <Campo etiqueta="Nueva fecha" type="date" min={hoyIso()} value={nuevaFecha} onChange={(e) => buscarHorarios(e.target.value)} />
            <Selector
              etiqueta="Horario disponible"
              vacio={horarios.length ? 'Elegí un horario' : 'Sin horarios para esa fecha'}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              opciones={horarios.map((h) => ({ valor: h.horaInicio, texto: `${h.horaInicio} a ${h.horaFin}` }))}
            />
            <small>La reprogramación no requiere una nueva aprobación.</small>
          </>
        )}
        <div className="fila" style={{ marginTop: '0.8rem' }}>
          <Boton variante="secundario" onClick={() => setModo(null)}>
            Volver
          </Boton>
          <Boton variante={modo === 'cancelar' ? 'peligro' : 'primario'} cargando={accion.enviando} onClick={confirmar}>
            Confirmar
          </Boton>
        </div>
      </Modal>
    </>
  );
}
