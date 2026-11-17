import { useState, type FormEvent } from 'react';
import { Icono } from '../../components/Icono';
import { fechaHora, ModalBajaEquipo, ModalEquipo, ModalHistorialEquipo, ModalProgramarMantenimiento, type Equipo, type Mantenimiento as MantenimientoFila } from '../../components/ModalesEquipamiento';
import { Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, Insignia, Modal, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { etiqueta, fechaLarga } from '../../utils/formato';

interface Alerta {
  equipoId: number;
  equipo: string;
  sede: string;
  tipo: 'SERVICE' | 'RECAMBIO';
  fecha: string;
  vencida: boolean;
}

/** Mantenimiento (RF22, Figura 62): agenda de intervenciones, registro de lo realizado y alertas. */
export function Mantenimiento() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('EQUIPAMIENTO', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [filtros, setFiltros] = useState({ busqueda: '', estado: '' });
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const mantenimientos = useApi(() => api.get<MantenimientoFila[]>('/admin/mantenimientos', sedeId ? { sedeId } : {}), [sedeId]);
  const equipos = useApi(() => api.get<Equipo[]>('/admin/equipos', sedeId ? { sedeId } : {}), [sedeId]);
  const alertas = useApi(() => api.get<Alerta[]>('/admin/equipos/alertas'));
  const [programar, setProgramar] = useState(false);
  const [realizado, setRealizado] = useState<MantenimientoFila | null>(null);
  const [historial, setHistorial] = useState<number | null>(null);
  const [editar, setEditar] = useState<Equipo | null>(null);
  const [baja, setBaja] = useState<Equipo | null>(null);

  const q = filtros.busqueda.trim().toLowerCase();
  const lista = (mantenimientos.datos ?? []).filter(
    (m) => (!q || m.equipo.nombre.toLowerCase().includes(q) || (m.intervencionPrevista ?? '').toLowerCase().includes(q)) && (!filtros.estado || m.estado === filtros.estado),
  );
  const activos = (equipos.datos ?? []).filter((e) => e.estado !== 'DADO_DE_BAJA');
  const alertasVista = (alertas.datos ?? []).filter((a) => !sedeId || activos.some((e) => e.id === a.equipoId));
  const recargar = () => {
    void mantenimientos.recargar();
    void equipos.recargar();
    void alertas.recargar();
  };

  return (
    <>
      <Encabezado
        ceja="CUIDADO DEL EQUIPAMIENTO"
        titulo="Mantenimiento"
        subtitulo="Programá intervenciones con fecha y horario, y registrá lo realizado."
        accion={
          gestion && (
            <Boton icono="calendar" onClick={() => setProgramar(true)}>
              Programar mantenimiento
            </Boton>
          )
        }
      />
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar equipo o intervención" placeholder="Buscar equipo o intervención" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
          </div>
        </label>
        <label className="filter-field">
          <span>Sede</span>
          <select aria-label="Filtrar por sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Todas las sedes</option>
            {sedes.datos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select aria-label="Estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="PROGRAMADO">Programado</option>
            <option value="REALIZADO">Realizado</option>
          </select>
        </label>
        <Boton
          estilo="outline"
          chico
          icono="refresh"
          className="clear-filters"
          onClick={() => {
            setFiltros({ busqueda: '', estado: '' });
            setSedeId('');
          }}
        >
          Limpiar filtros
        </Boton>
      </div>
      <section className="card">
        <CabeceraTarjeta titulo="Agenda de intervenciones" subtitulo="La disponibilidad se comunica a los socios afectados." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Indisponibilidad</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.equipo.nombre}</strong>
                    <small>{m.equipo.sede.nombre}</small>
                  </td>
                  <td>{etiqueta(m.tipo)}</td>
                  <td>
                    {fechaHora(m.inicioProgramado)}
                    <small>Hasta {fechaHora(m.finProgramado)}</small>
                  </td>
                  <td>
                    <Insignia color={m.estado === 'REALIZADO' ? 'neutral' : ''}>{etiqueta(m.estado)}</Insignia>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Boton estilo="outline" chico icono="clipboard" onClick={() => setHistorial(m.equipoId)}>
                        Historial
                      </Boton>
                      {gestion && m.estado === 'PROGRAMADO' && (
                        <Boton chico icono="check" onClick={() => setRealizado(m)}>
                          Registrar realización
                        </Boton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mantenimientos.datos && lista.length === 0 && <Vacio titulo="Sin intervenciones para estos filtros" descripcion="Programá un mantenimiento o limpiá los filtros." icono="calendar" />}
      </section>
      <section className="card section-gap">
        <CabeceraTarjeta titulo="Revisión de vida útil" subtitulo="La decisión de reparar o reemplazar corresponde al gimnasio." />
        <div className="equipment-life-grid">
          {activos
            .filter((e) => e.fechaCompra || e.vidaUtilAnios)
            .map((e) => (
              <div key={e.id}>
                <h3>{e.nombre}</h3>
                <p>
                  Compra: {e.fechaCompra ? fechaLarga(e.fechaCompra) : 'sin dato'}
                  <br />
                  Vida útil estimada: {e.vidaUtilAnios ? `${e.vidaUtilAnios} años` : 'sin dato'}
                </p>
                <Boton estilo="outline" chico icono="chevron" onClick={() => setHistorial(e.id)}>
                  Revisar historial
                </Boton>
              </div>
            ))}
        </div>
      </section>
      <section className="card section-gap">
        <CabeceraTarjeta titulo="Alertas de service y revisión" subtitulo="Las decisiones de mantenimiento, reparación y recambio corresponden al gimnasio." />
        <div className="notice-list">
          {alertasVista.map((a) => (
            <div key={`${a.equipoId}-${a.tipo}`} className="notice">
              <Icono n={a.vencida ? 'warning' : 'tool'} />
              <div>
                <h4>
                  {a.equipo} · {a.sede}
                </h4>
                <p>
                  {a.tipo === 'SERVICE' ? 'Próximo service' : 'Fin de vida útil estimada'}: {fechaLarga(a.fecha)}
                  {a.vencida ? ' · vencido' : ''}
                </p>
              </div>
            </div>
          ))}
          {alertas.datos && alertasVista.length === 0 && <p className="page-note">No hay services ni recambios en los próximos días.</p>}
        </div>
      </section>

      {programar && (
        <ModalProgramarMantenimiento
          equipos={activos}
          alCerrar={() => setProgramar(false)}
          alGuardar={() => {
            setProgramar(false);
            recargar();
          }}
        />
      )}
      {realizado && (
        <RegistrarRealizado
          mantenimiento={realizado}
          alCerrar={() => setRealizado(null)}
          alGuardar={() => {
            setRealizado(null);
            toast('Intervención registrada en el historial del equipo.');
            recargar();
          }}
        />
      )}
      {historial !== null && (
        <ModalHistorialEquipo
          equipoId={historial}
          gestion={gestion}
          alCerrar={() => setHistorial(null)}
          alCambiar={recargar}
          onEditar={(e) => {
            setHistorial(null);
            setEditar(e);
          }}
          onAgendar={() => {
            setHistorial(null);
            setProgramar(true);
          }}
          onBaja={(e) => {
            setHistorial(null);
            setBaja(e);
          }}
        />
      )}
      {editar && (
        <ModalEquipo
          equipo={editar}
          sedes={sedes.datos ?? []}
          sedeInicial={sedeId}
          alCerrar={() => setEditar(null)}
          alGuardar={() => {
            setEditar(null);
            recargar();
          }}
        />
      )}
      {baja && (
        <ModalBajaEquipo
          equipo={baja}
          alCerrar={() => setBaja(null)}
          alGuardar={() => {
            setBaja(null);
            recargar();
          }}
        />
      )}
    </>
  );
}

/** "Registrar mantenimiento realizado" (Figura 62 c). */
function RegistrarRealizado({ mantenimiento: m, alCerrar, alGuardar }: { mantenimiento: MantenimientoFila; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({ detalle: '', operativo: true, proximoService: '' });
  const accion = useAccion();
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (f.detalle.trim().length < 5) return accion.setError('Describí la intervención realizada.');
    const ok = await accion.ejecutar(async () => {
      await api.patch(`/admin/mantenimientos/${m.id}/realizado`, { detalleRealizado: f.detalle, ...(f.proximoService ? { proximoService: f.proximoService } : {}) });
      // El backend deja operativo un equipo en service programado; si estaba fuera de servicio, se confirma aquí.
      if (f.operativo) await api.patch(`/admin/equipos/${m.equipoId}/disponibilidad`, { estado: 'OPERATIVO' }).catch(() => undefined);
      return true;
    });
    if (ok) alGuardar();
  };
  return (
    <Modal titulo="Registrar mantenimiento realizado" subtitulo="Queda incorporado al historial del equipo." abierto onCerrar={alCerrar}>
      <form onSubmit={guardar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <label>
          Detalle de la intervención realizada
          <textarea required maxLength={2000} value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} />
        </label>
        <label className="check-field">
          <input type="checkbox" checked={f.operativo} onChange={(e) => setF({ ...f, operativo: e.target.checked })} />
          Confirmar equipo operativo después de la intervención
        </label>
        <label>
          Próximo service (opcional)
          <input type="date" value={f.proximoService} onChange={(e) => setF({ ...f, proximoService: e.target.value })} />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={accion.enviando}>
            Guardar intervención
          </button>
        </div>
      </form>
    </Modal>
  );
}
