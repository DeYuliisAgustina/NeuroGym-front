import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** Mensajes breves de confirmación (#toast del prototipo). */
const ToastContext = createContext<(mensaje: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState('');
  const [visible, setVisible] = useState(false);
  const temporizador = useRef<number>(0);
  const mostrar = useCallback((texto: string) => {
    setMensaje(texto);
    setVisible(true);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setVisible(false), 4300);
  }, []);
  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div id="toast" className={visible ? 'visible' : ''} role="status" aria-live="polite">
        {mensaje}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
