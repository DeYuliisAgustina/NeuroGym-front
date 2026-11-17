import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { Icono } from './Icono';
import { Boton } from './ui';

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
    <div className="scan-zone">
      <div id="lector-qr" style={{ width: '100%', maxWidth: 380, margin: '0 auto', display: activa ? 'block' : 'none' }} />
      {!activa && (
        <>
          <Icono n="camera" />
          <h3>Acercá el código a la cámara</h3>
          <p>La cámara se activa solo cuando la solicitás.</p>
        </>
      )}
      {error && <small role="alert">{error}</small>}
      {activa ? (
        <Boton estilo="outline" icono="close" onClick={detener}>
          Detener cámara
        </Boton>
      ) : (
        <Boton estilo="outline" icono="camera" onClick={activar}>
          Activar cámara
        </Boton>
      )}
    </div>
  );
}
