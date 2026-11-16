import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, Boton, EncabezadoPagina } from '../../components/ui';
import { api, ErrorApi } from '../../services/api';

interface CodigoQr {
  codigo: string;
  expiraEn: string;
  vigenciaSeg: number;
}

/**
 * Mi QR de ingreso (RF4, RNF7): código temporal y dinámico, sin datos
 * personales legibles. Se renueva solo antes de vencer.
 */
export function MiQr() {
  const [qr, setQr] = useState<CodigoQr | null>(null);
  const [restante, setRestante] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const renovar = useCallback(async () => {
    try {
      setError(null);
      setQr(await api.post<CodigoQr>('/socio/qr'));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo generar el código');
    }
  }, []);

  useEffect(() => {
    void renovar();
  }, [renovar]);

  useEffect(() => {
    if (!qr) return;
    const intervalo = window.setInterval(() => {
      const segundos = Math.max(0, Math.round((new Date(qr.expiraEn).getTime() - Date.now()) / 1000));
      setRestante(segundos);
      if (segundos <= 5) void renovar();
    }, 1000);
    return () => window.clearInterval(intervalo);
  }, [qr, renovar]);

  return (
    <div style={{ textAlign: 'center' }}>
      <EncabezadoPagina titulo="Mi QR de ingreso" descripcion="Mostralo en recepción. El código cambia cada pocos minutos." />
      <Aviso tipo="error">{error}</Aviso>
      {qr && (
        <div className="tarjeta tarjeta-oscura" style={{ display: 'inline-block', maxWidth: 380, width: '100%' }}>
          <div className="qr-caja">
            <QRCodeSVG value={qr.codigo} size={240} level="M" aria-label="Código QR de ingreso" />
          </div>
          <p style={{ marginTop: '0.8rem' }}>Vence en {restante} s</p>
          <Boton variante="acento" onClick={renovar}>
            Actualizar código
          </Boton>
          <details style={{ marginTop: '0.8rem', textAlign: 'left' }}>
            <summary>¿La cámara de recepción no funciona?</summary>
            <small>Podés dictar este código al personal para el escaneo asistido:</small>
            <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '0.75rem' }}>{qr.codigo}</code>
          </details>
        </div>
      )}
      <p className="tenue" style={{ marginTop: '1rem' }}>Necesitás una reserva vigente para el horario en el que ingresás.</p>
    </div>
  );
}
