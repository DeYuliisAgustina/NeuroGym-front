import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CampoPassword } from '../../components/CampoPassword';
import { Icono } from '../../components/Icono';
import { ErrorFormulario } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sesion } from '../../types';
import { validarRegistroProfesional, validarRegistroSocio } from '../../validations/formularios';
import { ArteAcceso, TarjetasPerfil } from './Ingreso';

/**
 * "Sumate a NeuroGym." Los profesionales se registran solos (RF28). El socio
 * también se registra solo (RF2) y su gimnasio confirma el alta antes del primer ingreso.
 */
export function Registro() {
  const [parametros] = useSearchParams();
  const [perfil, setPerfil] = useState<'socio' | 'profesional'>(parametros.get('perfil') === 'profesional' ? 'profesional' : 'socio');
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
          <h1>Sumate a NeuroGym.</h1>
          <p>Elegí tu perfil y creá tu cuenta.</p>
          <TarjetasPerfil valor={perfil} onCambiar={setPerfil} />
          {perfil === 'socio' ? <FormularioSocio /> : <FormularioProfesional />}
          <div className="auth-bottom">
            ¿Ya tenés una cuenta?
            <Link to="/ingreso">Ingresar</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

interface OpcionGimnasio {
  id: number;
  razonSocial: string;
  sedes: { id: number; nombre: string; direccion: string }[];
}

/** RF2: el socio completa sus datos; la cuenta se activa cuando el gimnasio confirma el alta. */
function FormularioSocio() {
  const opciones = useApi(() => api.get<OpcionGimnasio[]>('/auth/registro/opciones'));
  const [f, setF] = useState({ email: '', password: '', nombre: '', apellido: '', telefono: '', gimnasioId: '', sedeId: '', consentimientoDatos: false });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState<string | null>(null);
  const accion = useAccion();
  const cambiar = (campo: string) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });
  const error = (campo: string) => {
    const texto = errores[campo] ?? accion.errores[campo];
    return texto ? <small role="alert">{texto}</small> : null;
  };
  const gimnasio = opciones.datos?.find((g) => String(g.id) === f.gimnasioId);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const v = validarRegistroSocio(f);
    setErrores(v);
    if (Object.keys(v).length) return;
    const { gimnasioId: _gimnasio, ...datos } = f;
    const r = await accion.ejecutar(() => api.post<{ mensaje: string }>('/auth/registro', { ...datos, sedeId: Number(f.sedeId) }));
    if (r) setEnviado(r.mensaje);
  };

  if (enviado) {
    return (
      <div className="notice-list" style={{ marginBottom: 24 }} role="status">
        <div className="notice">
          <Icono n="check" />
          <div>
            <h4>¡Listo, {f.nombre}!</h4>
            <p>{enviado}</p>
          </div>
        </div>
        <div className="notice">
          <Icono n="sparkles" />
          <div>
            <h4>En tu primer ingreso</h4>
            <p>Elegís tu objetivo, tu experiencia y tus días de entrenamiento para generar tu primera rutina.</p>
          </div>
        </div>
        <Link className="btn primary full" to="/ingreso">
          Ir a ingresar
          <Icono n="arrow" />
        </Link>
      </div>
    );
  }

  return (
    <form id="register-socio-form" onSubmit={enviar} noValidate>
      <ErrorFormulario>{accion.error ?? opciones.error}</ErrorFormulario>
      <div className="form-grid">
        <label>
          Nombre
          <input value={f.nombre} onChange={cambiar('nombre')} autoComplete="given-name" />
          {error('nombre')}
        </label>
        <label>
          Apellido
          <input value={f.apellido} onChange={cambiar('apellido')} autoComplete="family-name" />
          {error('apellido')}
        </label>
      </div>
      <label>
        Correo electrónico
        <input type="email" placeholder="tu@email.com" value={f.email} onChange={cambiar('email')} autoComplete="email" />
        {error('email')}
      </label>
      <label>
        Contraseña
        <CampoPassword value={f.password} onChange={cambiar('password')} autoComplete="new-password" />
        {error('password') ?? <small>Mínimo 8 caracteres, con letras y números.</small>}
      </label>
      <label>
        Teléfono (WhatsApp)
        <input type="tel" placeholder="341 555-1234" value={f.telefono} onChange={cambiar('telefono')} autoComplete="tel" />
        {error('telefono')}
      </label>
      <div className="form-grid">
        <label>
          Gimnasio
          <select value={f.gimnasioId} onChange={(e) => setF({ ...f, gimnasioId: e.target.value, sedeId: '' })} disabled={opciones.cargando}>
            <option value="">{opciones.cargando ? 'Cargando…' : 'Elegí tu gimnasio'}</option>
            {opciones.datos?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.razonSocial}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sede
          <select value={f.sedeId} onChange={cambiar('sedeId')} disabled={!gimnasio}>
            <option value="">Elegí tu sede</option>
            {gimnasio?.sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.direccion}
              </option>
            ))}
          </select>
          {error('sedeId')}
        </label>
      </div>
      <label className="check-field">
        <input type="checkbox" checked={f.consentimientoDatos} onChange={(e) => setF({ ...f, consentimientoDatos: e.target.checked })} />
        Acepto el tratamiento de mis datos para gestionar mi cuenta en el gimnasio. Puedo consultar las finalidades en Privacidad.
      </label>
      {error('consentimientoDatos')}
      <button className="btn primary full" type="submit" disabled={accion.enviando} aria-busy={accion.enviando || undefined}>
        {accion.enviando ? 'Enviando tus datos…' : 'Registrarse'}
        <Icono n="arrow" />
      </button>
    </form>
  );
}

function FormularioProfesional() {
  const { aplicarSesion } = useAuth();
  const navegar = useNavigate();
  const [f, setF] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    especialidad: 'NUTRICION',
    modalidadAtencion: 'ONLINE_Y_PRESENCIAL',
    valorConsulta: '',
    plan: 'BASICO',
    codigoReferido: '',
    consentimientoDatos: false,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const accion = useAccion();
  const cambiar = (campo: string) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });
  const error = (campo: string) => {
    const texto = errores[campo] ?? accion.errores[campo];
    return texto ? <small role="alert">{texto}</small> : null;
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const v = validarRegistroProfesional(f);
    setErrores(v);
    if (Object.keys(v).length) return;
    const r = await accion.ejecutar(() =>
      api.post<{ token: string; usuario: Sesion }>('/profesional/registro', {
        ...f,
        valorConsulta: Number(f.valorConsulta),
        codigoReferido: f.codigoReferido || undefined,
      }),
    );
    if (r) {
      aplicarSesion(r.token, r.usuario);
      navegar('/profesional/perfil');
    }
  };

  return (
    <form id="register-form" onSubmit={enviar} noValidate>
      <ErrorFormulario>{accion.error}</ErrorFormulario>
      <div className="form-grid">
        <label>
          Nombre
          <input value={f.nombre} onChange={cambiar('nombre')} autoComplete="given-name" />
          {error('nombre')}
        </label>
        <label>
          Apellido
          <input value={f.apellido} onChange={cambiar('apellido')} autoComplete="family-name" />
          {error('apellido')}
        </label>
      </div>
      <label>
        Correo electrónico
        <input type="email" placeholder="tu@email.com" value={f.email} onChange={cambiar('email')} autoComplete="email" />
        {error('email')}
      </label>
      <label>
        Contraseña
        <CampoPassword value={f.password} onChange={cambiar('password')} autoComplete="new-password" />
        {error('password') ?? <small>Mínimo 8 caracteres, con letras y números.</small>}
      </label>
      <div className="form-grid">
        <label>
          Especialidad
          <select value={f.especialidad} onChange={cambiar('especialidad')}>
            <option value="NUTRICION">Nutricionista</option>
            <option value="DEPORTOLOGIA">Deportólogo/a</option>
          </select>
        </label>
        <label>
          Modalidad
          <select value={f.modalidadAtencion} onChange={cambiar('modalidadAtencion')}>
            <option value="ONLINE">Online</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="ONLINE_Y_PRESENCIAL">Online y presencial</option>
          </select>
        </label>
        <label>
          Valor de la consulta (ARS)
          <input type="number" min={0} value={f.valorConsulta} onChange={cambiar('valorConsulta')} />
          {error('valorConsulta')}
        </label>
        <label>
          Plan Marketplace
          <select value={f.plan} onChange={cambiar('plan')}>
            <option value="BASICO">Básico · USD 5 + 8%</option>
            <option value="PROFESIONAL">Profesional · USD 15 + 2%</option>
          </select>
        </label>
      </div>
      <label>
        Código de referido (opcional)
        <input value={f.codigoReferido} onChange={cambiar('codigoReferido')} />
      </label>
      <label className="check-field">
        <input type="checkbox" checked={f.consentimientoDatos} onChange={(e) => setF({ ...f, consentimientoDatos: e.target.checked })} />
        Acepto el tratamiento de mis datos para gestionar mi cuenta y los servicios que publico. Puedo consultar las finalidades en Privacidad.
      </label>
      {error('consentimientoDatos')}
      <button className="btn primary full" type="submit" disabled={accion.enviando} aria-busy={accion.enviando || undefined}>
        {accion.enviando ? 'Creando tu cuenta…' : 'Registrarse'}
        <Icono n="arrow" />
      </button>
    </form>
  );
}
