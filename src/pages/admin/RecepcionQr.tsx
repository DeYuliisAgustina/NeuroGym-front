import { useState } from 'react';
import { LectorQr } from '../../components/LectorQr';
import { Aviso, Boton, Campo, EncabezadoPagina, Modal, Selector } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { etiqueta, fecha, hoyIso } from '../../utils/formato';
import { motivoObligatorio } from '../../validations/formularios';

interface Resultado {
  resultado: 'INGRESO_AUTORIZADO' | 'CUOTA_PENDIENTE' | 'QR_INVALIDO' | 'SIN_RESERVA' | 'SEDE_INCORRECTA' | 'FUERA_DE_HORARIO' | 'INGRESO_DUPLICADO' | 'BLOQUEADO';
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
interface SocioOpcion {
  id: number;
  usuario: { nombre: string; apellido: string };
}

/** Recepción QR (CU-004): lectura, validación en el servidor y confirmación de la asistencia. */
export function RecepcionQr() {
  const { puede } = useAuth();
  const gestion = puede('RECEPCION', 'GESTION');
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes'));
  const [sedeId, setSedeId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [motivo, setMotivo] = useState('');
  const [manual, setManual] = useState(false);
  const asistencias = useApi(
    () => api.get<{ id: number; fechaHoraReal: string; forma: string; provisoria: boolean; reserva: { turno: { actividad: string }; socio: { usuario: { nombre: string; apellido: string } } }; autorizacion: unknown }[]>('/admin/asistencias', { sedeId, fecha: hoyIso() }),
    [sedeId],
  );
  const accion = useAccion();

  const validar = async (texto: string) => {
    if (!sedeId) return accion.setError('Seleccioná la sede de recepción.');
    setMotivo('');
    // CU-004-002: la validación siempre se hace en el servidor (RNF7).
    const r = await accion.ejecutar(() => api.post<Resultado>('/asistencias/qr', { codigo: texto.trim(), sedeId: Number(sedeId) }));
    if (r) {
      setResultado(r);
      setCodigo('');
      if (r.resultado === 'INGRESO_AUTORIZADO') void asistencias.recargar();
    }
  };

  const autorizar = async () => {
    const problema = motivoObligatorio(motivo);
    if (problema) return accion.setError(problema);
    const r = await accion.ejecutar(() => api.post<Resultado>('/asistencias/autorizaciones', { reservaId: resultado!.reservaId, codigoQrId: resultado!.codigoQrId, motivo }));
    if (r) {
      setResultado(r);
      void asistencias.recargar();
    }
  };

  const bloquear = async () => {
    const r = await accion.ejecutar(() => api.post<Resultado>('/rechazos', { reservaId: resultado!.reservaId }));
    if (r) setResultado(r);
  };

  const tono = !resultado ? '' : resultado.resultado === 'INGRESO_AUTORIZADO' ? 'ok' : resultado.resultado === 'CUOTA_PENDIENTE' ? 'alerta' : 'mal';
  const titulo: Record<Resultado['resultado'], string> = {
    INGRESO_AUTORIZADO: 'Ingreso autorizado',
    CUOTA_PENDIENTE: 'Cuota pendiente',
    QR_INVALIDO: 'QR vencido o inválido',
    SIN_RESERVA: 'Sin reserva válida',
    SEDE_INCORRECTA: 'Sede incorrecta',
    FUERA_DE_HORARIO: 'Fuera del horario permitido',
    INGRESO_DUPLICADO: 'Ingreso duplicado',
    BLOQUEADO: 'Ingreso bloqueado',
  };

  return (
    <div>
      <EncabezadoPagina titulo="Recepción QR" descripcion="Validá el QR del socio con la cámara del dispositivo." acciones={gestion && <Boton variante="secundario" onClick={() => setManual(true)}>Registro manual excepcional</Boton>} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <div className="grilla-2">
        <div className="tarjeta pila">
          <Selector etiqueta="Sede de recepción" vacio="Elegí la sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)} opciones={(sedes.datos ?? []).filter((s) => s.habilitada).map((s) => ({ valor: s.id, texto: s.nombre }))} />
          <LectorQr alLeer={validar} />
          <details>
            <summary>Escaneo asistido o código recibido</summary>
            <Campo etiqueta="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <Boton cargando={accion.enviando} disabled={!codigo.trim()} onClick={() => validar(codigo)}>Validar código</Boton>
          </details>
        </div>
        <div className="tarjeta">
          {!resultado && <p className="tenue">Esperando lectura…</p>}
          {resultado && (
            <div className={`resultado-ingreso ${tono}`}>
              <h2>{titulo[resultado.resultado]}</h2>
              {resultado.socio && <p><strong>{resultado.socio}</strong></p>}
              {resultado.actividad && <p>{resultado.actividad} · {resultado.sede} · {resultado.turno}</p>}
              {resultado.mensaje && resultado.resultado !== 'CUOTA_PENDIENTE' && <p>{resultado.mensaje}</p>}
              {resultado.advertencia && <Aviso tipo="alerta">{resultado.advertencia}</Aviso>}
              {resultado.diaConstancia && <small>Se sumó un día de constancia.</small>}
              {resultado.resultado === 'CUOTA_PENDIENTE' && (
                <div className="pila" style={{ textAlign: 'left' }}>
                  <p>Período adeudado: {resultado.periodosAdeudados?.join(', ')}. Política del gimnasio: {resultado.politicaSugerida === 'BLOQUEAR' ? 'bloquear' : 'autorizar'}.</p>
                  {resultado.puedeAutorizar ? (
                    <>
                      <Campo etiqueta="Motivo de la excepción" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                      <div className="fila">
                        <Boton cargando={accion.enviando} onClick={autorizar}>Autorizar ingreso excepcional</Boton>
                        <Boton variante="peligro" cargando={accion.enviando} onClick={bloquear}>Bloquear ingreso</Boton>
                      </div>
                    </>
                  ) : (
                    <>
                      <small>Tu rol no puede autorizar excepciones.</small>
                      <Boton variante="peligro" onClick={bloquear}>Bloquear ingreso</Boton>
                    </>
                  )}
                </div>
              )}
              {resultado.resultado === 'BLOQUEADO' && <small>Administración debe registrar el pago o autorizar una excepción con motivo.</small>}
            </div>
          )}
        </div>
      </div>
      <div className="tarjeta" style={{ marginTop: '1rem' }}>
        <h2>Asistencias de hoy</h2>
        <div className="tabla-scroll">
          <table>
            <tbody>
              {asistencias.datos?.map((a) => (
                <tr key={a.id}>
                  <td>{fecha(a.fechaHoraReal, true)}</td>
                  <td>{a.reserva.socio.usuario.apellido}, {a.reserva.socio.usuario.nombre}</td>
                  <td>{a.reserva.turno.actividad}</td>
                  <td>
                    {etiqueta(a.forma)} {a.provisoria && <span className="etiqueta">Provisoria</span>} {a.autorizacion ? <span className="etiqueta etiqueta-alerta">Excepción</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {manual && <RegistroManual sedes={sedes.datos ?? []} alCerrar={() => setManual(false)} alRegistrar={(r) => { setResultado(r); setManual(false); void asistencias.recargar(); }} />}
    </div>
  );
}

/** CU-004-010: registro manual excepcional o carga posterior de asistencias provisorias (RD14). */
function RegistroManual({ sedes, alCerrar, alRegistrar }: { sedes: Sede[]; alCerrar: () => void; alRegistrar: (r: Resultado) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const socios = useApi(() => (busqueda.length >= 2 ? api.get<SocioOpcion[]>('/admin/socios', { busqueda, activo: 'true' }).catch(() => []) : Promise.resolve([] as SocioOpcion[])), [busqueda]);
  const [f, setF] = useState({ socioId: '', sedeId: '', motivo: '', fechaHoraReal: '', autorizacionCuota: '' });
  const [cuotaPendiente, setCuotaPendiente] = useState<Resultado | null>(null);
  const accion = useAccion();
  const enviar = async () => {
    const problema = motivoObligatorio(f.motivo);
    if (problema) return accion.setError(problema);
    if (!f.socioId || !f.sedeId) return accion.setError('Elegí el socio y la sede.');
    const r = await accion.ejecutar(() =>
      api.post<Resultado>('/asistencias/manual', {
        socioId: Number(f.socioId),
        sedeId: Number(f.sedeId),
        motivo: f.motivo,
        fechaHoraReal: f.fechaHoraReal ? new Date(f.fechaHoraReal).toISOString() : undefined,
        autorizacionCuota: f.autorizacionCuota || undefined,
      }),
    );
    if (!r) return;
    if (r.resultado === 'CUOTA_PENDIENTE') setCuotaPendiente(r);
    else alRegistrar(r);
  };
  return (
    <Modal titulo="Registro manual excepcional" abierto onCerrar={alCerrar}>
      <Aviso tipo="error">{accion.error}</Aviso>
      <Campo etiqueta="Buscar socio" placeholder="Nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <Selector etiqueta="Socio" vacio="Elegí el socio" value={f.socioId} onChange={(e) => setF({ ...f, socioId: e.target.value })} opciones={(socios.datos ?? []).map((s) => ({ valor: s.id, texto: `${s.usuario.apellido}, ${s.usuario.nombre}` }))} />
      <Selector etiqueta="Sede" vacio="Elegí la sede" value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })} opciones={sedes.map((s) => ({ valor: s.id, texto: s.nombre }))} />
      <Campo etiqueta="Motivo" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
      <Campo etiqueta="Fecha y hora real (solo para cargas posteriores)" type="datetime-local" value={f.fechaHoraReal} onChange={(e) => setF({ ...f, fechaHoraReal: e.target.value })} />
      {cuotaPendiente && (
        <>
          <Aviso tipo="alerta">Cuota pendiente ({cuotaPendiente.periodosAdeudados?.join(', ')}). Para registrar el ingreso, indicá el motivo de la autorización excepcional.</Aviso>
          <Campo etiqueta="Motivo de la autorización" value={f.autorizacionCuota} onChange={(e) => setF({ ...f, autorizacionCuota: e.target.value })} />
        </>
      )}
      <Boton bloque cargando={accion.enviando} onClick={enviar}>Validar y registrar excepción</Boton>
    </Modal>
  );
}
