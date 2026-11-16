import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero } from '../../utils/formato';

interface Suscripcion {
  tipo: string;
  nombre: string;
  precioMensualUsd: number;
  maxSedes: number;
  maxSociosActivos: number;
  analiticaAvanzada: boolean;
}
interface PlanMarketplace {
  id: number;
  tipo: 'BASICO' | 'PROFESIONAL';
  precioMensualUsd: string;
  porcentajeComision: string;
  perfilPromocionado: boolean;
}

const FUNCIONES = [
  ['Turnos y asistencia', 'Reservas por sede con cupos y registro de ingreso con QR dinámico, sin molinetes.'],
  ['Cuotas y pagos', 'Pago único o débito automático con Mercado Pago, 10 % de descuento por débito y comprobantes por WhatsApp.'],
  ['Rutinas con IA', 'Rutinas personalizadas según objetivo, experiencia y días disponibles, con variantes ante equipos no disponibles.'],
  ['Equipamiento', 'Inventario por sede, incidencias con fotos o videos, mantenimientos y alertas de service.'],
  ['Retención', 'Beneficios por constancia, señales de posible abandono e incentivos aprobados por el gimnasio.'],
  ['Marketplace', 'Los socios Premium consultan nutricionistas y deportólogos independientes.'],
];

/** Sitio público (RF1): propuesta, suscripciones para gimnasios y planes para profesionales. */
export function Inicio() {
  const { datos: suscripciones } = useApi(() => api.get<Suscripcion[]>('/publico/suscripciones'));
  const { datos: planes } = useApi(() => api.get<PlanMarketplace[]>('/publico/planes-marketplace'));
  return (
    <>
      <header className="sitio-barra">
        <Link to="/" className="marca">
          NeuroGym
        </Link>
        <nav className="fila">
          <Link to="/ingreso" className="btn btn-secundario btn-chico">
            Ingresar
          </Link>
          <Link to="/admin/ingreso" className="btn btn-texto btn-chico">
            Acceso gimnasios
          </Link>
        </nav>
      </header>
      <section className="heroe">
        <h1>
          Tu gimnasio, <em>en un solo lugar.</em>
        </h1>
        <p>NeuroGym centraliza turnos, asistencia, pagos, rutinas y equipamiento de todas tus sedes, y te ayuda a que tus socios sigan entrenando.</p>
        <div className="fila">
          <a href="#planes" className="btn btn-acento">
            Ver suscripciones
          </a>
          <Link to="/profesionales/registro" className="btn btn-secundario">
            Soy profesional
          </Link>
        </div>
      </section>
      <main className="contenedor pila">
        <section>
          <h2>Todo lo que necesitás.</h2>
          <div className="grilla-3">
            {FUNCIONES.map(([titulo, texto]) => (
              <article key={titulo} className="tarjeta">
                <h3>{titulo}</h3>
                <p className="tenue">{texto}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="planes">
          <h2>Suscripciones para gimnasios</h2>
          <p className="tenue">Una suscripción por empresa, sin cargos por sede, por socio ni por implementación.</p>
          <div className="grilla-3">
            {suscripciones?.map((s) => (
              <article key={s.tipo} className={`tarjeta ${s.analiticaAvanzada ? 'tarjeta-oscura' : ''}`}>
                <h3>{s.nombre}</h3>
                <div className="precio">USD {s.precioMensualUsd}</div>
                <small>por mes</small>
                <ul>
                  <li>Hasta {s.maxSedes} sedes</li>
                  <li>Hasta {s.maxSociosActivos.toLocaleString('es-AR')} socios activos</li>
                  <li>Gestión, beneficios, notificaciones y marketplace</li>
                  {s.analiticaAvanzada && <li>Analítica avanzada de retención y reporte en Excel</li>}
                </ul>
              </article>
            ))}
            <article className="tarjeta">
              <h3>A medida</h3>
              <div className="precio">Cotización</div>
              <p className="tenue">Para gimnasios que superan la capacidad de NeuroGym Intelligence.</p>
            </article>
          </div>
        </section>
        <section>
          <h2>Planes para profesionales</h2>
          <div className="grilla-2">
            {planes?.map((p) => (
              <article key={p.id} className="tarjeta">
                <h3>Marketplace {p.tipo === 'BASICO' ? 'Básico' : 'Profesional'}</h3>
                <div className="precio">USD {Number(p.precioMensualUsd)}</div>
                <small>
                  por mes + {Number(p.porcentajeComision)} % por consulta realizada y pagada
                  {p.perfilPromocionado ? ' · perfil promocionado' : ''}
                </small>
              </article>
            ))}
          </div>
          <p className="tenue">Los socios pagan la consulta directamente al profesional. Ejemplo de comisión sobre {dinero(30000)}: {dinero(2400)} (8 %).</p>
        </section>
        <footer className="tenue" style={{ padding: '2rem 0' }}>
          NeuroGym · Trabajo Final de Ingeniería en Sistemas Informáticos (UAI). Los datos personales se tratan según la Ley 25.326.
        </footer>
      </main>
    </>
  );
}
