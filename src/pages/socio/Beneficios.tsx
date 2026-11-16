import { useState } from 'react';
import { Aviso, Boton, Cargando, EncabezadoPagina, Kpi, Pestanas, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { fecha } from '../../utils/formato';

interface Resumen {
  saldoPuntos: number;
  diasConstanciaMes: number;
  bonificacionPremium: { hasta: string; porcentaje: string } | null;
  beneficios: { id: number; nombre: string; descripcion: string; costoPuntos: number; vigenciaDias: number }[];
  canjes: { id: number; fecha: string; venceEl: string; vigente: boolean; puntosUtilizados: number; beneficio: { nombre: string } }[];
}

/** Mis beneficios (RF11): puntos por constancia (RD9) y canjes. */
export function Beneficios() {
  const [vista, setVista] = useState<'disponibles' | 'canjes'>('disponibles');
  const resumen = useApi(() => api.get<Resumen>('/socio/beneficios'));
  const accion = useAccion();
  if (resumen.cargando) return <Cargando />;
  if (resumen.error) return <Aviso tipo="error">{resumen.error}</Aviso>;
  const r = resumen.datos!;
  const canjear = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Canjear "${nombre}"?`)) return;
    if (await accion.ejecutar(() => api.post(`/socio/beneficios/${id}/canje`), `Canjeaste "${nombre}".`)) void resumen.recargar();
  };
  return (
    <div>
      <EncabezadoPagina titulo="Canjeá tus puntos." descripcion="Sumás puntos por cada día con asistencia confirmada (uno por día)." />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-3" style={{ marginBottom: '1rem' }}>
        <Kpi titulo="Mis puntos" valor={r.saldoPuntos} />
        <Kpi titulo="Días de constancia este mes" valor={r.diasConstanciaMes} />
        <Kpi titulo="Premium bonificado" valor={r.bonificacionPremium ? `Hasta ${fecha(r.bonificacionPremium.hasta)}` : '—'} />
      </div>
      <Pestanas valor={vista} onCambiar={setVista} opciones={[{ valor: 'disponibles', texto: 'Beneficios disponibles' }, { valor: 'canjes', texto: `Mis canjes (${r.canjes.length})` }]} />
      {vista === 'disponibles' && (
        <div className="grilla-3">
          {r.beneficios.length === 0 && <Vacio>Tu gimnasio todavía no publicó beneficios.</Vacio>}
          {r.beneficios.map((b) => (
            <div key={b.id} className="tarjeta pila">
              <h3>{b.nombre}</h3>
              <p className="tenue">{b.descripcion}</p>
              <div className="fila-entre">
                <strong>{b.costoPuntos} puntos</strong>
                <Boton chico disabled={r.saldoPuntos < b.costoPuntos} onClick={() => canjear(b.id, b.nombre)}>
                  {r.saldoPuntos < b.costoPuntos ? `Te faltan ${b.costoPuntos - r.saldoPuntos}` : 'Canjear'}
                </Boton>
              </div>
              <small>Vigencia: {b.vigenciaDias} días desde el canje</small>
            </div>
          ))}
        </div>
      )}
      {vista === 'canjes' && (
        <div className="tarjeta">
          {r.canjes.length === 0 && <Vacio>Todavía no canjeaste beneficios.</Vacio>}
          {r.canjes.map((c) => (
            <div key={c.id} className="fila-entre" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--borde)' }}>
              <div>
                <strong>{c.beneficio.nombre}</strong>
                <div className="tenue">
                  Canjeado el {fecha(c.fecha)} · {c.puntosUtilizados} puntos
                </div>
              </div>
              <span className={`etiqueta ${c.vigente ? 'etiqueta-ok' : ''}`}>{c.vigente ? `Vence ${fecha(c.venceEl)}` : 'Vencido'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
