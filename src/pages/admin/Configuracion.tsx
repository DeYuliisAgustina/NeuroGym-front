import { Icono } from '../../components/Icono';
import { BotonEnlace, CabeceraTarjeta, Encabezado, FilaDato, Insignia } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { fechaLarga } from '../../utils/formato';

interface Suscripcion {
  tipo: 'STANDARD' | 'INTELLIGENCE';
  nombre: string;
  precioMensualUsd: number;
  maxSedes: number;
  maxSociosActivos: number;
}
interface Gimnasio {
  razonSocial: string;
  fechaAlta?: string;
  suscripcion: (Suscripcion & { id: number }) | null;
  uso: { sedesHabilitadas: number; sociosActivos: number };
}

const ITEMS: Record<Suscripcion['tipo'], string[]> = {
  STANDARD: [
    'Gestión multisede, socios, turnos y QR',
    'Rutinas con IA, pagos y equipamiento',
    'Beneficios e incentivos en ambos planes del socio',
    'Marketplace e indicadores generales',
    'Señales de inactividad por reglas',
  ],
  INTELLIGENCE: [
    'Todo lo incluido en Standard',
    'Analítica avanzada de retención',
    'Estimaciones orientativas del riesgo',
    'Recomendaciones para revisión del administrador',
    'Tendencias, comparación de sedes y mayor capacidad operativa',
  ],
};

/** Suscripción SaaS del gimnasio (RF27): plan contratado, capacidad y uso. */
export function Configuracion() {
  const { puede } = useAuth();
  const gimnasio = useApi(() => api.get<Gimnasio>('/admin/gimnasio'));
  const planes = useApi(() => api.get<Suscripcion[]>('/publico/suscripciones'));
  const g = gimnasio.datos;
  const actual = g?.suscripcion?.tipo;
  const asunto = encodeURIComponent('Cambio de suscripción NeuroGym');

  return (
    <>
      <Encabezado
        ceja="SUSCRIPCIÓN DEL GIMNASIO"
        titulo="Tu plan NeuroGym"
        subtitulo="Una suscripción por empresa, para la operación de sus sedes."
        accion={actual && <Insignia color={actual === 'INTELLIGENCE' ? 'lilac' : 'neutral'}>NeuroGym {actual === 'INTELLIGENCE' ? 'Intelligence' : 'Standard'}</Insignia>}
      />
      <div className="pricing-grid two-prices">
        {planes.datos?.map((p) => {
          const contratado = p.tipo === actual;
          return (
            <article key={p.tipo} className={`pricing-card ${p.tipo === 'INTELLIGENCE' ? 'featured' : ''}`.trim()}>
              <div className="eyebrow">NEUROGYM</div>
              <h3>{p.tipo === 'INTELLIGENCE' ? 'Intelligence' : 'Standard'}</h3>
              <h2>
                USD {p.precioMensualUsd}
                <small> / mes</small>
              </h2>
              <ul className="pricing-list">
                <li>
                  <Icono n="check" />
                  Hasta {p.maxSedes} sedes y {p.maxSociosActivos.toLocaleString('es-AR')} socios activos
                </li>
                {ITEMS[p.tipo].map((t) => (
                  <li key={t}>
                    <Icono n="check" />
                    {t}
                  </li>
                ))}
              </ul>
              {contratado ? (
                <button className="btn soft" type="button" disabled>
                  <Icono n="check" />
                  <span>Suscripción actual</span>
                </button>
              ) : (
                <a className={`btn ${p.tipo === 'INTELLIGENCE' ? 'mint' : 'outline'}`} href={`mailto:ventas@neurogym.com.ar?subject=${asunto}`}>
                  <Icono n="arrow" />
                  Solicitar cambio a {p.tipo === 'INTELLIGENCE' ? 'Intelligence' : 'Standard'}
                </a>
              )}
            </article>
          );
        })}
      </div>
      <aside className="launch-banner">
        <Icono n="gift" />
        <div>
          <strong>Primer mes gratuito para los dos primeros gimnasios</strong>
          <p>Piloto: sin cargo durante la validación inicial, entre noviembre y diciembre de 2026.</p>
          <p>
            Si continúan, capacitación inicial personalizada incluida. Sin cargos por sede dentro de la capacidad del plan, por socio ni por implementación. Por encima de 6 sedes o 4.000 socios activos,
            cotización personalizada. La cuota del socio y las consultas profesionales corresponden a relaciones comerciales distintas.
          </p>
        </div>
      </aside>
      <p className="page-note">Importes de referencia en USD, cobrados en pesos al tipo de cambio vigente. El cambio de suscripción lo gestiona el equipo comercial de NeuroGym.</p>
      {g?.suscripcion && (
        <section className="card section-gap">
          <CabeceraTarjeta titulo="Uso de la suscripción" subtitulo={`${g.razonSocial}${g.fechaAlta ? ` · cliente desde el ${fechaLarga(g.fechaAlta)}` : ''}`} />
          <div className="branch-bar">
            <div className="spread">
              <strong>Sedes habilitadas</strong>
              <span>
                {g.uso.sedesHabilitadas} de {g.suscripcion.maxSedes}
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, Math.round((g.uso.sedesHabilitadas / g.suscripcion.maxSedes) * 100))}%` }} />
            </div>
          </div>
          <div className="branch-bar">
            <div className="spread">
              <strong>Socios activos</strong>
              <span>
                {g.uso.sociosActivos.toLocaleString('es-AR')} de {g.suscripcion.maxSociosActivos.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, Math.round((g.uso.sociosActivos / g.suscripcion.maxSociosActivos) * 100))}%` }} />
            </div>
          </div>
          <FilaDato etiqueta="Precio de referencia">USD {g.suscripcion.precioMensualUsd} / mes</FilaDato>
          <p className="page-note">Al alcanzar la capacidad, no se pueden habilitar más sedes ni registrar más socios activos hasta ampliar la suscripción.</p>
        </section>
      )}
      <section className="card section-gap">
        <span className="ngi-label">EL VALOR DEL ANÁLISIS ADICIONAL</span>
        <h3>Del aviso de inactividad a una revisión con contexto.</h3>
        <p>Intelligence permite revisar el historial de cada socio, interpretar señales, consultar recomendaciones y comparar la asistencia entre sedes y períodos.</p>
        {actual === 'INTELLIGENCE' && puede('INTELLIGENCE') && (
          <BotonEnlace a="/admin/analitica" estilo="outline" icono="chart">
            Abrir NeuroGym Intelligence
          </BotonEnlace>
        )}
      </section>
    </>
  );
}
