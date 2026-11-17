import { useState, type FormEvent } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import type { TurnoProfesional } from '../types';
import { dinero, fechaCorta, hoyIso } from '../utils/formato';
import { EstadoConsulta, pagoDeConsulta } from './AccionesTurnoProfesional';
import { Boton, CabeceraTarjeta, ErrorFormulario, FilaDato, Insignia, Modal } from './ui';

/** La consulta ya ocurrió (fecha y hora de inicio pasadas). */
const yaOcurrio = (t: TurnoProfesional) => {
  const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16);
  return `${t.fecha} ${t.horaInicio}` <= ahora;
};

/**
 * "Registro de consultas y pagos" (Figura 59, RF40-RF41): una única
 * declaración de consulta realizada y pagada completa el turno y registra la comisión.
 */
export function RegistroConsultas({ turnos, valorReferencia, alCambiar }: { turnos: TurnoProfesional[]; valorReferencia: number; alCambiar: () => void }) {
  const toast = useToast();
  const [declarar, setDeclarar] = useState<TurnoProfesional | null>(null);
  const [importe, setImporte] = useState('');
  const accion = useAccion();
  const filas = turnos.filter((t) => ['CONFIRMADO', 'REPROGRAMADO', 'COMPLETADO'].includes(t.estado) && (t.estado === 'COMPLETADO' || t.fecha <= hoyIso()));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(importe) > 0)) return accion.setError('Ingresá el importe efectivamente cobrado.');
    if (await accion.ejecutar(() => api.patch(`/profesional/turnos/${declarar!.id}/completado`, { importeDeclarado: Number(importe) }))) {
      setDeclarar(null);
      toast('Consulta registrada como realizada y pagada. La comisión quedó registrada.');
      alCambiar();
    }
  };

  return (
    <section className="card section-gap">
      <CabeceraTarjeta titulo="Registro de consultas y pagos" subtitulo="Una única declaración de consulta realizada y pagada completa el turno y registra su comisión." />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Socio / fecha</th>
              <th>Estado</th>
              <th>Modalidad de pago</th>
              <th>Importe cobrado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.socio}</strong>
                  <small>
                    {fechaCorta(t.fecha)} · {t.horaInicio}
                  </small>
                </td>
                <td>
                  <EstadoConsulta estado={t.estado} />
                </td>
                <td>{pagoDeConsulta(t)}</td>
                <td>{t.comision ? dinero(t.comision.importeDeclarado) : 'Sin registrar'}</td>
                <td>
                  {t.comision ? (
                    <Insignia color="neutral">{t.comision.exenta ? 'Sin comisión · Fundadores' : `Comisión ${dinero(t.comision.importeComision)}`}</Insignia>
                  ) : (
                    <>
                      <Boton
                        chico
                        icono="wallet"
                        disabled={!yaOcurrio(t)}
                        onClick={() => {
                          accion.limpiar();
                          setImporte(String(valorReferencia || ''));
                          setDeclarar(t);
                        }}
                      >
                        Registrar pago recibido
                      </Boton>
                      {!yaOcurrio(t) && <small>Se habilita después de la fecha y hora del turno.</small>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length === 0 && <p className="page-note">Todavía no hay consultas para registrar.</p>}
      <p className="page-note">La comisión corresponde al importe declarado y se registra una sola vez. El pago de la consulta se acuerda directamente con el socio.</p>

      <Modal titulo="Registrar pago recibido" subtitulo={declarar ? `${declarar.socio} · ${fechaCorta(declarar.fecha)} ${declarar.horaInicio}` : ''} abierto={!!declarar} onCerrar={() => setDeclarar(null)}>
        {declarar && (
          <form onSubmit={guardar}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            <FilaDato etiqueta="Modalidad acordada">{pagoDeConsulta(declarar)}</FilaDato>
            <FilaDato etiqueta="Tarifa de referencia">{dinero(valorReferencia)}</FilaDato>
            <label>
              Importe efectivamente cobrado (ARS)
              <input type="number" min={0.01} step={0.01} required value={importe} onChange={(e) => setImporte(e.target.value)} />
            </label>
            <p className="page-note">Al confirmar, la consulta queda realizada. La comisión se calcula sobre este importe según tu plan y las promociones aplicables. Este registro no realiza un cobro.</p>
            <div className="form-actions">
              <Boton estilo="outline" onClick={() => setDeclarar(null)}>
                Volver
              </Boton>
              <button className="btn primary" type="submit" disabled={accion.enviando}>
                Declarar consulta realizada y pagada
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
