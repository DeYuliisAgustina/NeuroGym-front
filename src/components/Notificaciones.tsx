import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Notificacion } from '../types';
import { fecha } from '../utils/formato';
import { Icono } from './Icono';
import { Boton, Modal, Vacio } from './ui';

const TITULOS: Record<string, string> = {
  TURNO_CLASE: 'Turnos',
  TURNO_PROFESIONAL: 'Consultas con profesionales',
  PAGO: 'Pagos',
  VENCIMIENTO: 'Vencimientos',
  BENEFICIO: 'Beneficios',
  INCENTIVO: 'Un incentivo para tu regreso',
  EQUIPAMIENTO: 'Equipamiento',
};

/** Notificaciones internas (RF33, RF42) en el modal del prototipo; al abrirlo se marcan como leídas. */
export function Notificaciones({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [lista, setLista] = useState<Notificacion[] | null>(null);
  useEffect(() => {
    if (!abierto) return;
    api
      .get<Notificacion[]>('/notificaciones')
      .then((l) => {
        setLista(l);
        if (l.some((n) => !n.leida)) void api.patch('/notificaciones/leidas').catch(() => undefined);
      })
      .catch(() => setLista([]));
  }, [abierto]);
  return (
    <Modal titulo="Notificaciones" subtitulo="Avisos de tu cuenta." abierto={abierto} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div className="notice-list">
        {lista?.map((n) => (
          <div key={n.id} className="notice">
            <Icono n="bell" />
            <div>
              <h4>
                {TITULOS[n.tipo] ?? 'Aviso'}
                {!n.leida && ' · nuevo'}
              </h4>
              <p>{n.mensaje}</p>
              <small className="note">{fecha(n.fecha, true)}</small>
            </div>
          </div>
        ))}
        {lista?.length === 0 && <Vacio titulo="No hay avisos nuevos" descripcion="Las novedades aparecerán en este espacio." icono="bell" />}
      </div>
    </Modal>
  );
}
