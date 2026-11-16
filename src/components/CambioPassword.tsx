import { useState } from 'react';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import { passwordSegura } from '../validations/formularios';
import { Aviso, Boton, Campo } from './ui';

/** Cambio de contraseña (por ejemplo, la temporal entregada por el gimnasio). */
export function CambioPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const accion = useAccion();
  const enviar = async () => {
    if (!passwordSegura(nueva)) return accion.setError('La nueva contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (await accion.ejecutar(() => api.put('/auth/password', { actual, nueva }), 'Contraseña actualizada.')) {
      setActual('');
      setNueva('');
    }
  };
  return (
    <div className="tarjeta" style={{ marginTop: '1rem' }}>
      <h2>Contraseña</h2>
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-2">
        <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
        <Campo etiqueta="Nueva contraseña" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </div>
      <Boton variante="secundario" cargando={accion.enviando} onClick={enviar}>
        Cambiar contraseña
      </Boton>
    </div>
  );
}
