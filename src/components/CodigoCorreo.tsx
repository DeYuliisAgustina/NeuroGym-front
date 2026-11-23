import { useEffect, useState, type FormEvent } from 'react';
import { AyudaPassword } from './AyudaPassword';
import { CampoPassword } from './CampoPassword';
import { Icono } from './Icono';
import { ErrorFormulario } from './ui';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import { emailValido, passwordSegura } from '../validations/formularios';

/** Segundos que hay que esperar para pedir otro código (la misma espera que el backend). */
export const ESPERA_REENVIO_SEG = 60;

export const codigoValido = (codigo: string) => /^\d{6}$/.test(codigo.trim());

/** Cuenta regresiva en segundos; `reiniciar` vuelve a empezar. */
function useCuentaRegresiva(inicial: number) {
  const [segundos, setSegundos] = useState(inicial);
  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);
  return [segundos, () => setSegundos(ESPERA_REENVIO_SEG)] as const;
}

/** Campo de 6 dígitos: solo acepta números y permite pegar el código del correo. */
function CampoCodigo({ valor, onCambiar, error }: { valor: string; onCambiar: (v: string) => void; error?: string }) {
  return (
    <label>
      Código de 6 dígitos
      <input
        className="campo-codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={6}
        value={valor}
        onChange={(e) => onCambiar(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={!!error || undefined}
      />
      {error ? <small role="alert">{error}</small> : <small>Si no lo ves, revisá la carpeta de spam o de correo no deseado.</small>}
    </label>
  );
}

/** «¿No te llegó?»: reenvía el código cuando terminó la espera. */
function Reenviar({ onReenviar }: { onReenviar: () => Promise<unknown> }) {
  const [segundos, reiniciar] = useCuentaRegresiva(ESPERA_REENVIO_SEG);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const reenviar = async () => {
    setEnviando(true);
    setAviso(null);
    const ok = await onReenviar();
    setEnviando(false);
    if (ok) {
      reiniciar();
      setAviso('Te enviamos un código nuevo.');
    }
  };
  return (
    <p className="auth-note" style={{ marginTop: 12 }}>
      ¿No te llegó?{' '}
      {segundos > 0 ? (
        <span>Podés pedir otro en {segundos} s.</span>
      ) : (
        <button type="button" className="text-link" onClick={reenviar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Reenviar código'}
        </button>
      )}
      {aviso && (
        <>
          <br />
          <span role="status">{aviso}</span>
        </>
      )}
    </p>
  );
}

/**
 * Confirmación del correo al registrarse: la persona escribe el código que le llegó.
 * Se usa en el registro del socio y del profesional, y al ingresar sin haberlo confirmado.
 */
export function VerificacionCorreo({ email, onVerificado, textoBoton = 'Confirmar correo' }: { email: string; onVerificado: () => Promise<void> | void; textoBoton?: string }) {
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState<string>();
  const accion = useAccion();
  const reenvio = useAccion();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!codigoValido(codigo)) return setErrorCodigo('Ingresá el código de 6 dígitos');
    setErrorCodigo(undefined);
    // Si falla lo que sigue (por ejemplo, el ingreso), se puede reintentar: el correo ya verificado no cambia.
    await accion.ejecutar(async () => {
      await api.post('/auth/verificacion', { email, codigo });
      await onVerificado();
    });
  };

  return (
    <form onSubmit={enviar} noValidate>
      <div className="notice-list" style={{ marginBottom: 20 }}>
        <div className="notice">
          <Icono n="message" />
          <div>
            <h4>Confirmá tu correo</h4>
            <p>
              Te enviamos un código de 6 dígitos a <strong>{email}</strong>. Vence en 15 minutos.
            </p>
          </div>
        </div>
      </div>
      <ErrorFormulario>{(accion.errores.codigo ? null : accion.error) ?? reenvio.error}</ErrorFormulario>
      <CampoCodigo valor={codigo} onCambiar={setCodigo} error={errorCodigo ?? accion.errores.codigo} />
      <button className="btn primary full" type="submit" disabled={accion.enviando} aria-busy={accion.enviando || undefined}>
        {accion.enviando ? 'Confirmando…' : textoBoton}
        <Icono n="arrow" />
      </button>
      <Reenviar onReenviar={() => reenvio.ejecutar(() => api.post('/auth/verificacion/codigo', { email }))} />
    </form>
  );
}

/**
 * «Olvidé mi contraseña»: pide el correo, envía un código y con él se elige
 * una contraseña nueva. No revela si el correo tiene una cuenta.
 */
export function RecuperarPassword({ emailInicial = '', onListo }: { emailInicial?: string; onListo: (email: string) => void }) {
  const [paso, setPaso] = useState<'email' | 'codigo' | 'listo'>('email');
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const accion = useAccion();
  const reenvio = useAccion();

  const pedirCodigo = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValido(email)) return setErrores({ email: 'Ingresá un correo válido' });
    setErrores({});
    if (await accion.ejecutar(() => api.post('/auth/recuperacion', { email: email.trim() }))) setPaso('codigo');
  };

  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!codigoValido(codigo)) v.codigo = 'Ingresá el código de 6 dígitos';
    if (!passwordSegura(nueva) || nueva.length > 72) v.nueva = 'Mínimo 8 caracteres, con letras y números';
    setErrores(v);
    if (Object.keys(v).length) return;
    if (await accion.ejecutar(() => api.post('/auth/recuperacion/confirmacion', { email: email.trim(), codigo, nueva }))) setPaso('listo');
  };

  if (paso === 'listo') {
    return (
      <div className="notice-list" role="status">
        <div className="notice">
          <Icono n="check" />
          <div>
            <h4>Listo, cambiaste tu contraseña</h4>
            <p>Ya podés ingresar con la contraseña nueva.</p>
          </div>
        </div>
        <button className="btn primary full" type="button" onClick={() => onListo(email.trim())}>
          Ingresar
          <Icono n="arrow" />
        </button>
      </div>
    );
  }

  if (paso === 'email') {
    return (
      <form onSubmit={pedirCodigo} noValidate>
        <p>Escribí el correo de tu cuenta y te enviamos un código para elegir una contraseña nueva.</p>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <label>
          Correo electrónico
          <input type="email" placeholder="tu@email.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errores.email || undefined} />
          {errores.email && <small role="alert">{errores.email}</small>}
        </label>
        <button className="btn primary full" type="submit" disabled={accion.enviando} aria-busy={accion.enviando || undefined}>
          {accion.enviando ? 'Enviando…' : 'Enviar código'}
          <Icono n="arrow" />
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={cambiar} noValidate>
      <p>
        Si <strong>{email.trim()}</strong> tiene una cuenta en NeuroGym, te enviamos un código de 6 dígitos. Vence en 15 minutos.
      </p>
      <ErrorFormulario>{(accion.errores.codigo || accion.errores.nueva ? null : accion.error) ?? reenvio.error}</ErrorFormulario>
      <CampoCodigo valor={codigo} onCambiar={setCodigo} error={errores.codigo ?? accion.errores.codigo} />
      <label>
        Contraseña nueva
        <CampoPassword autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <AyudaPassword valor={nueva} error={errores.nueva ?? accion.errores.nueva} />
      </label>
      <button className="btn primary full" type="submit" disabled={accion.enviando} aria-busy={accion.enviando || undefined}>
        {accion.enviando ? 'Guardando…' : 'Cambiar contraseña'}
        <Icono n="arrow" />
      </button>
      <Reenviar onReenviar={() => reenvio.ejecutar(() => api.post('/auth/recuperacion', { email: email.trim() }))} />
      <p className="auth-note">
        <button type="button" className="text-link" onClick={() => { setPaso('email'); setCodigo(''); accion.limpiar(); }}>
          Usar otro correo
        </button>
      </p>
    </form>
  );
}
