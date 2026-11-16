import { useState } from 'react';
import { Aviso, Boton, Campo, EncabezadoPagina, Modal } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';

/** Sedes (RF16): alta, modificación y deshabilitación lógica (RD21). */
export function Sedes() {
  const { puede } = useAuth();
  const gestion = puede('SEDES', 'GESTION');
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes'));
  const [f, setF] = useState<{ id?: number; nombre: string; direccion: string; horarios: string } | null>(null);
  const accion = useAccion();

  const guardar = async () => {
    if (!f!.nombre.trim() || !f!.direccion.trim() || !f!.horarios.trim()) return accion.setError('Completá nombre, dirección y horarios.');
    const { id, ...datos } = f!;
    const ok = await accion.ejecutar(() => (id ? api.put(`/admin/sedes/${id}`, datos) : api.post('/admin/sedes', datos)), 'Sede guardada.');
    if (ok) {
      setF(null);
      void sedes.recargar();
    }
  };
  const cambiar = async (s: Sede) => {
    const texto = s.habilitada
      ? 'La sede dejará de admitir nuevos socios, turnos y reservas. Se conservan sus socios, equipos, turnos y reservas. ¿Deshabilitar?'
      : '¿Habilitar la sede?';
    if (!window.confirm(texto)) return;
    if (await accion.ejecutar(() => api.patch(`/admin/sedes/${s.id}/habilitacion`, { habilitada: !s.habilitada }), 'Sede actualizada.')) void sedes.recargar();
  };

  return (
    <div>
      <EncabezadoPagina titulo="Sedes" acciones={gestion && <Boton onClick={() => setF({ nombre: '', direccion: '', horarios: '' })}>Nueva sede</Boton>} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-2">
        {sedes.datos?.map((s) => (
          <div key={s.id} className="tarjeta pila">
            <div className="fila-entre">
              <h3>{s.nombre}</h3>
              <span className={`etiqueta ${s.habilitada ? 'etiqueta-ok' : 'etiqueta-mal'}`}>{s.habilitada ? 'Habilitada' : 'Deshabilitada'}</span>
            </div>
            <small>{s.direccion}</small>
            <small>{s.horarios}</small>
            <small>{s._count?.socios ?? 0} socios · {s._count?.equipos ?? 0} equipos</small>
            {gestion && (
              <div className="fila">
                <Boton variante="secundario" chico onClick={() => setF({ id: s.id, nombre: s.nombre, direccion: s.direccion, horarios: s.horarios })}>Editar</Boton>
                <Boton variante="texto" chico onClick={() => cambiar(s)}>{s.habilitada ? 'Deshabilitar' : 'Habilitar'}</Boton>
              </div>
            )}
          </div>
        ))}
      </div>
      <Modal titulo={f?.id ? 'Modificar sede' : 'Nueva sede'} abierto={!!f} onCerrar={() => setF(null)}>
        {f && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <Campo etiqueta="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
            <Campo etiqueta="Horarios de atención" value={f.horarios} onChange={(e) => setF({ ...f, horarios: e.target.value })} />
            <Boton bloque cargando={accion.enviando} onClick={guardar}>Guardar</Boton>
          </>
        )}
      </Modal>
    </div>
  );
}
