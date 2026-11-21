import { useState, type InputHTMLAttributes } from 'react';
import { Icono } from './Icono';

/** Campo de contraseña con el botón del ojo para mostrarla u ocultarla. */
export function CampoPassword(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="campo-password">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="ver-password"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Icono n={visible ? 'eyeOff' : 'eye'} />
      </button>
    </span>
  );
}
