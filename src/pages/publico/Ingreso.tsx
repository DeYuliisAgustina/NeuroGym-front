import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Aviso, Boton, Campo } from '../../components/ui';
import { inicioDe, useAuth } from '../../contexts/AuthContext';
import { useAccion } from '../../hooks/useApi';
import { validarIngreso } from '../../validations/formularios';

/**
 * Ingreso público (RF2) para socios y profesionales; con `administrativo`,
 * acceso separado del personal del gimnasio (RF14).
 */
export function Ingreso({ administrativo = false }: { administrativo?: boolean }) {
  const { iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const { enviando, error, ejecutar } = useAccion();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const validacion = validarIngreso({ email, password });
    setErrores(validacion);
    if (Object.keys(validacion).length) return;
    const sesion = await ejecutar(() => iniciarSesion(email, password, administrativo));
    if (sesion) navegar((ubicacion.state as { desde?: string })?.desde ?? inicioDe(sesion), { replace: true });
  };

  return (
    <div className="contenedor" style={{ maxWidth: 440, paddingTop: '2.5rem' }}>
      <Link to="/" className="marca" style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--verde)', textDecoration: 'none' }}>
        NeuroGym
      </Link>
      <div className="tarjeta" style={{ marginTop: '1rem' }}>
        <h1>{administrativo ? 'Acceso del gimnasio' : 'Qué bueno verte de nuevo.'}</h1>
        <p className="tenue">{administrativo ? 'Ingreso exclusivo para el personal administrativo.' : 'Ingresá como socio o profesional.'}</p>
        <form onSubmit={enviar} noValidate>
          <Aviso tipo="error">{error}</Aviso>
          <Campo etiqueta="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} />
          <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password} />
          <Boton type="submit" bloque cargando={enviando}>
            Ingresar
          </Boton>
        </form>
        <hr className="separador" />
        {administrativo ? (
          <Link to="/ingreso">Soy socio o profesional</Link>
        ) : (
          <div className="pila">
            <small>Si sos socio, tu gimnasio crea tu cuenta y te entrega una contraseña temporal.</small>
            <div className="fila-entre">
              <Link to="/profesionales/registro">Registrarme como profesional</Link>
              <Link to="/admin/ingreso">Acceso del gimnasio</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
