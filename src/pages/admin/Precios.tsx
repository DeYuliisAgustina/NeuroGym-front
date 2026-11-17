import { useEffect, useState, type FormEvent } from 'react';
import { CabeceraTarjeta, Encabezado, ErrorFormulario, FilaDato, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero, fechaLarga, hoyIso } from '../../utils/formato';

interface Plan {
  id: number;
  tipo: 'BASICO' | 'PREMIUM';
  importeVigente: number;
  actualizaciones: {
    id: number;
    fecha: string;
    vigenteDesde: string;
    importeAnterior: string;
    importeNuevo: string;
    motivo: string;
    responsable: { usuario: { nombre: string; apellido: string } } | null;
  }[];
}
interface Gimnasio {
  toleranciaAntesMin: number;
  toleranciaDespuesMin: number;
  politicaCuotaPendiente: 'BLOQUEAR' | 'AUTORIZAR';
}

const conDebito = (n: number) => Math.round(n * 0.9 * 100) / 100;
const fechaHora = (f: string) => new Date(f).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Precios y políticas de ingreso (RF24, RD12, Figura 65): los nuevos precios rigen para pagos posteriores. */
export function Precios() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestionPrecios = puede('PRECIOS', 'GESTION');
  const verPoliticas = puede('CONFIGURACION');
  const gestionPoliticas = puede('CONFIGURACION', 'GESTION');
  const planes = useApi(() => api.get<Plan[]>('/admin/planes'));
  const gimnasio = useApi(() => api.get<Gimnasio>('/admin/gimnasio'));
  const basico = planes.datos?.find((p) => p.tipo === 'BASICO');
  const premium = planes.datos?.find((p) => p.tipo === 'PREMIUM');
  const [precios, setPrecios] = useState({ basico: '', premium: '', vigenteDesde: hoyIso(), motivo: '' });
  const [politica, setPolitica] = useState<Gimnasio | null>(null);
  const accionPrecios = useAccion();
  const accionPolitica = useAccion();

  useEffect(() => {
    if (basico && premium) setPrecios((p) => ({ ...p, basico: String(basico.importeVigente), premium: String(premium.importeVigente) }));
  }, [basico, premium]);
  useEffect(() => {
    if (gimnasio.datos) setPolitica({ toleranciaAntesMin: gimnasio.datos.toleranciaAntesMin, toleranciaDespuesMin: gimnasio.datos.toleranciaDespuesMin, politicaCuotaPendiente: gimnasio.datos.politicaCuotaPendiente });
  }, [gimnasio.datos]);

  const guardarPrecios = async (e: FormEvent) => {
    e.preventDefault();
    const cambios = (
      [
        ['BASICO', Number(precios.basico), basico?.importeVigente],
        ['PREMIUM', Number(precios.premium), premium?.importeVigente],
      ] as const
    ).filter(([, nuevo, actual]) => nuevo !== actual || precios.vigenteDesde > hoyIso());
    if (!cambios.length) return accionPrecios.setError('Los importes son iguales a los vigentes.');
    if (cambios.some(([, n]) => !(n > 0))) return accionPrecios.setError('Ingresá importes mayores que cero.');
    if (precios.motivo.trim().length < 5) return accionPrecios.setError('Indicá el motivo del cambio.');
    const ok = await accionPrecios.ejecutar(() =>
      Promise.all(cambios.map(([tipo, importeNuevo]) => api.put(`/admin/planes/${tipo}/precio`, { importeNuevo, vigenteDesde: precios.vigenteDesde, motivo: precios.motivo }))),
    );
    if (ok) {
      toast(precios.vigenteDesde > hoyIso() ? `Nuevos precios programados desde el ${fechaLarga(precios.vigenteDesde, false)}.` : 'Nuevos precios vigentes para los pagos posteriores.');
      setPrecios((p) => ({ ...p, motivo: '' }));
      void planes.recargar();
    }
  };
  const guardarPolitica = async (e: FormEvent) => {
    e.preventDefault();
    if (!politica) return;
    if (await accionPolitica.ejecutar(() => api.put('/admin/gimnasio/politicas', politica))) {
      toast('Política de recepción guardada.');
      void gimnasio.recargar();
    }
  };

  // Historial de ambos planes, del más reciente al más antiguo.
  const historial = (planes.datos ?? [])
    .flatMap((p) => p.actualizaciones.map((a) => ({ ...a, tipo: p.tipo })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const vBasico = Number(precios.basico) || 0;
  const vPremium = Number(precios.premium) || 0;

  return (
    <>
      <Encabezado ceja="CONFIGURACIÓN DEL GIMNASIO" titulo="Precios y políticas de ingreso" subtitulo="Los cambios se aplican a los pagos posteriores y quedan registrados." />
      <div className="two-col">
        <section className="card">
          <CabeceraTarjeta titulo="Planes del socio" subtitulo="El gimnasio define y cobra estos importes en pesos." />
          <form onSubmit={guardarPrecios}>
            <ErrorFormulario>{accionPrecios.error}</ErrorFormulario>
            <label>
              Cuota mensual del Plan Básico (ARS)
              <input type="number" min={1} max={10000000} step={100} required disabled={!gestionPrecios} value={precios.basico} onChange={(e) => setPrecios({ ...precios, basico: e.target.value })} />
            </label>
            <label>
              Adicional mensual Premium (ARS)
              <input type="number" min={1} max={10000000} step={100} required disabled={!gestionPrecios} value={precios.premium} onChange={(e) => setPrecios({ ...precios, premium: e.target.value })} />
            </label>
            {gestionPrecios && (
              <>
                <label>
                  Vigente desde
                  <input type="date" min={hoyIso()} required value={precios.vigenteDesde} onChange={(e) => setPrecios({ ...precios, vigenteDesde: e.target.value })} />
                </label>
                <label>
                  Motivo del cambio
                  <textarea minLength={5} maxLength={255} required placeholder="Por ejemplo: actualización mensual del gimnasio" value={precios.motivo} onChange={(e) => setPrecios({ ...precios, motivo: e.target.value })} />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn primary" disabled={accionPrecios.enviando}>
                    Guardar nuevos precios
                  </button>
                </div>
              </>
            )}
          </form>
          <div className="divider" />
          <FilaDato etiqueta="Básico con débito automático">{dinero(conDebito(vBasico))}</FilaDato>
          <FilaDato etiqueta="Premium de lista">{dinero(vBasico + vPremium)}</FilaDato>
          <FilaDato etiqueta="Premium con débito automático">{dinero(conDebito(vBasico + vPremium))}</FilaDato>
          <p className="page-note">Descuento fijo del 10% sobre el total, exclusivamente por débito automático. Es independiente de los beneficios por asistencia.</p>
        </section>
        {verPoliticas && politica && (
          <section className="card">
            <CabeceraTarjeta titulo="Política de recepción" subtitulo="Validaciones que se aplican a la reserva." />
            <form onSubmit={guardarPolitica}>
              <ErrorFormulario>{accionPolitica.error}</ErrorFormulario>
              <label>
                Minutos permitidos antes del turno
                <input type="number" min={0} max={240} required disabled={!gestionPoliticas} value={politica.toleranciaAntesMin} onChange={(e) => setPolitica({ ...politica, toleranciaAntesMin: Number(e.target.value) })} />
              </label>
              <label>
                Minutos permitidos después del inicio
                <input type="number" min={0} max={240} required disabled={!gestionPoliticas} value={politica.toleranciaDespuesMin} onChange={(e) => setPolitica({ ...politica, toleranciaDespuesMin: Number(e.target.value) })} />
              </label>
              <label>
                Si la cuota está pendiente
                <select disabled={!gestionPoliticas} value={politica.politicaCuotaPendiente} onChange={(e) => setPolitica({ ...politica, politicaCuotaPendiente: e.target.value as Gimnasio['politicaCuotaPendiente'] })}>
                  <option value="BLOQUEAR">Bloquear</option>
                  <option value="AUTORIZAR">Autorizar</option>
                </select>
              </label>
              <p className="modal-text">
                La reserva, la sede y la fecha deben ser válidas. Los duplicados del mismo turno se rechazan; se admiten otras reservas del día. Ante una cuota pendiente, recepción muestra la sugerencia
                de la política y el personal decide; la autorización excepcional exige un motivo y queda registrada.
              </p>
              {gestionPoliticas && (
                <div className="form-actions">
                  <button type="submit" className="btn primary" disabled={accionPolitica.enviando}>
                    Guardar política
                  </button>
                </div>
              )}
            </form>
          </section>
        )}
      </div>
      <section className="card section-gap">
        <CabeceraTarjeta titulo="Historial de precios" subtitulo="Los comprobantes emitidos mantienen sus valores." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Plan</th>
                <th>Importe</th>
                <th>Vigente desde</th>
                <th>Responsable</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.id}>
                  <td>{fechaHora(h.fecha)}</td>
                  <td>{h.tipo === 'BASICO' ? 'Básico' : 'Adicional Premium'}</td>
                  <td>
                    {dinero(h.importeNuevo)}
                    <small>Antes {dinero(h.importeAnterior)}</small>
                  </td>
                  <td>{fechaLarga(h.vigenteDesde)}</td>
                  <td>{h.responsable ? `${h.responsable.usuario.nombre} ${h.responsable.usuario.apellido}` : '—'}</td>
                  <td>{h.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {planes.datos && historial.length === 0 && <Vacio titulo="Sin cambios de precio registrados" descripcion="Cada actualización queda registrada con su responsable." icono="receipt" />}
      </section>
    </>
  );
}
