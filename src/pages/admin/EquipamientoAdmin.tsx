import { useState } from 'react';
import { Icono } from '../../components/Icono';
import { ModalBajaEquipo, ModalEquipo, ModalHistorialEquipo, ModalProgramarMantenimiento, type Equipo } from '../../components/ModalesEquipamiento';
import { Boton, CabeceraTarjeta, Encabezado, Estado, Kpi, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useApi } from '../../hooks/useApi';
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

/** Inventario de equipamiento (RF20, Figura 60): alta, historial, disponibilidad y baja. */
export function EquipamientoAdmin() {
  const { puede } = useAuth();
  const gestion = puede('EQUIPAMIENTO', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [filtros, setFiltros] = useState({ busqueda: '', estado: '', categoria: '' });
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const equipos = useApi(() => api.get<Equipo[]>('/admin/equipos', { ...(sedeId ? { sedeId } : {}), incluirBajas: 'true' }), [sedeId]);
  const alertas = useApi(() => api.get<Alerta[]>('/admin/equipos/alertas'));
  const [historial, setHistorial] = useState<number | null>(null);
  const [editar, setEditar] = useState<Partial<Equipo> | null>(null);
  const [baja, setBaja] = useState<Equipo | null>(null);
  const [agendar, setAgendar] = useState<{ equipoId?: number } | null>(null);

  const q = filtros.busqueda.trim().toLowerCase();
  const lista = (equipos.datos ?? []).filter(
    (e) => (!q || e.nombre.toLowerCase().includes(q)) && (filtros.estado ? e.estado === filtros.estado : e.estado !== 'DADO_DE_BAJA') && (!filtros.categoria || e.categoria === filtros.categoria),
  );
  const activos = (equipos.datos ?? []).filter((e) => e.estado !== 'DADO_DE_BAJA');
  const categorias = [...new Set(equipos.datos?.map((e) => e.categoria))];
  const recargar = () => {
    void equipos.recargar();
    void alertas.recargar();
  };
  const alertasVista = (alertas.datos ?? []).filter((a) => !sedeId || activos.some((e) => e.id === a.equipoId));

  return (
    <>
      <Encabezado
        ceja="OPERACIÓN Y CUIDADO"
        titulo="Equipamiento"
        subtitulo="Revisá disponibilidad, reportes, antigüedad y mantenimientos por máquina."
        accion={
          gestion && (
            <div className="table-actions">
              <Boton icono="plus" onClick={() => setEditar({})}>
                Registrar equipo
              </Boton>
              <Boton icono="calendar" onClick={() => setAgendar({})}>
                Agendar service
              </Boton>
            </div>
          )
        }
      />
      <div className="kpi-grid">
        <Kpi etiqueta="Equipos en esta vista" valor={activos.length} pie="Inventario activo" icono="dumbbell" />
        <Kpi etiqueta="Operativos" valor={activos.filter((e) => e.estado === 'OPERATIVO').length} pie="Disponibilidad registrada" icono="check" />
        <Kpi etiqueta="Fuera de servicio" valor={activos.filter((e) => e.estado === 'FUERA_DE_SERVICIO').length} pie="Requieren revisión" icono="tool" />
        <Kpi etiqueta="Services programados" valor={activos.filter((e) => e.estado === 'SERVICE_PROGRAMADO').length} pie="Mantenimiento preventivo" icono="calendar" />
      </div>
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar equipo" placeholder="Buscar equipo" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
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
            <option value="">Todos (en inventario)</option>
            {['OPERATIVO', 'FUERA_DE_SERVICIO', 'SERVICE_PROGRAMADO', 'DADO_DE_BAJA'].map((s) => (
              <option key={s} value={s}>
                {etiqueta(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Categoría</span>
          <select aria-label="Categoría" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>
            <option value="">Todos</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Boton
          estilo="outline"
          chico
          icono="refresh"
          className="clear-filters"
          onClick={() => {
            setFiltros({ busqueda: '', estado: '', categoria: '' });
            setSedeId('');
          }}
        >
          Limpiar filtros
        </Boton>
      </div>
      <section className="card">
        <CabeceraTarjeta titulo="Inventario de equipamiento" subtitulo="El administrador confirma los cambios de disponibilidad." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Sede</th>
                <th>Estado</th>
                <th>Fecha de compra</th>
                <th>Vida útil estimada</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="table-avatar">
                      <div className="exercise-icon" style={{ width: 32, height: 32 }}>
                        <Icono n={/cardio/i.test(e.categoria) ? 'activity' : 'dumbbell'} />
                      </div>
                      <div>
                        <strong>{e.nombre}</strong>
                        <small>{e.categoria}</small>
                      </div>
                    </div>
                  </td>
                  <td>{e.sede.nombre}</td>
                  <td>
                    <Estado valor={e.estado} />
                  </td>
                  <td>{e.fechaCompra ? fechaLarga(e.fechaCompra) : '—'}</td>
                  <td>{e.vidaUtilAnios ? `${e.vidaUtilAnios} años` : '—'}</td>
                  <td>
                    <div className="table-actions">
                      <Boton estilo="outline" chico icono="chevron" onClick={() => setHistorial(e.id)}>
                        Historial
                      </Boton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {equipos.datos && lista.length === 0 && <Vacio titulo="Sin equipos para estos filtros" descripcion="Probá con otra búsqueda o limpiá los filtros." icono="search" />}
      </section>
      <aside className="soft-alert section-gap">
        <Icono n="clipboard" />
        <div>
          <h4>Alertas para evaluar, con criterio humano</h4>
          <p>
            {alertasVista.length
              ? `${alertasVista.length} ${alertasVista.length === 1 ? 'equipo tiene' : 'equipos tienen'} un service o un recambio próximo. `
              : 'No hay services ni recambios próximos. '}
            La antigüedad y la vida útil estimada pueden orientar una revisión. La plataforma no decide automáticamente el recambio de una máquina.
          </p>
        </div>
      </aside>

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
          onAgendar={(e) => {
            setHistorial(null);
            setAgendar({ equipoId: e.id });
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
      {agendar && (
        <ModalProgramarMantenimiento
          equipos={activos}
          equipoId={agendar.equipoId}
          alCerrar={() => setAgendar(null)}
          alGuardar={() => {
            setAgendar(null);
            recargar();
          }}
        />
      )}
    </>
  );
}
