import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aviso, Boton, Campo, Selector } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sesion } from '../../types';
import { validarRegistroProfesional } from '../../validations/formularios';

/** RF28: registro autónomo de nutricionistas y deportólogos con su plan Marketplace. */
export function RegistroProfesional() {
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
    <div className="contenedor" style={{ maxWidth: 560, paddingTop: '2rem' }}>
      <Link to="/">← Volver</Link>
      <div className="tarjeta" style={{ marginTop: '1rem' }}>
        <h1>Sumate al marketplace.</h1>
        <p className="tenue">Publicá tus servicios para socios Premium de los gimnasios que usan NeuroGym. Las consultas se pagan directamente a vos.</p>
        <form onSubmit={enviar} noValidate>
          <Aviso tipo="error">{accion.error}</Aviso>
          <div className="grilla-2">
            <Campo etiqueta="Nombre" value={f.nombre} onChange={cambiar('nombre')} error={errores.nombre ?? accion.errores.nombre} />
            <Campo etiqueta="Apellido" value={f.apellido} onChange={cambiar('apellido')} error={errores.apellido} />
          </div>
          <Campo etiqueta="Correo electrónico" type="email" value={f.email} onChange={cambiar('email')} error={errores.email ?? accion.errores.email} />
          <Campo etiqueta="Contraseña" type="password" value={f.password} onChange={cambiar('password')} error={errores.password ?? accion.errores.password} ayuda="Mínimo 8 caracteres, con letras y números." />
          <div className="grilla-2">
            <Selector etiqueta="Especialidad" value={f.especialidad} onChange={cambiar('especialidad')} opciones={[{ valor: 'NUTRICION', texto: 'Nutrición' }, { valor: 'DEPORTOLOGIA', texto: 'Deportología' }]} />
            <Selector
              etiqueta="Modalidad de atención"
              value={f.modalidadAtencion}
              onChange={cambiar('modalidadAtencion')}
              opciones={[
                { valor: 'ONLINE', texto: 'Online' },
                { valor: 'PRESENCIAL', texto: 'Presencial' },
                { valor: 'ONLINE_Y_PRESENCIAL', texto: 'Online y presencial' },
              ]}
            />
          </div>
          <div className="grilla-2">
            <Campo etiqueta="Valor de la consulta (ARS)" type="number" min={0} value={f.valorConsulta} onChange={cambiar('valorConsulta')} error={errores.valorConsulta} />
            <Selector
              etiqueta="Plan"
              value={f.plan}
              onChange={cambiar('plan')}
              opciones={[
                { valor: 'BASICO', texto: 'Marketplace Básico (USD 5 + 8 %)' },
                { valor: 'PROFESIONAL', texto: 'Marketplace Profesional (USD 15 + 2 %)' },
              ]}
            />
          </div>
          <Campo etiqueta="Código de referido (opcional)" value={f.codigoReferido} onChange={cambiar('codigoReferido')} />
          <label className="check">
            <input type="checkbox" checked={f.consentimientoDatos} onChange={(e) => setF({ ...f, consentimientoDatos: e.target.checked })} />
            <span>Acepto el tratamiento de mis datos personales según la Ley 25.326.</span>
          </label>
          {errores.consentimientoDatos && <p className="error-campo" style={{ color: 'var(--peligro)' }}>{errores.consentimientoDatos}</p>}
          <Boton type="submit" bloque cargando={accion.enviando} style={{ marginTop: '1rem' }}>
            Crear mi cuenta
          </Boton>
        </form>
      </div>
    </div>
  );
}
