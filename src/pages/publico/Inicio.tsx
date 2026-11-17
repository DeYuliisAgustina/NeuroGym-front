import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import hero from '../../assets/img/hero-entrenamiento.webp';
import { Icono } from '../../components/Icono';
import { ModalAyuda, ModalPrivacidad } from '../../components/ModalesInfo';
import { Boton, BotonEnlace, EnlaceTexto, Marca, Modal } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';

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

const FUNCIONES: [string, string, string, string, string, string][] = [
  ['dumbbell', '', 'Rutinas de entrenamiento', 'Prepará una rutina según tu objetivo. Podés editar ejercicios, pesos, series y repeticiones.', '/socio/rutina', 'Explorar rutinas'],
  ['calendar', 'peach', 'Turnos y reservas', 'Reservá clases y musculación, elegí la sede y organizá tu semana con la disponibilidad a la vista.', '/socio/turnos', 'Ver turnos'],
  ['gift', 'lilac', 'Puntos y beneficios', 'Tu asistencia suma puntos. Descubrí beneficios para seguir entrenando y nuevos motivos para volver.', '/socio/beneficios', 'Conocer beneficios'],
  ['wallet', '', 'Cuotas y medios de pago', 'Cuotas y comprobantes. Un 10% de descuento con débito automático. El efectivo se paga en administración.', '/socio/pagos', 'Explorar pagos'],
  ['tool', 'lilac', 'Equipamiento e incidencias', 'Reportá fallas con fotos o videos. Si una máquina no está disponible, elegí una variante para tu rutina.', '/socio/incidencias', 'Ver equipamiento'],
  ['users', 'peach', 'Consultas profesionales', 'El Plan Premium te conecta con nutricionistas y deportólogos independientes dentro de un mismo espacio.', '/socio/marketplace', 'Ver profesionales'],
];

const PREGUNTAS: [string, string][] = [
  ['¿Tengo que descargar una aplicación?', 'NeuroGym es una aplicación web pensada primero para el celular. Podés usarla en el navegador e instalarla como PWA desde el menú de tu dispositivo.'],
  ['¿Qué incluye el Plan Básico?', 'Turnos, rutinas personalizadas editables, pagos, historial y beneficios. Está incluido en la cuota mensual habitual de tu gimnasio.'],
  ['¿Qué pasa si una máquina no está disponible?', 'La plataforma te muestra una variante de ejercicio. Vos elegís si la incorporás, mantenés tu reserva o cambiás el horario. Tu turno no se modifica automáticamente.'],
  ['¿El débito automático es obligatorio?', 'Es opcional. Podés adherirte y cancelarlo desde tu perfil. El débito automático tiene un 10% de descuento sobre el total del plan.'],
  ['¿Los profesionales forman parte del gimnasio?', 'Participan de manera independiente en el marketplace C2C. Premium habilita el acceso al espacio; la consulta se acuerda con cada profesional.'],
  ['¿Quiénes pueden usar NeuroGym?', 'Socios, administradores y profesionales independientes. Cada perfil cuenta con funciones y accesos propios.'],
];

const miles = (n: number) => n.toLocaleString('es-AR');

/** Sitio público (RF1) con el mismo contenido y estructura del prototipo; los planes salen de la API. */
export function Inicio() {
  const { datos: suscripciones } = useApi(() => api.get<Suscripcion[]>('/publico/suscripciones'));
  const { datos: planes } = useApi(() => api.get<PlanMarketplace[]>('/publico/planes-marketplace'));
  const [modal, setModal] = useState<'contacto' | 'privacidad' | 'ayuda' | null>(null);
  const standard = suscripciones?.find((s) => s.tipo === 'STANDARD');
  const intelligence = suscripciones?.find((s) => s.tipo === 'INTELLIGENCE');
  const mkBasico = planes?.find((p) => p.tipo === 'BASICO');
  const mkProfesional = planes?.find((p) => p.tipo === 'PROFESIONAL');

  const tarjetaPlan = (
    titulo: string,
    precio: string | number | undefined,
    descripcion: string,
    items: string[],
    accion: React.ReactNode,
    destacada = false,
    comision?: string,
    ceja = 'SUSCRIPCIÓN SaaS B2B',
  ) => (
    <article className={`pricing-card ${destacada ? 'featured' : ''}`.trim()}>
      <div className="eyebrow">{ceja}</div>
      <h3>{titulo}</h3>
      <h2>
        USD {precio !== undefined ? Number(precio) : '…'}
        <small> / mes</small>
      </h2>
      {comision && <div className="plan-debit-price">+ {comision}% por consulta realizada y pagada</div>}
      <p>{descripcion}</p>
      <ul className="pricing-list">
        {items.map((t) => (
          <li key={t}>
            <Icono n="check" />
            {t}
          </li>
        ))}
      </ul>
      {accion}
    </article>
  );

  return (
    <div className="public-shell">
      <header className="public-nav">
        <Marca />
        <nav className="public-nav-links" aria-label="Secciones del sitio">
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#para-quien">Para quién</a>
          <a href="#planes">Planes</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <div className="public-nav-right">
          <Link to="/ingreso">Ingresar</Link>
          <BotonEnlace a="/registro" icono="arrow">
            Registrarse
          </BotonEnlace>
        </div>
      </header>
      <main id="main">
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="pill">
              <i className="dot" />
              NEUROGYM
            </div>
            <h1>
              Tu gimnasio,
              <br />
              <em>en un solo lugar.</em>
            </h1>
            <p>Tu rutina, tus turnos y tus beneficios, en un mismo lugar. Más autonomía para vos. Una gestión más simple para tu gimnasio.</p>
            <div className="public-hero-actions">
              <BotonEnlace a="/ingreso" icono="arrow">
                Ingresar
              </BotonEnlace>
              <Boton estilo="outline" onClick={() => setModal('contacto')}>
                Para gimnasios
              </Boton>
            </div>
            <div className="hero-footnote">
              <Icono n="phone" />
              Desde tu celular, donde estés. También en tu computadora.
            </div>
          </div>
          <div className="public-photo">
            <div className="photo-frame">
              <img src={hero} alt="Mujer entrenando con mancuernas en un gimnasio" width={1536} height={1024} fetchPriority="high" />
            </div>
            <div className="hero-photo-label">MIS BENEFICIOS.</div>
            <div className="floating-card card-top">
              <span className="round-icon">
                <Icono n="check" />
              </span>
              <div>
                <h4>Tu próximo turno, listo</h4>
                <p>Musculación · Tu sede</p>
              </div>
            </div>
            <div className="floating-card card-bottom">
              <div className="spread">
                <h4>Tu semana de entrenamiento</h4>
                <Icono n="activity" />
              </div>
              <p>Reservas y asistencias a la vista.</p>
              <div className="mini-progress">
                {[1, 1, 0, 1, 0, 1, 0].map((f, i) => (
                  <span key={i} className={f ? 'filled' : ''} />
                ))}
              </div>
            </div>
          </div>
        </section>
        <div className="public-proofbar">
          <span>
            <Icono n="sparkles" />
            Personalización con IA
          </span>
          <span>
            <Icono n="building" />
            Gestión multisede
          </span>
          <span>
            <Icono n="shield" />
            Asistencia mediante QR
          </span>
          <span>
            <Icono n="heart" />
            Consultas profesionales
          </span>
        </div>

        <section className="public-section" id="funcionalidades">
          <div className="public-section-head">
            <div className="eyebrow">FUNCIONES</div>
            <h2>
              Todo lo que necesitás.
              <br />
              Un mismo lugar.
            </h2>
            <p>NeuroGym conecta la experiencia del socio con la operación del gimnasio para acompañar cada entrenamiento.</p>
          </div>
          <div className="public-feature-grid">
            {FUNCIONES.map(([icono, color, titulo, texto, ruta, enlace]) => (
              <article key={titulo} className="public-feature">
                <div className={`feature-icon ${color}`.trim()}>
                  <Icono n={icono} />
                </div>
                <h3>{titulo}</h3>
                <p>{texto}</p>
                <EnlaceTexto a={ruta}>{enlace}</EnlaceTexto>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section" id="para-quien">
          <div className="audience-section">
            <div>
              <div className="eyebrow">DISTINTOS ROLES. UNA EXPERIENCIA.</div>
              <h2>Un espacio para cada perfil.</h2>
              <p>Una plataforma para cada gimnasio multisede, sus socios y un marketplace compartido de profesionales independientes.</p>
            </div>
            <div>
              {(
                [
                  ['01', 'Para vos, que entrenás', 'Organizá tus turnos, personalizá tu rutina y encontrá motivos para seguir.', '/socio', 'Recorrer mi espacio'],
                  ['02', 'Para quienes gestionan el gimnasio', 'Centralizá asistencia, cuotas y equipamiento. Entendé lo que pasa en cada sede.', '/admin/ingreso', 'Conocer la plataforma'],
                  ['03', 'Para profesionales independientes', 'Publicá tus servicios y gestioná solicitudes de socios Premium desde tu agenda.', '/profesional', 'Ver espacio profesional'],
                ] as const
              ).map(([n, titulo, texto, ruta, enlace]) => (
                <div key={n} className="audience-item">
                  <span className="audience-number">{n}</span>
                  <div>
                    <h3>{titulo}</h3>
                    <p>{texto}</p>
                    <EnlaceTexto a={ruta}>{enlace}</EnlaceTexto>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section" id="planes">
          <div className="public-section-head">
            <div className="eyebrow">CADA CLIENTE, SU PLAN</div>
            <h2>
              Una plataforma.
              <br />
              Planes para crecer.
            </h2>
            <p>El gimnasio contrata NeuroGym por empresa. Los profesionales eligen su plan Marketplace.</p>
          </div>
          <div className="price-audience">
            <span className="audience-number">01</span>
            <div>
              <h3>Para gimnasios multisede</h3>
              <p>Una suscripción por gimnasio · Sin cargos por sede dentro de la capacidad del plan, por socio ni por implementación.</p>
            </div>
          </div>
          <div className="pricing-grid two-prices">
            {tarjetaPlan(
              'NeuroGym Standard',
              standard?.precioMensualUsd,
              'Gestión integral y datos para el día a día.',
              [
                `Hasta ${standard?.maxSedes ?? 3} sedes y ${miles(standard?.maxSociosActivos ?? 1500)} socios activos`,
                'Sedes, socios, turnos y asistencia QR',
                'Cuotas, débito automático y efectivo',
                'Rutinas con IA y gestión del equipamiento',
                'Beneficios, marketplace e indicadores generales',
                'Señales de inactividad mediante reglas',
              ],
              <Boton estilo="outline" icono="arrow" onClick={() => setModal('contacto')}>
                Solicitar demostración
              </Boton>,
            )}
            {tarjetaPlan(
              'NeuroGym Intelligence',
              intelligence?.precioMensualUsd,
              'Más profundidad para acompañar la permanencia.',
              [
                `Hasta ${intelligence?.maxSedes ?? 6} sedes y ${miles(intelligence?.maxSociosActivos ?? 4000)} socios activos`,
                'Todo lo incluido en Standard',
                'Estimaciones orientativas del riesgo de abandono',
                'Recomendaciones que decide aplicar el administrador',
                'Tendencias históricas y comparación entre sedes',
                'Evolución de la retención y mayor capacidad operativa',
              ],
              <Boton estilo="mint" icono="arrow" onClick={() => setModal('contacto')}>
                Conocer Intelligence
              </Boton>,
              true,
            )}
          </div>
          <p className="pricing-note">Precios de referencia en USD; cobro en pesos al tipo de cambio vigente. Por encima de 6 sedes o 4.000 socios activos, cotización personalizada.</p>
          <aside className="launch-banner">
            <Icono n="gift" />
            <div>
              <strong>Promoción de lanzamiento</strong>
              <p>Piloto: sin cargo durante la validación inicial, entre noviembre y diciembre de 2026.</p>
              <p>Primer mes sin cargo para los dos primeros gimnasios que contraten. Si continúan, capacitación inicial personalizada incluida.</p>
            </div>
          </aside>
          <div className="price-audience">
            <span className="audience-number">02</span>
            <div>
              <h3>Para nutricionistas y deportólogos</h3>
              <p>Profesionales independientes · Un marketplace compartido entre los gimnasios clientes.</p>
            </div>
          </div>
          <div className="pricing-grid two-prices">
            {tarjetaPlan(
              'Marketplace Básico',
              mkBasico?.precioMensualUsd,
              'Una forma simple de publicar tus servicios.',
              ['Perfil y publicación de servicios', 'Solicitudes de socios Premium', 'Agenda y disponibilidad', 'Confirmación, rechazo y cancelación de turnos'],
              <BotonEnlace a="/ingreso" estilo="outline" icono="arrow">
                Ingresar como profesional
              </BotonEnlace>,
              false,
              mkBasico ? String(Number(mkBasico.porcentajeComision)) : '8',
              'MARKETPLACE C2C',
            )}
            {tarjetaPlan(
              'Marketplace Profesional',
              mkProfesional?.precioMensualUsd,
              'Más visibilidad y una comisión menor.',
              [
                'Todo lo incluido en Marketplace Básico',
                `Comisión del ${mkProfesional ? Number(mkProfesional.porcentajeComision) : 2}% en consultas realizadas y pagadas`,
                'Perfil promocionado con mayor visibilidad',
                'Gestión de la suscripción desde tu espacio',
              ],
              <BotonEnlace a="/registro?perfil=profesional" estilo="outline" icono="arrow">
                Explorar mi plan
              </BotonEnlace>,
              false,
              mkProfesional ? String(Number(mkProfesional.porcentajeComision)) : '2',
              'MARKETPLACE C2C',
            )}
          </div>
          <p className="pricing-note">
            Precios de referencia en USD. Cobro en pesos al tipo de cambio vigente. Profesionales Fundadores: primeras 5 consultas sin comisión para los primeros 20 participantes. Referidos Profesionales:
            un mes de suscripción gratuito para ambas partes cuando el referido abona su primera mensualidad. Ambas promociones son acumulables.
          </p>
          <details className="membership-details">
            <summary>¿Y los planes del socio?</summary>
            <p>Los define y cobra cada gimnasio. El Básico está incluido en la cuota; Premium agrega el acceso al marketplace. Las consultas se abonan por separado.</p>
            <div className="plan-prices">
              <article className="plan-price-card">
                <div className="spread">
                  <h3>Plan Básico</h3>
                </div>
                <p>Turnos, rutinas, pagos y beneficios.</p>
                <div className="plan-debit-price">10% de descuento con débito automático</div>
              </article>
              <article className="plan-price-card premium">
                <div className="spread">
                  <h3>Plan Premium</h3>
                </div>
                <p>Cuota del Básico + adicional Premium. Acceso a profesionales independientes.</p>
                <div className="plan-debit-price">10% de descuento con débito automático</div>
              </article>
            </div>
            <p>Cada gimnasio fija sus importes. Descuento del 10% sobre el total del Básico o Premium exclusivamente por débito automático.</p>
          </details>
        </section>

        <section className="public-section" id="preguntas">
          <div className="public-section-head">
            <div className="eyebrow">ANTES DE EMPEZAR</div>
            <h2>Resolvemos tus dudas.</h2>
          </div>
          <div className="faq-list">
            {PREGUNTAS.map(([p, r]) => (
              <details key={p}>
                <summary>{p}</summary>
                <p>{r}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="public-section">
          <div className="public-cta">
            <h2>Tu próximo entrenamiento empieza acá.</h2>
            <p>Organizá tus turnos, tu rutina y tus beneficios desde un mismo lugar.</p>
            <BotonEnlace a="/ingreso" estilo="mint" icono="arrow">
              Ingresar
            </BotonEnlace>
            <BotonEnlace a="/registro" estilo="outline" icono="arrow">
              Registrarse
            </BotonEnlace>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Marca />
        <span>Entrenamiento y gestión del gimnasio.</span>
        <div className="flex">
          <button type="button" onClick={() => setModal('privacidad')}>
            Privacidad
          </button>
          <button type="button" onClick={() => setModal('ayuda')}>
            Contacto
          </button>
          <Link to="/ingreso">Ingresar</Link>
          <Link to="/admin/ingreso">Acceso interno</Link>
        </div>
      </footer>
      <ModalContactoGimnasio abierto={modal === 'contacto'} onCerrar={() => setModal(null)} />
      <ModalPrivacidad abierto={modal === 'privacidad'} onCerrar={() => setModal(null)} />
      <ModalAyuda abierto={modal === 'ayuda'} onCerrar={() => setModal(null)} />
    </div>
  );
}

/** "Conectemos tu gimnasio.": arma un correo para el equipo comercial con el cliente de correo del usuario. */
function ModalContactoGimnasio({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [f, setF] = useState({ nombre: '', email: '', sedes: '2 a 3 sedes', consulta: '' });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const cuerpo = `Gimnasio: ${f.nombre}\nCorreo: ${f.email}\nSedes: ${f.sedes}\n\n${f.consulta}`;
    window.location.href = `mailto:ventas@neurogym.com.ar?subject=${encodeURIComponent('Demostración de NeuroGym')}&body=${encodeURIComponent(cuerpo)}`;
    onCerrar();
  };
  return (
    <Modal titulo="Conectemos tu gimnasio." subtitulo="Contanos sobre tus sedes para preparar una demostración." abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <label className="wide">
            Nombre del gimnasio
            <input required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label className="wide">
            Correo electrónico
            <input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
          <label className="wide">
            Cantidad de sedes
            <select value={f.sedes} onChange={(e) => setF({ ...f, sedes: e.target.value })}>
              <option>2 a 3 sedes</option>
              <option>4 a 6 sedes</option>
              <option>Más de 6 sedes</option>
            </select>
          </label>
          <label className="wide">
            Tu consulta
            <textarea required minLength={5} value={f.consulta} onChange={(e) => setF({ ...f, consulta: e.target.value })} />
          </label>
        </div>
        <p className="page-note">Se abrirá tu correo con la consulta lista para enviar a ventas@neurogym.com.ar.</p>
        <div className="form-actions">
          <button className="btn primary" type="submit">
            Registrar consulta
          </button>
        </div>
      </form>
    </Modal>
  );
}
