import { useState } from 'react';
import { api } from '../services/api';
import { Boton } from './ui';

/** RF43: guardar la consulta confirmada en calendarios externos (enlace o archivo .ics). */
export function CalendarioConsulta({ turnoId }: { turnoId: number }) {
  const [error, setError] = useState<string | null>(null);
  const abrirGoogle = async () => {
    try {
      const { enlaceGoogle } = await api.get<{ enlaceGoogle: string }>(`/turnos-profesionales/${turnoId}/calendario`);
      window.open(enlaceGoogle, '_blank', 'noopener');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <span className="fila">
      <Boton variante="texto" chico onClick={abrirGoogle}>
        Google Calendar
      </Boton>
      <Boton variante="texto" chico onClick={() => api.descargar(`/turnos-profesionales/${turnoId}/calendario`, `consulta-${turnoId}.ics`, { formato: 'ics' }).catch((e) => setError(e.message))}>
        Descargar .ics
      </Boton>
      {error && <small style={{ color: 'var(--peligro)' }}>{error}</small>}
    </span>
  );
}
