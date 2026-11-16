import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { Aviso, Boton } from './ui';

/**
 * CU-004-001: lectura del QR con la cámara de una computadora, celular o tablet,
 * sin lectores ni molinetes (RNF8). Si el navegador no permite la cámara, se
 * informa para usar el escaneo asistido.
 */
export function LectorQr({ alLeer }: { alLeer: (codigo: string) => void }) {
  const [activa, setActiva] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lector = useRef<Html5Qrcode | null>(null);
  const ultimo = useRef<{ codigo: string; momento: number } | null>(null);

  const detener = async () => {
    if (lector.current?.isScanning) await lector.current.stop().catch(() => undefined);
    setActiva(false);
  };

  useEffect(() => () => void detener(), []);

  const activar = async () => {
    setError(null);
    try {
      lector.current ??= new Html5Qrcode('lector-qr');
      await lector.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (texto) => {
          // Evita procesar dos veces la misma lectura en pocos segundos.
          const ahora = Date.now();
          if (ultimo.current && ultimo.current.codigo === texto && ahora - ultimo.current.momento < 4000) return;
          ultimo.current = { codigo: texto, momento: ahora };
          alLeer(texto);
        },
        () => undefined,
      );
      setActiva(true);
    } catch {
      setError('El navegador no permite usar la cámara. Usá "Escaneo asistido o código recibido".');
      setActiva(false);
    }
  };

  return (
    <div className="pila">
      <div id="lector-qr" style={{ width: '100%', maxWidth: 380, minHeight: activa ? 280 : 0 }} />
      <Aviso tipo="alerta">{error}</Aviso>
      {activa ? (
        <Boton variante="secundario" onClick={detener}>Detener cámara</Boton>
      ) : (
        <Boton onClick={activar}>Activar cámara</Boton>
      )}
    </div>
  );
}
