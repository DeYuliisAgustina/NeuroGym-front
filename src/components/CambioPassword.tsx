import { useState, type FormEvent } from 'react';
import { useToast } from '../contexts/ToastContext';
import { CampoPassword } from './CampoPassword';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import { passwordSegura } from '../validations/formularios';
import { CabeceraTarjeta, ErrorFormulario } from './ui';

/** Cambio de contraseña (por ejemplo, la temporal entregada por el gimnasio). */
export function CambioPassword() {
  const toast = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const accion = useAccion();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordSegura(nueva)) return accion.setError('La nueva contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (await accion.ejecutar(() => api.put('/auth/password', { actual, nueva }))) {
      setActual('');
      setNueva('');
      toast('Contraseña actualizada.');
    }
  };
  return (
    <section className="card">
      <CabeceraTarjeta titulo="Contraseña" subtitulo="Cambiá la contraseña temporal por una propia." />
      <form onSubmit={enviar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label>
            Contraseña actual
            <CampoPassword autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label>
            Nueva contraseña
            <CampoPassword autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn outline small" type="submit" disabled={accion.enviando}>
            Cambiar contraseña
          </button>
        </div>
      </form>
    </section>
  );
}
