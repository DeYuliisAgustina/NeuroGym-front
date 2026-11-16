import { useState } from 'react';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Modal } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero, fecha, hoyIso } from '../../utils/formato';

interface Plan {
  id: number;
  tipo: 'BASICO' | 'PREMIUM';
  importeVigente: number;
  actualizaciones: { id: number; importeAnterior: string; importeNuevo: string; vigenteDesde: string; motivo: string; fecha: string; responsable: { usuario: { nombre: string; apellido: string } } }[];
}

/** Planes Básico y Premium y su historial de precios (RF16, RF20, RD12, RNF13). */
export function Precios() {
  const { puede } = useAuth();
  const planes = useApi(() => api.get<Plan[]>('/admin/planes'));
  const [editando, setEditando] = useState<Plan | null>(null);
  const [f, setF] = useState({ importeNuevo: '', vigenteDesde: hoyIso(), motivo: '' });
  const accion = useAccion();
  if (planes.cargando) return <Cargando />;

  const guardar = async () => {
    if (!(Number(f.importeNuevo) >= 0) || f.importeNuevo === '' || !f.motivo.trim()) return accion.setError('Completá el importe y el motivo.');
    if (await accion.ejecutar(() => api.put(`/admin/planes/${editando!.tipo}/precio`, { ...f, importeNuevo: Number(f.importeNuevo) }), 'Precio actualizado.')) {
      setEditando(null);
      void planes.recargar();
    }
  };

  return (
    <div>
      <EncabezadoPagina titulo="Planes y precios" descripcion="Los nuevos precios rigen para los pagos posteriores y no modifican los comprobantes ya emitidos." />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-2">
        {planes.datos?.map((p) => (
          <div key={p.id} className="tarjeta pila">
            <div className="fila-entre">
              <h2>Plan {p.tipo === 'BASICO' ? 'Básico' : 'Premium'}</h2>
              {puede('PRECIOS', 'GESTION') && <Boton chico onClick={() => { setEditando(p); setF({ importeNuevo: String(p.importeVigente), vigenteDesde: hoyIso(), motivo: '' }); }}>Actualizar precio</Boton>}
            </div>
            <div className="kpi">{dinero(p.importeVigente)}</div>
            <small>{p.tipo === 'BASICO' ? 'Cuota base mensual' : 'Adicional mensual sobre la cuota base'}</small>
            <h3>Historial</h3>
            {p.actualizaciones.length === 0 && <small>Sin cambios registrados.</small>}
            {p.actualizaciones.map((a) => (
              <div key={a.id} style={{ fontSize: '0.88rem', borderBottom: '1px solid var(--borde)', paddingBottom: '0.4rem' }}>
                {dinero(a.importeAnterior)} → <strong>{dinero(a.importeNuevo)}</strong> desde {fecha(a.vigenteDesde)}
                <div className="tenue">{a.motivo} · {a.responsable.usuario.nombre} {a.responsable.usuario.apellido} · {fecha(a.fecha, true)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Modal titulo={`Actualizar Plan ${editando?.tipo === 'BASICO' ? 'Básico' : 'Premium'}`} abierto={!!editando} onCerrar={() => setEditando(null)}>
        <Aviso tipo="error">{accion.error}</Aviso>
        <Campo etiqueta="Nuevo importe (ARS)" type="number" min={0} value={f.importeNuevo} onChange={(e) => setF({ ...f, importeNuevo: e.target.value })} />
        <Campo etiqueta="Vigente desde" type="date" min={hoyIso()} value={f.vigenteDesde} onChange={(e) => setF({ ...f, vigenteDesde: e.target.value })} />
        <Campo etiqueta="Motivo" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
        <Boton bloque cargando={accion.enviando} onClick={guardar}>Guardar</Boton>
      </Modal>
    </div>
  );
}
