import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Notificacion } from '../types';
import { fecha } from '../utils/formato';

/** Campana con las notificaciones internas del usuario (RF33, RF42). */
export function Notificaciones() {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierta, setAbierta] = useState(false);

  const cargar = () => api.get<Notificacion[]>('/notificaciones').then(setLista).catch(() => undefined);

  useEffect(() => {
    void cargar();
    const intervalo = window.setInterval(cargar, 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  const noLeidas = lista.filter((n) => !n.leida).length;

  const marcarTodas = async () => {
    await api.patch('/notificaciones/leidas');
    await cargar();
  };

  return (
    <div className="campana">
      <button className="btn btn-texto" aria-label={`Notificaciones (${noLeidas} sin leer)`} onClick={() => setAbierta((a) => !a)}>
        🔔{noLeidas > 0 && <span className="contador">{noLeidas}</span>}
      </button>
      {abierta && (
        <div className="lista-notificaciones">
          <div className="fila-entre">
            <strong>Notificaciones</strong>
            {noLeidas > 0 && (
              <button className="btn btn-texto btn-chico" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          {lista.length === 0 && <p className="tenue">No tenés notificaciones.</p>}
          {lista.map((n) => (
            <div key={n.id} className={`item ${n.leida ? '' : 'nueva'}`}>
              <div>{n.mensaje}</div>
              <small>{fecha(n.fecha, true)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
