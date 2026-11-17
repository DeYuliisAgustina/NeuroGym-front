import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, BotonEnlace, Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, FilaDato, Insignia, inicialesDe, Vacio } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api, ErrorApi } from '../../services/api';
import type { Turno } from '../../types';
import { fechaCorta, hoyIso } from '../../utils/formato';

interface CodigoQr {
  codigo: string;
  expiraEn: string;
  vigenciaSeg: number;
}
interface Perfil {
  id: number;
  usuario: { nombre: string; apellido: string };
  sede: { nombre: string; gimnasio: { razonSocial: string; toleranciaAntesMin: number; toleranciaDespuesMin: number } };
}
interface Asistencia {
  id: number;
  fechaHoraReal: string;
  forma: string;
  sede: string;
}

/**
 * Mi QR de ingreso (RF4, RNF7, Figura 43): código temporal y dinámico, sin
 * datos personales legibles. Se renueva solo antes de vencer.
 */
export function MiQr() {
  const [qr, setQr] = useState<CodigoQr | null>(null);
  const [restante, setRestante] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const perfil = useApi(() => api.get<Perfil>('/socio/perfil'));
  const reservas = useApi(() => api.get<{ proximas: { id: number; turno: Turno }[] }>('/socio/reservas'));
  const cuota = useApi(() => api.get<{ cuota: { estado: string } | null }>('/socio/cuota'));
  const asistencias = useApi(() => api.get<Asistencia[]>('/socio/asistencias'));

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
    const tic = () => {
      const segundos = Math.max(0, Math.round((new Date(qr.expiraEn).getTime() - Date.now()) / 1000));
      setRestante(segundos);
      if (segundos <= 3) void renovar();
    };
    tic();
    const intervalo = window.setInterval(tic, 1000);
    return () => window.clearInterval(intervalo);
  }, [qr, renovar]);

  const p = perfil.datos;
  const nombre = p ? `${p.usuario.nombre} ${p.usuario.apellido}` : '';
  const hoy = reservas.datos?.proximas.find((r) => r.turno.fecha === hoyIso());
  const estadoCuota = cuota.datos?.cuota?.estado;
  const g = p?.sede.gimnasio;

  return (
    <>
      <Encabezado ceja="MI ACCESO AL GIMNASIO" titulo="Mi QR de ingreso" subtitulo="Mostralo ante la cámara de recepción al llegar a tu sede." accion={<Insignia color="lilac">QR dinámico</Insignia>} />
      <ErrorFormulario>{error}</ErrorFormulario>
      <div className="two-col">
        <section className="card qr-card">
          <div className="qr-person">
            <Avatar iniciales={inicialesDe(nombre)} color="mint" grande />
            <h2>{nombre}</h2>
            <p>
              Socio NG-{String(p?.id ?? 0).padStart(3, '0')} · {g?.razonSocial}
            </p>
          </div>
          <div className="qr-frame">{qr && <QRCodeSVG value={qr.codigo} size={232} level="M" bgColor="#ffffff" fgColor="#071b12" aria-label="Código QR de ingreso" />}</div>
          <div className="qr-countdown">
            Se actualiza en <strong>{restante}</strong> s
          </div>
          {qr && <code className="qr-token">{qr.codigo.slice(0, 22)}…</code>}
          <Boton estilo="outline" icono="refresh" onClick={renovar}>
            Actualizar QR
          </Boton>
          <p className="page-note">Código temporal firmado: vence a los {qr?.vigenciaSeg ?? 60} segundos y se valida en el servidor del gimnasio.</p>
        </section>
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Antes de ingresar" subtitulo="Recepción valida tu reserva y la política del gimnasio." />
            <FilaDato etiqueta="Reserva de hoy">{hoy ? `${hoy.turno.actividad} · ${hoy.turno.horaInicio}` : 'Sin reserva para hoy'}</FilaDato>
            <FilaDato etiqueta="Sede">{p?.sede.nombre}</FilaDato>
            <FilaDato etiqueta="Cuota">{estadoCuota === 'PAGADA' ? 'Al día' : estadoCuota === 'IMPAGA' ? 'Impaga' : estadoCuota ? 'Pendiente' : '—'}</FilaDato>
            <FilaDato etiqueta="Ventana de ingreso">
              {g?.toleranciaAntesMin ?? 15} min antes / {g?.toleranciaDespuesMin ?? 60} min después
            </FilaDato>
            <p className="modal-text" style={{ marginTop: 18 }}>
              La validación registra la fecha y hora de llegada, evita ingresos duplicados y suma puntos una sola vez por día.
            </p>
            <BotonEnlace a="/socio/turnos" estilo="outline" chico icono="calendar">
              Consultar mis turnos
            </BotonEnlace>
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Mis asistencias confirmadas" subtitulo="Cada fila corresponde a un ingreso validado." />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Sede</th>
                    <th>Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {asistencias.datos?.slice(0, 10).map((a) => (
                    <tr key={a.id}>
                      <td>
                        {fechaCorta(a.fechaHoraReal)} · {new Date(a.fechaHoraReal).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                      </td>
                      <td>{a.sede}</td>
                      <td>{a.forma === 'QR' ? 'QR' : 'Manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {asistencias.datos?.length === 0 && <Vacio titulo="Todavía no hay ingresos" descripcion="Tu primera asistencia aparecerá al validar el QR en recepción." icono="camera" />}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
