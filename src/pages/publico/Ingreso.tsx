import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import hero from '../../assets/img/hero-entrenamiento.webp';
import { CampoPassword } from '../../components/CampoPassword';
import { Icono } from '../../components/Icono';
import { Boton, ErrorFormulario, Marca, Modal } from '../../components/ui';
import { inicioDe, useAuth } from '../../contexts/AuthContext';
import { useAccion } from '../../hooks/useApi';
import { api } from '../../services/api';
import { validarIngreso } from '../../validations/formularios';

/** Panel izquierdo con la foto y el mensaje (auth-art del prototipo). */
export function ArteAcceso({ ceja, children, bajada }: { ceja?: string; children: ReactNode; bajada: string }) {
  return (
    <aside className="auth-art">
      <img className="auth-photo" src={hero} alt="" width={1536} height={1024} />
      <Marca />
      <div className="auth-art-copy">
        {ceja && (
          <div className="eyebrow" style={{ color: '#a0ba8e', marginBottom: 18 }}>
            {ceja}
          </div>
        )}
        <h2>{children}</h2>
        <p>{bajada}</p>
      </div>
    </aside>
  );
}

/** Selector Socio / Profesional (role-cards del prototipo). */
export function TarjetasPerfil({ valor, onCambiar }: { valor: 'socio' | 'profesional'; onCambiar: (v: 'socio' | 'profesional') => void }) {
  return (
    <div className="role-cards">
      {(
        [
          ['socio', 'Socio', 'dumbbell'],
          ['profesional', 'Profesional', 'users'],
        ] as const
      ).map(([v, texto, icono]) => (
        <button key={v} type="button" className={`role-card ${valor === v ? 'active' : ''}`.trim()} aria-pressed={valor === v} onClick={() => onCambiar(v)}>
          <Icono n={icono} />
          {texto}
        </button>
      ))}
    </div>
  );
}

/**
 * Ingreso público (RF2) para socios y profesionales; con `administrativo`,
 * acceso separado del personal del gimnasio (RF14, "Acceso interno" del prototipo).
 */
export function Ingreso({ administrativo = false }: { administrativo?: boolean }) {
  const { iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [perfil, setPerfil] = useState<'socio' | 'profesional'>('socio');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [recuperar, setRecuperar] = useState(false);
  const { enviando, error, ejecutar } = useAccion();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const validacion = validarIngreso({ email, password });
    setErrores(validacion);
    if (Object.keys(validacion).length) return;
    const sesion = await ejecutar(() => iniciarSesion(email, password, administrativo));
    if (!sesion) return;
    // Cada cuenta entra a su propio espacio, más allá del perfil marcado.
    let destino = (ubicacion.state as { desde?: string })?.desde ?? inicioDe(sesion);
    if (sesion.tipo === 'SOCIO' && !(ubicacion.state as { desde?: string })?.desde) {
      // Primer ingreso del socio: se le ofrece personalizar su rutina (bienvenida).
      const p = await api.get<{ preferencia: unknown }>('/socio/perfil').catch(() => null);
      if (p && !p.preferencia) destino = '/socio/bienvenida';
    }
    navegar(destino, { replace: true });
  };

  const formulario = (
    <form onSubmit={enviar} noValidate>
      <ErrorFormulario>{error}</ErrorFormulario>
      <label>
        Correo electrónico
        <input name="email" type="email" placeholder={administrativo ? 'nombre@tugimnasio.com' : 'tu@email.com'} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errores.email || undefined} />
        {errores.email && <small role="alert">{errores.email}</small>}
      </label>
      <label>
        Contraseña
        <CampoPassword name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errores.password || undefined} />
        {errores.password && <small role="alert">{errores.password}</small>}
      </label>
      {!administrativo && (
        <div className="spread">
          <label className="check-field">
            <input type="checkbox" defaultChecked />
            Recordar mi acceso
          </label>
          <button type="button" className="text-link" onClick={() => setRecuperar(true)}>
            Olvidé mi contraseña
          </button>
        </div>
      )}
      <button className="btn primary full" type="submit" disabled={enviando} aria-busy={enviando || undefined}>
        {enviando ? 'Ingresando…' : administrativo ? 'Ingresar al portal interno' : 'Ingresar'}
        <Icono n="arrow" />
      </button>
    </form>
  );

  if (administrativo) {
    return (
      <div className="auth-page staff-login">
        <ArteAcceso
          ceja="NEUROGYM · ACCESO INTERNO"
          bajada="Un espacio exclusivo para el personal del gimnasio."
        >
          Tu equipo.
          <br />
          Tus sedes.
          <br />
          Una gestión conectada.
        </ArteAcceso>
        <main id="main" className="auth-form-wrap">
          <div className="auth-form">
            <span className="badge neutral">
              <i className="dot" />
              Portal del personal
            </span>
            <h1 style={{ marginTop: 22 }}>Administración y recepción.</h1>
            <p>Ingresá con una cuenta habilitada por el administrador general.</p>
            {formulario}
            <p className="auth-note">
              El alta de personal se realiza desde Usuarios y permisos.
              <br />
              <Link className="text-link" to="/ingreso">
                Soy socio o profesional
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <ArteAcceso ceja="NEUROGYM · ROSARIO" bajada="Tu rutina, tus turnos y tus beneficios, en un mismo espacio.">
        Cada entrenamiento.
        <br />
        Cada paso.
        <br />
        Un poco más cerca.
      </ArteAcceso>
      <main id="main" className="auth-form-wrap">
        <div className="auth-form">
          <Link className="auth-back" to="/">
            <Icono n="back" />
            Volver a NeuroGym
          </Link>
          <h1>Qué bueno verte de nuevo.</h1>
          <p>Ingresá a tu espacio y seguí a tu ritmo.</p>
          <TarjetasPerfil valor={perfil} onCambiar={setPerfil} />
          {formulario}
          <div className="auth-bottom">
            ¿No tenés una cuenta?
            <Link to={`/registro?perfil=${perfil}`}>Registrarse</Link>
          </div>
        </div>
      </main>
      <Modal titulo="Recuperá tu acceso." subtitulo="Te ayudamos a volver a ingresar." abierto={recuperar} onCerrar={() => setRecuperar(false)} pie={<Boton onClick={() => setRecuperar(false)}>Entendido</Boton>}>
        <div className="notice-list">
          <div className="notice">
            <Icono n="building" />
            <div>
              <h4>Si sos socio</h4>
              <p>Acercate a la recepción de tu sede: el gimnasio te entrega una nueva contraseña temporal para tu cuenta.</p>
            </div>
          </div>
          <div className="notice">
            <Icono n="message" />
            <div>
              <h4>Si sos profesional</h4>
              <p>
                Escribinos a{' '}
                <a className="text-link" href="mailto:ayuda@neurogym.com.ar">
                  ayuda@neurogym.com.ar
                </a>{' '}
                desde el correo de tu cuenta.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
