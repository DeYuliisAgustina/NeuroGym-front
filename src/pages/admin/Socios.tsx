import { useState } from 'react';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Estado, Modal, Selector, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { dinero, etiqueta, fecha } from '../../utils/formato';
import { validarSocio } from '../../validations/formularios';

interface SocioFila {
  id: number;
  telefono: string;
  saldoPuntos: number;
  usuario: { id: number; email: string; nombre: string; apellido: string; activo: boolean; fechaAlta: string };
  plan: { tipo: 'BASICO' | 'PREMIUM' };
  sede: { id: number; nombre: string };
}
interface DetalleSocio extends SocioFila {
  cuotas: { id: number; periodo: string; estado: string; importeFinal: string }[];
  reservas: { id: number; estado: string; turno: { actividad: string; fecha: string; sede: { nombre: string } }; asistencia: unknown }[];
  bonificacionVigente: { hasta: string } | null;
}

const vacio = { email: '', nombre: '', apellido: '', telefono: '', sedeId: '', plan: 'BASICO', consentimientoDatos: false };

/** Gestión de socios (RF16): alta, consulta, modificación y desactivación lógica y reversible (RD20). */
export function Socios() {
  const { puede } = useAuth();
  const gestion = puede('SOCIOS', 'GESTION');
  const [filtros, setFiltros] = useState({ busqueda: '', sedeId: '', plan: '', activo: 'true' });
  const socios = useApi(() => api.get<SocioFila[]>('/admin/socios', filtros), [filtros.busqueda, filtros.sedeId, filtros.plan, filtros.activo]);
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const [formulario, setFormulario] = useState<typeof vacio & { id?: number }>(vacio);
  const [abierto, setAbierto] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [password, setPassword] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleSocio | null>(null);
  const accion = useAccion();

  const abrirAlta = () => {
    setFormulario(vacio);
    setErrores({});
    setAbierto(true);
  };
  const abrirEdicion = (s: SocioFila) => {
    setFormulario({ id: s.id, email: s.usuario.email, nombre: s.usuario.nombre, apellido: s.usuario.apellido, telefono: s.telefono, sedeId: String(s.sede.id), plan: s.plan.tipo, consentimientoDatos: true });
    setErrores({});
    setAbierto(true);
  };
  const guardar = async () => {
    const v = validarSocio(formulario);
    setErrores(v);
    if (Object.keys(v).length) return;
    const datos = { nombre: formulario.nombre, apellido: formulario.apellido, telefono: formulario.telefono, sedeId: Number(formulario.sedeId), plan: formulario.plan };
    if (formulario.id) {
      if (await accion.ejecutar(() => api.put(`/admin/socios/${formulario.id}`, datos), 'Socio actualizado.')) {
        setAbierto(false);
        void socios.recargar();
      }
    } else {
      const r = await accion.ejecutar(() => api.post<{ passwordTemporal: string }>('/admin/socios', { ...datos, email: formulario.email, consentimientoDatos: true }), 'Socio registrado.');
      if (r) {
        setAbierto(false);
        setPassword(r.passwordTemporal);
        void socios.recargar();
      }
    }
  };
  const cambiarEstado = async (s: SocioFila) => {
    const activo = !s.usuario.activo;
    const texto = activo ? '¿Reactivar al socio?' : 'El socio no podrá ingresar ni reservar. Se conservan sus cuotas, pagos, turnos y asistencias. ¿Desactivar?';
    if (!window.confirm(texto)) return;
    if (await accion.ejecutar(() => api.patch(`/admin/socios/${s.id}/estado`, { activo }), activo ? 'Socio reactivado.' : 'Socio desactivado.')) void socios.recargar();
  };
  const verDetalle = async (id: number) => {
    const d = await accion.ejecutar(() => api.get<DetalleSocio>(`/admin/socios/${id}`));
    if (d) setDetalle(d);
  };

  return (
    <div>
      <EncabezadoPagina titulo="Socios" acciones={gestion && <Boton onClick={abrirAlta}>Nuevo socio</Boton>} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      {password && (
        <Aviso tipo="alerta">
          Contraseña temporal del socio: <strong>{password}</strong>. Entregásela personalmente; se muestra una sola vez y el socio puede cambiarla desde su perfil.{' '}
          <button className="btn btn-texto btn-chico" onClick={() => setPassword(null)}>Ocultar</button>
        </Aviso>
      )}
      <div className="tarjeta">
        <div className="grilla-4">
          <Campo etiqueta="Buscar" placeholder="Nombre o correo" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
          <Selector etiqueta="Sede" vacio="Todas" value={filtros.sedeId} onChange={(e) => setFiltros({ ...filtros, sedeId: e.target.value })} opciones={(sedes.datos ?? []).map((s) => ({ valor: s.id, texto: s.nombre }))} />
          <Selector etiqueta="Plan" vacio="Todos" value={filtros.plan} onChange={(e) => setFiltros({ ...filtros, plan: e.target.value })} opciones={[{ valor: 'BASICO', texto: 'Básico' }, { valor: 'PREMIUM', texto: 'Premium' }]} />
          <Selector etiqueta="Estado" vacio="Todos" value={filtros.activo} onChange={(e) => setFiltros({ ...filtros, activo: e.target.value })} opciones={[{ valor: 'true', texto: 'Activos' }, { valor: 'false', texto: 'Desactivados' }]} />
        </div>
        {socios.cargando && <Cargando />}
        {socios.datos?.length === 0 && <Vacio>No encontramos socios.</Vacio>}
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Socio</th>
                <th>Sede</th>
                <th>Plan</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {socios.datos?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="btn btn-texto btn-chico" onClick={() => verDetalle(s.id)}>
                      {s.usuario.apellido}, {s.usuario.nombre}
                    </button>
                    <div className="tenue" style={{ fontSize: '0.82rem' }}>{s.usuario.email}</div>
                  </td>
                  <td>{s.sede.nombre}</td>
                  <td>{etiqueta(s.plan.tipo)}</td>
                  <td>{s.usuario.activo ? <span className="etiqueta etiqueta-ok">Activo</span> : <span className="etiqueta etiqueta-mal">Desactivado</span>}</td>
                  <td>
                    {gestion && (
                      <div className="fila">
                        <Boton variante="texto" chico onClick={() => abrirEdicion(s)}>Editar</Boton>
                        <Boton variante="texto" chico onClick={() => cambiarEstado(s)}>{s.usuario.activo ? 'Desactivar' : 'Reactivar'}</Boton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal titulo={formulario.id ? 'Modificar socio' : 'Nuevo socio'} abierto={abierto} onCerrar={() => setAbierto(false)}>
        <Aviso tipo="error">{accion.error}</Aviso>
        <div className="grilla-2">
          <Campo etiqueta="Nombre" value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} error={errores.nombre} />
          <Campo etiqueta="Apellido" value={formulario.apellido} onChange={(e) => setFormulario({ ...formulario, apellido: e.target.value })} error={errores.apellido} />
        </div>
        <Campo etiqueta="Correo electrónico" type="email" disabled={!!formulario.id} value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} error={errores.email} />
        <Campo etiqueta="Teléfono (WhatsApp)" value={formulario.telefono} onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} error={errores.telefono} />
        <div className="grilla-2">
          <Selector etiqueta="Sede" vacio="Elegí una sede" value={formulario.sedeId} onChange={(e) => setFormulario({ ...formulario, sedeId: e.target.value })} error={errores.sedeId} opciones={(sedes.datos ?? []).filter((s) => s.habilitada).map((s) => ({ valor: s.id, texto: s.nombre }))} />
          <Selector etiqueta="Plan" value={formulario.plan} onChange={(e) => setFormulario({ ...formulario, plan: e.target.value })} opciones={[{ valor: 'BASICO', texto: 'Básico' }, { valor: 'PREMIUM', texto: 'Premium' }]} />
        </div>
        {!formulario.id && (
          <label className="check">
            <input type="checkbox" checked={formulario.consentimientoDatos} onChange={(e) => setFormulario({ ...formulario, consentimientoDatos: e.target.checked })} />
            <span>El socio prestó su consentimiento para el tratamiento de sus datos (Ley 25.326).</span>
          </label>
        )}
        {errores.consentimientoDatos && <p style={{ color: 'var(--peligro)' }}>{errores.consentimientoDatos}</p>}
        <Boton bloque cargando={accion.enviando} onClick={guardar} style={{ marginTop: '1rem' }}>Guardar</Boton>
      </Modal>

      <Modal titulo={detalle ? `${detalle.usuario.nombre} ${detalle.usuario.apellido}` : ''} abierto={!!detalle} onCerrar={() => setDetalle(null)}>
        {detalle && (
          <div className="pila">
            <small>
              {detalle.usuario.email} · {detalle.telefono} · alta {fecha(detalle.usuario.fechaAlta)} · {detalle.saldoPuntos} puntos
              {detalle.bonificacionVigente && ` · Premium bonificado hasta ${fecha(detalle.bonificacionVigente.hasta)}`}
            </small>
            <h3>Cuotas</h3>
            {detalle.cuotas.map((c) => (
              <div key={c.id} className="fila-entre">
                <span>{c.periodo} · {dinero(c.importeFinal)}</span>
                <Estado valor={c.estado} />
              </div>
            ))}
            <h3>Últimos turnos</h3>
            {detalle.reservas.map((r) => (
              <div key={r.id} className="fila-entre">
                <span>{fecha(r.turno.fecha)} · {r.turno.actividad} · {r.turno.sede.nombre}</span>
                <span>{r.asistencia ? <span className="etiqueta etiqueta-ok">Asistió</span> : <Estado valor={r.estado} />}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
