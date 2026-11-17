import { useEffect, useState, type FormEvent } from 'react';
import { Icono } from '../../components/Icono';
import { LectorQr } from '../../components/LectorQr';
import { Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, Insignia, Modal, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { fechaCorta, hoyIso, mesAnio } from '../../utils/formato';

type CodigoResultado = 'INGRESO_AUTORIZADO' | 'CUOTA_PENDIENTE' | 'QR_INVALIDO' | 'SIN_RESERVA' | 'SEDE_INCORRECTA' | 'FUERA_DE_HORARIO' | 'INGRESO_DUPLICADO' | 'BLOQUEADO';
interface Resultado {
  resultado: CodigoResultado;
  mensaje?: string;
  socio?: string;
  actividad?: string;
  sede?: string;
  turno?: string;
  hora?: string;
  advertencia?: string;
  diaConstancia?: boolean;
  periodosAdeudados?: string[];
  politicaSugerida?: 'BLOQUEAR' | 'AUTORIZAR';
  puedeAutorizar?: boolean;
  reservaId?: number;
  codigoQrId?: number;
  provisoria?: boolean;
}
interface Asistencia {
  id: number;
  fechaHoraReal: string;

  forma: string;
  provisoria: boolean;
  motivo?: string | null;
  reserva: { turno: { actividad: string; sede: { nombre: string } }; socio: { usuario: { nombre: string; apellido: string } } };
  responsable: { usuario: { nombre: string; apellido: string } } | null;
  autorizacion: { motivo: string; fechaHora: string } | null;
}
interface SocioOpcion {
  id: number;
  sede: { nombre: string };
  usuario: { nombre: string; apellido: string };
}

const TITULOS: Record<CodigoResultado, string> = {
  INGRESO_AUTORIZADO: 'Ingreso autorizado',
  CUOTA_PENDIENTE: 'Cuota pendiente',
  QR_INVALIDO: 'QR vencido o inválido',
  SIN_RESERVA: 'Sin reserva válida',
  SEDE_INCORRECTA: 'Sede incorrecta',
  FUERA_DE_HORARIO: 'Fuera del horario permitido',
  INGRESO_DUPLICADO: 'Ingreso duplicado',
  BLOQUEADO: 'Ingreso bloqueado',
};
const hora = (f: string) => new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Recepción y asistencia (CU-004, Figuras 44 y 45): lectura, validación en el servidor y decisión del personal. */
export function RecepcionQr() {
  const { puede } = useAuth();
  const gestion = puede('RECEPCION', 'GESTION');
  const { sedeId: sedeVista } = useSedeVista();
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes'));
  const [sedeId, setSedeId] = useState(sedeVista);
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [registro, setRegistro] = useState<{ titulo: string; socio?: string; ok: boolean; hora: string }[]>([]);
  const [decision, setDecision] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [manual, setManual] = useState(false);
  const [autoservicio, setAutoservicio] = useState(false);
  const asistencias = useApi(() => (sedeId ? api.get<Asistencia[]>('/admin/asistencias', { sedeId, fecha: hoyIso() }) : Promise.resolve([] as Asistencia[])), [sedeId]);
  const accion = useAccion();

  useEffect(() => {
    if (!sedeId && sedes.datos?.length) setSedeId(String(sedes.datos.find((s) => s.habilitada)?.id ?? ''));
  }, [sedes.datos, sedeId]);
  useEffect(() => {
    document.body.classList.toggle('kiosk-mode', autoservicio);
    return () => document.body.classList.remove('kiosk-mode');
  }, [autoservicio]);

  const mostrar = (r: Resultado) => {
    setResultado(r);
    setRegistro((l) => [{ titulo: TITULOS[r.resultado], socio: r.socio, ok: r.resultado === 'INGRESO_AUTORIZADO', hora: hora(new Date().toISOString()) }, ...l].slice(0, 5));
    if (r.resultado === 'CUOTA_PENDIENTE') {
      setMotivo('');
      setDecision(true);
    }
    if (r.resultado === 'INGRESO_AUTORIZADO') void asistencias.recargar();
  };

  const validar = async (texto: string) => {
    if (!sedeId) return accion.setError('Seleccioná la sede de recepción.');
    // CU-004-002: la validación siempre se hace en el servidor (RNF7).
    const r = await accion.ejecutar(() => api.post<Resultado>('/asistencias/qr', { codigo: texto.trim(), sedeId: Number(sedeId) }));
    if (r) {
      setCodigo('');
      mostrar(r);
    }
  };

  const autorizar = async (e: FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) return accion.setError('Indicá el motivo de la autorización excepcional.');
    const r = await accion.ejecutar(() => api.post<Resultado>('/asistencias/autorizaciones', { reservaId: resultado!.reservaId, codigoQrId: resultado!.codigoQrId, motivo }));
    if (r) {
      setDecision(false);
      mostrar(r);
    }
  };
  const bloquear = async () => {
    const r = await accion.ejecutar(() => api.post<Resultado>('/rechazos', { reservaId: resultado!.reservaId, ...(motivo.trim() ? { motivo } : {}) }));
    if (r) {
      setDecision(false);
      mostrar(r);
    }
  };

  const ok = resultado?.resultado === 'INGRESO_AUTORIZADO';
  return (
    <>
      <Encabezado
        ceja="CONTROL DE INGRESO"
        titulo="Recepción y asistencia"
        subtitulo="Validá el QR del socio y supervisá el resultado."
        accion={
          <Boton estilo="outline" icono="grid" onClick={() => setAutoservicio((v) => !v)}>
            {autoservicio ? 'Salir de autoservicio' : 'Pantalla de autoservicio'}
          </Boton>
        }
      />
      <div className="reception-context">
        <label>
          Sede de recepción
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            {(sedes.datos ?? [])
              .filter((s) => s.habilitada)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
          </select>
        </label>
        <label>
          Fecha
          <input type="text" readOnly value={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })} />
        </label>
        <div>
          <Insignia color="neutral">Reserva + sede + horario + cuota</Insignia>
        </div>
      </div>
      <ErrorFormulario>{!decision && !manual ? accion.error : null}</ErrorFormulario>
      <div className="two-col">
        <section className="card reception-scan">
          <CabeceraTarjeta titulo="Presentá tu QR" subtitulo="El resultado se muestra en esta pantalla." />
          <LectorQr alLeer={validar} />
          <details className="assisted-entry">
            <summary>Escaneo asistido o código recibido</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void validar(codigo);
              }}
            >
              <label>
                Código QR
                <input required placeholder="Código que muestra el socio" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </label>
              <button className="btn outline small" type="submit" disabled={accion.enviando}>
                Validar código
              </button>
            </form>
            {gestion && (
              <Boton
                estilo="outline"
                completo
                chico
                icono="edit"
                onClick={() => {
                  accion.limpiar();
                  setManual(true);
                }}
              >
                Registro manual excepcional
              </Boton>
            )}
          </details>
        </section>
        <div className="stack">
          <section id="entry-result" className={`entry-result ${resultado ? (ok ? 'ok' : 'blocked') : 'waiting'}`} aria-live="polite">
            <Icono n={resultado ? (ok ? 'check' : 'warning') : 'camera'} />
            <div className="eyebrow">RESULTADO DE VALIDACIÓN</div>
            <h2>{resultado ? TITULOS[resultado.resultado] : 'Esperando lectura'}</h2>
            <h3>{resultado?.socio ?? 'El socio presenta su QR personal'}</h3>
            <p>
              {resultado
                ? resultado.actividad
                  ? `${resultado.actividad} · ${resultado.sede} · ${resultado.hora ?? resultado.turno ?? ''}`
                  : (resultado.mensaje ?? '')
                : 'Se validan la reserva, la sede, el horario y el estado de la cuota.'}
            </p>
            {resultado?.advertencia && <p>{resultado.advertencia}</p>}
            {ok && <Insignia color="neutral">{resultado.diaConstancia ? 'Suma puntos · primer ingreso del día' : 'Sin puntos adicionales · día ya contabilizado'}</Insignia>}
            {resultado?.resultado === 'CUOTA_PENDIENTE' && (
              <Boton estilo="outline" chico onClick={() => setDecision(true)}>
                Decidir el ingreso
              </Boton>
            )}
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Validaciones de esta sesión" subtitulo="Autorizadas y bloqueadas." />
            <div className="entry-log">
              {registro.map((r, i) => (
                <div key={i} className="notice">
                  <Icono n={r.ok ? 'check' : 'warning'} />
                  <div>
                    <h4>{r.socio ?? 'Lectura'}</h4>
                    <p>
                      {r.titulo} · {r.hora}
                    </p>
                  </div>
                </div>
              ))}
              {registro.length === 0 && <Vacio titulo="Lista para recibir socios" descripcion="Cada lectura queda registrada con su resultado." icono="camera" />}
            </div>
          </section>
        </div>
      </div>
      <p className="page-note">El código QR es temporal y se valida en el servidor. La cámara se activa solo al solicitarla.</p>

      <section className="card section-gap">
        <CabeceraTarjeta titulo="Trazabilidad de asistencias" subtitulo="Ingreso real y carga en el sistema, con responsable." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio / sede</th>
                <th>Fecha y hora del ingreso</th>
                <th>Fecha y hora de carga</th>
                <th>Responsable</th>
                <th>Forma y motivo</th>
              </tr>
            </thead>
            <tbody>
              {asistencias.datos?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>
                      {a.reserva.socio.usuario.nombre} {a.reserva.socio.usuario.apellido}
                    </strong>
                    <small>{a.reserva.turno.sede.nombre}</small>
                  </td>
                  <td>
                    {fechaCorta(a.fechaHoraReal)} · {hora(a.fechaHoraReal)}
                  </td>
                  <td>{a.forma === 'QR' ? `${fechaCorta(a.fechaHoraReal)} · ${hora(a.fechaHoraReal)}` : a.autorizacion ? `${fechaCorta(a.autorizacion.fechaHora)} · ${hora(a.autorizacion.fechaHora)}` : 'Registro manual'}</td>
                  <td>{a.responsable ? `${a.responsable.usuario.nombre} ${a.responsable.usuario.apellido}` : 'Validación QR'}</td>
                  <td>
                    {a.forma === 'QR' ? 'QR' : 'Manual'}
                    {a.provisoria && ' · provisoria'}
                    {(a.autorizacion?.motivo ?? a.motivo) && <small>{a.autorizacion?.motivo ?? a.motivo}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {asistencias.datos?.length === 0 && <p className="page-note">Todavía no hay asistencias registradas hoy en esta sede.</p>}
        <p className="page-note">La carga posterior se realiza cuando vuelve la conexión; no constituye un modo sin conexión.</p>
      </section>

      {/* Figura 45 (a): decisión del personal ante una cuota pendiente (CU-004-005). */}
      <Modal titulo="Cuota pendiente" subtitulo={`${resultado?.socio ?? ''} · ${resultado?.periodosAdeudados?.map(mesAnio).join(', ') ?? ''}`} abierto={decision} onCerrar={() => setDecision(false)}>
        <form onSubmit={autorizar}>
          <ErrorFormulario>{accion.error}</ErrorFormulario>
          <div className="soft-alert">
            <div>
              <h4>Decisión del personal</h4>
              <p>
                La cuota está {resultado?.periodosAdeudados?.length ? 'impaga' : 'pendiente'}. La política del gimnasio sugiere {resultado?.politicaSugerida === 'AUTORIZAR' ? 'autorizar' : 'bloquear'} el ingreso. Se puede
                autorizar excepcionalmente sin cambiar el estado de la cuota.
              </p>
            </div>
          </div>
          {resultado?.puedeAutorizar ? (
            <label style={{ marginTop: 18 }}>
              Motivo de la autorización excepcional
              <textarea required maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
          ) : (
            <p className="page-note">Tu rol no puede autorizar excepciones: solo podés bloquear el ingreso.</p>
          )}
          <p className="page-note">La decisión conserva el responsable, la fecha de carga y el motivo. No se registra asistencia hasta autorizar.</p>
          <div className="form-actions">
            <Boton estilo="danger" cargando={accion.enviando} onClick={bloquear}>
              Bloquear ingreso
            </Boton>
            {resultado?.puedeAutorizar && (
              <button className="btn primary" type="submit" disabled={accion.enviando}>
                Autorizar ingreso excepcional
              </button>
            )}
          </div>
        </form>
      </Modal>
      {manual && (
        <RegistroManual
          sedes={sedes.datos ?? []}
          sedeId={sedeId}
          alCerrar={() => setManual(false)}
          alRegistrar={(r) => {
            setManual(false);
            mostrar(r);
          }}
        />
      )}
    </>
  );
}

/** CU-004-010 (Figura 45 b): registro manual excepcional o carga posterior de asistencias provisorias (RD14). */
function RegistroManual({ sedes, sedeId, alCerrar, alRegistrar }: { sedes: Sede[]; sedeId: string; alCerrar: () => void; alRegistrar: (r: Resultado) => void }) {
  const socios = useApi(() => api.get<SocioOpcion[]>('/admin/socios', { activo: 'true', ...(sedeId ? { sedeId } : {}) }), [sedeId]);
  const [f, setF] = useState({ socioId: '', sedeId, tipo: 'ACTUAL', fechaHoraReal: '', motivo: '', autorizacionCuota: '' });
  const [cuotaPendiente, setCuotaPendiente] = useState<Resultado | null>(null);
  const accion = useAccion();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.socioId || !f.sedeId) return accion.setError('Elegí el socio y la sede.');
    if (f.motivo.trim().length < 5) return accion.setError('Indicá el motivo de la excepción.');
    if (f.tipo === 'POSTERIOR' && !f.fechaHoraReal) return accion.setError('Indicá la fecha y hora reales del ingreso provisorio.');
    const r = await accion.ejecutar(() =>
      api.post<Resultado>('/asistencias/manual', {
        socioId: Number(f.socioId),
        sedeId: Number(f.sedeId),
        motivo: f.motivo,
        fechaHoraReal: f.tipo === 'POSTERIOR' ? new Date(f.fechaHoraReal).toISOString() : undefined,
        autorizacionCuota: f.autorizacionCuota || undefined,
      }),
    );
    if (!r) return;
    if (r.resultado === 'CUOTA_PENDIENTE') setCuotaPendiente(r);
    else alRegistrar(r);
  };
  return (
    <Modal titulo="Registro manual excepcional" subtitulo="Ingreso actual o carga posterior de un registro provisorio." abierto onCerrar={alCerrar}>
      <form onSubmit={enviar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <label>
          Socio
          <select required value={f.socioId} onChange={(e) => setF({ ...f, socioId: e.target.value })}>
            <option value="">Elegí el socio</option>
            {socios.datos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.usuario.nombre} {s.usuario.apellido} · {s.sede.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sede del ingreso
          <select required value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de registro
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="ACTUAL">Ingreso actual</option>
            <option value="POSTERIOR">Carga posterior de un ingreso provisorio</option>
          </select>
        </label>
        {f.tipo === 'POSTERIOR' && (
          <label>
            Fecha y hora reales del ingreso provisorio
            <input type="datetime-local" required value={f.fechaHoraReal} onChange={(e) => setF({ ...f, fechaHoraReal: e.target.value })} />
          </label>
        )}
        <label>
          Motivo de la excepción
          <textarea required maxLength={255} placeholder="Indicá por qué se realiza el registro manual." value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
        </label>
        {cuotaPendiente && (
          <div className="soft-alert">
            <div>
              <h4>Cuota pendiente ({cuotaPendiente.periodosAdeudados?.map(mesAnio).join(', ')})</h4>
              <p>Para registrar el ingreso, indicá el motivo de la autorización excepcional.</p>
              <label>
                Motivo de la autorización
                <input value={f.autorizacionCuota} onChange={(e) => setF({ ...f, autorizacionCuota: e.target.value })} />
              </label>
            </div>
          </div>
        )}
        <p className="page-note">
          Se validan reserva, sede y horario de la fecha del ingreso. En una carga posterior se conservan tanto la fecha y hora reales del ingreso como la fecha, hora y responsable de la carga al
          restablecerse la conexión.
        </p>
        <p className="page-note">Si la cuota está pendiente, se solicita la decisión del personal antes de registrar la asistencia.</p>
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Volver
          </Boton>
          <button className="btn primary" type="submit" disabled={accion.enviando}>
            Validar y registrar excepción
          </button>
        </div>
      </form>
    </Modal>
  );
}
