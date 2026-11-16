import { useState } from 'react';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Selector } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { etiqueta, fecha } from '../../utils/formato';

interface Gimnasio {
  razonSocial: string;
  cuit: string;
  toleranciaAntesMin: number;
  toleranciaDespuesMin: number;
  politicaCuotaPendiente: 'BLOQUEAR' | 'AUTORIZAR';
  ultimaEjecucionEtl: string | null;
  suscripcion: { tipo: string; maxSedes: number; maxSociosActivos: number; fechaInicio: string } | null;
  uso: { sedesHabilitadas: number; sociosActivos: number };
}

/** Políticas de recepción (RD8) y suscripción SaaS contratada (RD1, RD2, RD3). */
export function Configuracion() {
  const { puede } = useAuth();
  const gimnasio = useApi(() => api.get<Gimnasio>('/admin/gimnasio'));
  const [f, setF] = useState<Pick<Gimnasio, 'toleranciaAntesMin' | 'toleranciaDespuesMin' | 'politicaCuotaPendiente'> | null>(null);
  const accion = useAccion();
  if (gimnasio.cargando) return <Cargando />;
  const g = gimnasio.datos!;
  const datos = f ?? { toleranciaAntesMin: g.toleranciaAntesMin, toleranciaDespuesMin: g.toleranciaDespuesMin, politicaCuotaPendiente: g.politicaCuotaPendiente };
  const guardar = async () => {
    if (await accion.ejecutar(() => api.put('/admin/gimnasio/politicas', datos), 'Políticas guardadas.')) void gimnasio.recargar();
  };
  return (
    <div>
      <EncabezadoPagina titulo="Políticas y suscripción" descripcion={`${g.razonSocial} · CUIT ${g.cuit}`} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-2">
        <div className="tarjeta">
          <h2>Recepción</h2>
          <div className="grilla-2">
            <Campo etiqueta="Ingreso anticipado (min)" type="number" min={0} max={240} value={datos.toleranciaAntesMin} onChange={(e) => setF({ ...datos, toleranciaAntesMin: Number(e.target.value) })} />
            <Campo etiqueta="Ingreso posterior al inicio (min)" type="number" min={0} max={240} value={datos.toleranciaDespuesMin} onChange={(e) => setF({ ...datos, toleranciaDespuesMin: Number(e.target.value) })} />
          </div>
          <Selector
            etiqueta="Acción sugerida ante cuota impaga"
            value={datos.politicaCuotaPendiente}
            onChange={(e) => setF({ ...datos, politicaCuotaPendiente: e.target.value as 'BLOQUEAR' | 'AUTORIZAR' })}
            opciones={[{ valor: 'BLOQUEAR', texto: 'Bloquear el ingreso' }, { valor: 'AUTORIZAR', texto: 'Autorizar excepcionalmente' }]}
          />
          <small>El sistema advierte y el personal decide en cada caso.</small>
          {puede('CONFIGURACION', 'GESTION') && <Boton cargando={accion.enviando} onClick={guardar} style={{ marginTop: '0.8rem' }}>Guardar políticas</Boton>}
        </div>
        <div className="tarjeta">
          <h2>Suscripción</h2>
          <p><strong>{etiqueta(g.suscripcion?.tipo)}</strong> desde {fecha(g.suscripcion?.fechaInicio)}</p>
          <p>Sedes: {g.uso.sedesHabilitadas} de {g.suscripcion?.maxSedes}</p>
          <p>Socios activos: {g.uso.sociosActivos} de {g.suscripcion?.maxSociosActivos.toLocaleString('es-AR')}</p>
          <p className="tenue">Última actualización de indicadores: {fecha(g.ultimaEjecucionEtl, true)}</p>
          <small>El cobro de la suscripción se gestiona por procedimientos administrativos externos a Mercado Pago (RD19).</small>
        </div>
      </div>
    </div>
  );
}
