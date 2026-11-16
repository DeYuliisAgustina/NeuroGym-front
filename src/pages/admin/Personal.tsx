import { useState } from 'react';
import { Aviso, Boton, Campo, EncabezadoPagina, Modal, Pestanas, Selector } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { fecha } from '../../utils/formato';

interface Rol {
  id: number;
  nombre: string;
  esPrincipal: boolean;
  permisos: { permiso: { acceso: 'CONSULTA' | 'GESTION'; modulo: { codigo: string; nombre: string } } }[];
  _count: { personal: number };
}
interface Integrante {
  id: number;
  rolId: number;
  rol: { nombre: string; esPrincipal: boolean };
  usuario: { email: string; nombre: string; apellido: string; activo: boolean; fechaAlta: string };
}
interface Modulo {
  id: number;
  codigo: string;
  nombre: string;
}
type Matriz = Record<string, '' | 'CONSULTA' | 'GESTION'>;

/**
 * Cuentas administrativas y roles con permisos por módulo (RF15). El backend
 * arma con estos permisos el árbol del patrón Composite para autorizar.
 */
export function Personal() {
  const [vista, setVista] = useState<'personal' | 'roles'>('personal');
  const personal = useApi(() => api.get<Integrante[]>('/admin/personal'));
  const roles = useApi(() => api.get<Rol[]>('/admin/roles'));
  const modulos = useApi(() => api.get<Modulo[]>('/admin/modulos'));
  const [integrante, setIntegrante] = useState<{ id?: number; email: string; nombre: string; apellido: string; rolId: string } | null>(null);
  const [rol, setRol] = useState<{ id?: number; nombre: string; matriz: Matriz } | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const accion = useAccion();

  const guardarIntegrante = async () => {
    const i = integrante!;
    if (!i.nombre.trim() || !i.apellido.trim() || !i.rolId || (!i.id && !i.email.trim())) return accion.setError('Completá todos los campos.');
    if (i.id) {
      if (await accion.ejecutar(() => api.put(`/admin/personal/${i.id}`, { nombre: i.nombre, apellido: i.apellido, rolId: Number(i.rolId) }), 'Cuenta actualizada.')) {
        setIntegrante(null);
        void personal.recargar();
      }
    } else {
      const r = await accion.ejecutar(() => api.post<{ passwordTemporal: string }>('/admin/personal', { ...i, rolId: Number(i.rolId) }), 'Cuenta creada.');
      if (r) {
        setPassword(r.passwordTemporal);
        setIntegrante(null);
        void personal.recargar();
      }
    }
  };
  const cambiarEstado = async (i: Integrante) => {
    const activo = !i.usuario.activo;
    if (!window.confirm(activo ? '¿Reactivar la cuenta?' : 'La cuenta no podrá ingresar. Se conserva el historial de sus operaciones. ¿Desactivar?')) return;
    if (await accion.ejecutar(() => api.patch(`/admin/personal/${i.id}/estado`, { activo }), activo ? 'Cuenta reactivada.' : 'Cuenta desactivada.')) void personal.recargar();
  };
  const abrirRol = (r?: Rol) => {
    const matriz: Matriz = {};
    r?.permisos.forEach(({ permiso }) => {
      if (matriz[permiso.modulo.codigo] !== 'GESTION') matriz[permiso.modulo.codigo] = permiso.acceso;
    });
    setRol({ id: r?.id, nombre: r?.nombre ?? '', matriz });
  };
  const guardarRol = async () => {
    const permisos = Object.entries(rol!.matriz)
      .filter(([, acceso]) => acceso)
      .flatMap(([modulo, acceso]) => (acceso === 'GESTION' ? [{ modulo, acceso: 'GESTION' }, { modulo, acceso: 'CONSULTA' }] : [{ modulo, acceso }]));
    if (!rol!.nombre.trim() || permisos.length === 0) return accion.setError('Indicá el nombre y al menos un permiso.');
    const ok = await accion.ejecutar(() => (rol!.id ? api.put(`/admin/roles/${rol!.id}`, { nombre: rol!.nombre, permisos }) : api.post('/admin/roles', { nombre: rol!.nombre, permisos })), 'Rol guardado.');
    if (ok) {
      setRol(null);
      void roles.recargar();
    }
  };
  const eliminarRol = async (r: Rol) => {
    if (!window.confirm(`¿Eliminar el rol "${r.nombre}"?`)) return;
    if (await accion.ejecutar(() => api.delete(`/admin/roles/${r.id}`), 'Rol eliminado.')) void roles.recargar();
  };

  return (
    <div>
      <EncabezadoPagina titulo="Usuarios y permisos" descripcion="Solo el administrador general gestiona las cuentas administrativas y los roles." />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      {password && (
        <Aviso tipo="alerta">
          Contraseña temporal: <strong>{password}</strong>. Se muestra una sola vez. <button className="btn btn-texto btn-chico" onClick={() => setPassword(null)}>Ocultar</button>
        </Aviso>
      )}
      <Pestanas valor={vista} onCambiar={setVista} opciones={[{ valor: 'personal', texto: 'Personal' }, { valor: 'roles', texto: 'Roles y permisos' }]} />
      {vista === 'personal' && (
        <div className="tarjeta">
          <Boton onClick={() => setIntegrante({ email: '', nombre: '', apellido: '', rolId: '' })}>Nueva cuenta</Boton>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Nombre</th><th>Rol</th><th>Alta</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {personal.datos?.map((i) => (
                  <tr key={i.id}>
                    <td>{i.usuario.apellido}, {i.usuario.nombre}<div className="tenue" style={{ fontSize: '0.8rem' }}>{i.usuario.email}</div></td>
                    <td>{i.rol.nombre}</td>
                    <td>{fecha(i.usuario.fechaAlta)}</td>
                    <td>{i.usuario.activo ? <span className="etiqueta etiqueta-ok">Activa</span> : <span className="etiqueta etiqueta-mal">Desactivada</span>}</td>
                    <td className="fila">
                      <Boton variante="texto" chico onClick={() => setIntegrante({ id: i.id, email: i.usuario.email, nombre: i.usuario.nombre, apellido: i.usuario.apellido, rolId: String(i.rolId) })}>Editar</Boton>
                      <Boton variante="texto" chico onClick={() => cambiarEstado(i)}>{i.usuario.activo ? 'Desactivar' : 'Reactivar'}</Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {vista === 'roles' && (
        <div className="pila">
          <Boton onClick={() => abrirRol()}>Nuevo rol</Boton>
          <div className="grilla-2">
            {roles.datos?.map((r) => (
              <div key={r.id} className="tarjeta pila">
                <div className="fila-entre">
                  <h3>{r.nombre}</h3>
                  <small>{r._count.personal} cuentas</small>
                </div>
                {r.esPrincipal ? (
                  <small>Acceso total a todos los módulos (administrador general).</small>
                ) : (
                  <small>
                    {Object.entries(
                      r.permisos.reduce<Record<string, string>>((acc, { permiso }) => {
                        if (acc[permiso.modulo.nombre] !== 'gestión') acc[permiso.modulo.nombre] = permiso.acceso === 'GESTION' ? 'gestión' : 'consulta';
                        return acc;
                      }, {}),
                    )
                      .map(([m, a]) => `${m}: ${a}`)
                      .join(' · ')}
                  </small>
                )}
                {!r.esPrincipal && (
                  <div className="fila">
                    <Boton variante="secundario" chico onClick={() => abrirRol(r)}>Editar permisos</Boton>
                    <Boton variante="texto" chico onClick={() => eliminarRol(r)}>Eliminar</Boton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <Modal titulo={integrante?.id ? 'Modificar cuenta' : 'Nueva cuenta administrativa'} abierto={!!integrante} onCerrar={() => setIntegrante(null)}>
        {integrante && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            <div className="grilla-2">
              <Campo etiqueta="Nombre" value={integrante.nombre} onChange={(e) => setIntegrante({ ...integrante, nombre: e.target.value })} />
              <Campo etiqueta="Apellido" value={integrante.apellido} onChange={(e) => setIntegrante({ ...integrante, apellido: e.target.value })} />
            </div>
            <Campo etiqueta="Correo electrónico" type="email" disabled={!!integrante.id} value={integrante.email} onChange={(e) => setIntegrante({ ...integrante, email: e.target.value })} />
            <Selector etiqueta="Rol" vacio="Elegí un rol" value={integrante.rolId} onChange={(e) => setIntegrante({ ...integrante, rolId: e.target.value })} opciones={(roles.datos ?? []).map((r) => ({ valor: r.id, texto: r.nombre }))} />
            <Boton bloque cargando={accion.enviando} onClick={guardarIntegrante}>Guardar</Boton>
          </>
        )}
      </Modal>
      <Modal titulo={rol?.id ? 'Editar rol' : 'Nuevo rol'} abierto={!!rol} onCerrar={() => setRol(null)}>
        {rol && (
          <>
            <Aviso tipo="error">{accion.error}</Aviso>
            <Campo etiqueta="Nombre del rol" value={rol.nombre} onChange={(e) => setRol({ ...rol, nombre: e.target.value })} />
            <table>
              <thead><tr><th>Módulo</th><th>Acceso</th></tr></thead>
              <tbody>
                {modulos.datos?.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nombre}</td>
                    <td>
                      <select aria-label={`Acceso a ${m.nombre}`} value={rol.matriz[m.codigo] ?? ''} onChange={(e) => setRol({ ...rol, matriz: { ...rol.matriz, [m.codigo]: e.target.value as Matriz[string] } })}>
                        <option value="">Sin acceso</option>
                        <option value="CONSULTA">Consulta</option>
                        <option value="GESTION">Gestión</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Boton bloque cargando={accion.enviando} onClick={guardarRol} style={{ marginTop: '0.8rem' }}>Guardar rol</Boton>
          </>
        )}
      </Modal>
    </div>
  );
}
