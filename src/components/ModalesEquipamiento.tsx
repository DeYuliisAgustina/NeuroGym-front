import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useAccion } from '../hooks/useApi';
import { api } from '../services/api';
import type { EstadoEquipo, Sede } from '../types';
import { etiqueta, fechaLarga, hoyIso } from '../utils/formato';
import { Boton, ErrorFormulario, Estado, FilaDato, Modal } from './ui';

export interface Equipo {
  id: number;
  nombre: string;
  categoria: string;
  estado: EstadoEquipo;
  fechaCompra: string | null;
  vidaUtilAnios: number | null;
  proximoService: string | null;
  fechaBaja: string | null;
  sede: { nombre: string };
  sedeId: number;
}
export interface Mantenimiento {
  id: number;
  equipoId: number;
  tipo: string;
  estado: string;
  inicioProgramado: string;
  finProgramado: string;
  intervencionPrevista: string | null;
  detalleRealizado: string | null;
  equipo: { nombre: string; sede: { nombre: string } };
}
interface Historial {
  equipo: Equipo;
  incidencias: { id: number; fecha: string; descripcion: string; estado: string; reportante: { usuario: { nombre: string; apellido: string } } }[];
  mantenimientos: { id: number; tipo: string; estado: string; inicioProgramado: string; detalleRealizado: string | null; intervencionPrevista: string | null }[];
}

export const fechaHora = (f: string) =>
  new Date(f).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
/** Valor para un input datetime-local a partir de "ahora + horas". */
const localDentroDe = (horas: number) => {
  const d = new Date(Date.now() + horas * 3_600_000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Historial del equipo (Figura 60 c): disponibilidad, incidencias y mantenimientos. */
export function ModalHistorialEquipo({
  equipoId,
  gestion,
  alCerrar,
  alCambiar,
  onEditar,
  onAgendar,
  onBaja,
}: {
  equipoId: number;
  gestion: boolean;
  alCerrar: () => void;
  alCambiar: () => void;
  onEditar: (e: Equipo) => void;
  onAgendar: (e: Equipo) => void;
  onBaja: (e: Equipo) => void;
}) {
  const toast = useToast();
  const [h, setH] = useState<Historial | null>(null);
  const [estado, setEstado] = useState<EstadoEquipo>('OPERATIVO');
  const accion = useAccion();
  useEffect(() => {
    void api.get<Historial>(`/admin/equipos/${equipoId}/historial`).then((d) => {
      setH(d);
      setEstado(d.equipo.estado);
    });
  }, [equipoId]);
  const e = h?.equipo;
  const baja = e?.estado === 'DADO_DE_BAJA';
  const actualizar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (await accion.ejecutar(() => api.patch(`/admin/equipos/${equipoId}/disponibilidad`, { estado }))) {
      toast('Disponibilidad actualizada. Se avisó a los socios afectados.');
      alCambiar();
      alCerrar();
    }
  };
  const linea = [
    ...(h?.incidencias.map((i) => ({ fecha: i.fecha, titulo: `Incidencia · ${etiqueta(i.estado)}`, texto: `${i.descripcion} (${i.reportante.usuario.nombre} ${i.reportante.usuario.apellido})` })) ?? []),
    ...(h?.mantenimientos.map((m) => ({ fecha: m.inicioProgramado, titulo: `${etiqueta(m.tipo)} · ${etiqueta(m.estado)}`, texto: m.detalleRealizado ?? m.intervencionPrevista ?? '' })) ?? []),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <Modal
      titulo={e?.nombre ?? 'Equipo'}
      subtitulo={e ? `${e.categoria} · Sede ${e.sede.nombre}` : ''}
      abierto
      onCerrar={alCerrar}
      pie={
        e &&
        gestion &&
        !baja && (
          <>
            <Boton estilo="danger" onClick={() => onBaja(e)}>
              Dar de baja
            </Boton>
            <Boton estilo="outline" icono="edit" onClick={() => onEditar(e)}>
              Editar
            </Boton>
            <Boton icono="calendar" onClick={() => onAgendar(e)}>
              Agendar service
            </Boton>
          </>
        )
      }
    >
      {!e ? (
        <p className="modal-text">Cargando historial…</p>
      ) : (
        <>
          <div className="spread">
            <Estado valor={e.estado} />
            <span className="muted" style={{ fontSize: 11 }}>
              Compra · {e.fechaCompra ? fechaLarga(e.fechaCompra) : 'sin dato'}
            </span>
          </div>
          <FilaDato etiqueta="Vida útil estimada">{e.vidaUtilAnios ? `${e.vidaUtilAnios} años` : 'Sin dato'}</FilaDato>
          <FilaDato etiqueta="Próximo mantenimiento">{e.proximoService ? fechaLarga(e.proximoService) : 'Sin programar'}</FilaDato>
          {baja && <FilaDato etiqueta="Fecha de baja">{e.fechaBaja ? fechaLarga(e.fechaBaja) : '—'}</FilaDato>}
          <div className="divider" />
          {gestion && !baja && (
            <>
              <form onSubmit={actualizar}>
                <ErrorFormulario>{accion.error}</ErrorFormulario>
                <label>
                  Disponibilidad del equipo
                  <select value={estado} onChange={(x) => setEstado(x.target.value as EstadoEquipo)}>
                    {(['OPERATIVO', 'FUERA_DE_SERVICIO', 'SERVICE_PROGRAMADO'] as const).map((s) => (
                      <option key={s} value={s}>
                        {etiqueta(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button className="btn soft small" type="submit" disabled={estado === e.estado || accion.enviando}>
                    Actualizar disponibilidad
                  </button>
                </div>
              </form>
              <div className="divider" />
            </>
          )}
          <h3 style={{ fontSize: 14 }}>Historial del equipo</h3>
          <div className="timeline">
            {linea.map((l, i) => (
              <article key={i} className="timeline-item">
                <small>{fechaLarga(l.fecha)}</small>
                <h4>{l.titulo}</h4>
                <p>{l.texto}</p>
              </article>
            ))}
            {linea.length === 0 && <p className="modal-text">Sin incidencias ni mantenimientos registrados.</p>}
          </div>
          <p className="page-note">La vida útil orienta una revisión. El recambio queda a criterio del administrador.</p>
        </>
      )}
    </Modal>
  );
}

/** Alta o edición de un equipo (Figura 60 b). */
export function ModalEquipo({ equipo, sedes, sedeInicial, alCerrar, alGuardar }: { equipo: Partial<Equipo>; sedes: Sede[]; sedeInicial: string; alCerrar: () => void; alGuardar: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    sedeId: String(equipo.sedeId ?? (sedeInicial || sedes.find((s) => s.habilitada)?.id || '')),
    nombre: equipo.nombre ?? '',
    categoria: equipo.categoria ?? '',
    fechaCompra: equipo.fechaCompra?.slice(0, 10) ?? '',
    vidaUtilAnios: equipo.vidaUtilAnios ? String(equipo.vidaUtilAnios) : '',
    proximoService: equipo.proximoService?.slice(0, 10) ?? '',
  });
  const accion = useAccion();
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.nombre.trim() || !f.categoria.trim()) return accion.setError('Completá el nombre y la categoría.');
    const datos = {
      nombre: f.nombre,
      categoria: f.categoria,
      fechaCompra: f.fechaCompra || null,
      vidaUtilAnios: f.vidaUtilAnios ? Number(f.vidaUtilAnios) : null,
      proximoService: f.proximoService || null,
    };
    const ok = await accion.ejecutar(() => (equipo.id ? api.put(`/admin/equipos/${equipo.id}`, datos) : api.post('/admin/equipos', { ...datos, sedeId: Number(f.sedeId) })));
    if (ok) {
      toast(equipo.id ? 'Equipo actualizado.' : 'Equipo registrado en el inventario.');
      alGuardar();
    }
  };
  return (
    <Modal titulo={equipo.id ? 'Editar equipo' : 'Registrar equipo'} subtitulo="Datos del inventario de la sede." abierto onCerrar={alCerrar}>
      <form onSubmit={guardar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label className="wide">
            Sede
            <select required disabled={!!equipo.id} value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.habilitada}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nombre del equipo
            <input required maxLength={100} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label>
            Categoría
            <input required maxLength={50} list="categorias-equipo" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} />
            <datalist id="categorias-equipo">
              {['Tren inferior', 'Tren superior', 'Cardio', 'Peso libre', 'Funcional'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Fecha de compra
            <input type="date" max={hoyIso()} value={f.fechaCompra} onChange={(e) => setF({ ...f, fechaCompra: e.target.value })} />
          </label>
          <label>
            Vida útil estimada (años)
            <input type="number" min={1} max={50} value={f.vidaUtilAnios} onChange={(e) => setF({ ...f, vidaUtilAnios: e.target.value })} />
          </label>
          <label className="wide">
            Próximo service
            <input type="date" value={f.proximoService} onChange={(e) => setF({ ...f, proximoService: e.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Cancelar
          </Boton>
          <button type="submit" className="btn primary" disabled={accion.enviando}>
            Guardar equipo
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** "Dar de baja del inventario" (Figura 60 d): baja lógica con historial conservado. */
export function ModalBajaEquipo({ equipo, alCerrar, alGuardar }: { equipo: Equipo; alCerrar: () => void; alGuardar: () => void }) {
  const toast = useToast();
  const [fechaBaja, setFechaBaja] = useState(hoyIso());
  const [motivo, setMotivo] = useState('');
  const accion = useAccion();
  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return accion.setError('Indicá el motivo de la baja.');
    if (await accion.ejecutar(() => api.patch(`/admin/equipos/${equipo.id}/baja`, { motivo, fechaBaja }))) {
      toast('Equipo dado de baja del inventario. Su historial se conserva.');
      alGuardar();
    }
  };
  return (
    <Modal titulo="Dar de baja del inventario" subtitulo={`${equipo.nombre} · ${equipo.categoria} · Sede ${equipo.sede.nombre}`} abierto onCerrar={alCerrar}>
      <form onSubmit={confirmar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="soft-alert">
          <div>
            <p>
              La baja retira el equipo del inventario de forma definitiva. Para una indisponibilidad temporal, usá la disponibilidad <strong>Fuera de servicio</strong> o <strong>Service programado</strong>.
            </p>
          </div>
        </div>
        <label style={{ marginTop: 18 }}>
          Fecha de baja
          <input type="date" required value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} />
        </label>
        <label>
          Disponibilidad actual
          <input value={etiqueta(equipo.estado)} disabled />
        </label>
        <label>
          Motivo de la baja
          <textarea required maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <p className="page-note">El equipo deja de figurar como disponible y no puede volver a habilitarse. Se conservan sus incidencias, mantenimientos e historial para su consulta.</p>
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Cancelar
          </Boton>
          <button type="submit" className="btn primary" disabled={accion.enviando}>
            Confirmar baja
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** "Programar mantenimiento" (Figura 62 b, RF22): avisa a los socios con reservas afectadas. */
export function ModalProgramarMantenimiento({ equipos, equipoId, alCerrar, alGuardar }: { equipos: Equipo[]; equipoId?: number; alCerrar: () => void; alGuardar: () => void }) {
  const toast = useToast();
  const activos = equipos.filter((e) => e.estado !== 'DADO_DE_BAJA');
  const [f, setF] = useState({ equipoId: String(equipoId ?? activos[0]?.id ?? ''), tipo: 'PREVENTIVO', desde: localDentroDe(24), hasta: localDentroDe(27), intervencion: '' });
  const accion = useAccion();
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.equipoId) return accion.setError('Elegí el equipo.');
    if (f.hasta <= f.desde) return accion.setError('El fin debe ser posterior al inicio.');
    if (f.intervencion.trim().length < 8) return accion.setError('Describí la intervención prevista (al menos 8 caracteres).');
    const r = await accion.ejecutar(() =>
      api.post<{ sociosAvisados: number }>('/admin/mantenimientos', {
        equipoId: Number(f.equipoId),
        tipo: f.tipo,
        inicioProgramado: new Date(f.desde).toISOString(),
        finProgramado: new Date(f.hasta).toISOString(),
        intervencionPrevista: f.intervencion,
      }),
    );
    if (r) {
      toast(r.sociosAvisados ? `Mantenimiento programado. Se avisó a ${r.sociosAvisados} socios con reservas afectadas.` : 'Mantenimiento programado.');
      alGuardar();
    }
  };
  return (
    <Modal titulo="Programar mantenimiento" subtitulo="La reserva del socio se conserva hasta que elija un cambio." abierto onCerrar={alCerrar}>
      <form onSubmit={guardar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label className="wide">
            Equipo
            <select required value={f.equipoId} onChange={(e) => setF({ ...f, equipoId: e.target.value })}>
              {activos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} · {m.sede.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="PREVENTIVO">Preventivo</option>
              <option value="CORRECTIVO">Correctivo</option>
            </select>
          </label>
          <span />
          <label>
            Desde
            <input type="datetime-local" required value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          </label>
          <label>
            Hasta
            <input type="datetime-local" required value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          </label>
          <label className="wide">
            Intervención prevista
            <textarea required minLength={8} maxLength={2000} value={f.intervencion} onChange={(e) => setF({ ...f, intervencion: e.target.value })} />
          </label>
        </div>
        <p className="page-note">
          Se avisa a los socios si el mantenimiento coincide con una reserva y un equipo de su rutina. El socio puede mantener su turno con una variante o elegir otro horario.
        </p>
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Cancelar
          </Boton>
          <button type="submit" className="btn primary" disabled={accion.enviando}>
            Programar mantenimiento
          </button>
        </div>
      </form>
    </Modal>
  );
}
