import { useState, type FormEvent } from 'react';
import { AyudaNombre, errorNombreCompleto } from '../../components/AyudaNombre';
import { Boton, CabeceraTarjeta, Encabezado, ErrorFormulario, Insignia, Modal, ModalExito, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';

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
type Acceso = '' | 'CONSULTA' | 'GESTION';
type Matriz = Record<string, Acceso>;

/** Acceso máximo de un rol por módulo (GESTION incluye CONSULTA). */
function matrizDe(r?: Rol): Matriz {
  const m: Matriz = {};
  r?.permisos.forEach(({ permiso }) => {
    if (m[permiso.modulo.codigo] !== 'GESTION') m[permiso.modulo.codigo] = permiso.acceso;
  });
  return m;
}

/**
 * Usuarios, roles y permisos (RF15, Figura 66). El backend arma con estos
 * permisos el árbol del patrón Composite para autorizar cada operación.
 */
export function Personal() {
  const toast = useToast();
  const personal = useApi(() => api.get<Integrante[]>('/admin/personal'));
  const roles = useApi(() => api.get<Rol[]>('/admin/roles'));
  const modulos = useApi(() => api.get<Modulo[]>('/admin/modulos'));
  const [integrante, setIntegrante] = useState<{ id?: number; email: string; nombre: string; apellido: string; rolId: string; activo?: boolean } | null>(null);
  const [rol, setRol] = useState<{ id?: number; nombre: string; principal: boolean; usos: number; matriz: Matriz } | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const accion = useAccion();

  const guardarIntegrante = async (e: FormEvent) => {
    e.preventDefault();
    const i = integrante!;
    if (!i.nombre.trim() || !i.apellido.trim() || !i.rolId || (!i.id && !i.email.trim())) return accion.setError('Completá todos los datos y el rol.');
    if (errorNombreCompleto(i.nombre, i.apellido)) return accion.setError(errorNombreCompleto(i.nombre, i.apellido)!);
    if (i.id) {
      if (await accion.ejecutar(() => api.put(`/admin/personal/${i.id}`, { nombre: i.nombre, apellido: i.apellido, rolId: Number(i.rolId) }))) {
        setIntegrante(null);
        toast('Cuenta actualizada.');
        void personal.recargar();
      }
    } else {
      const r = await accion.ejecutar(() => api.post<{ passwordTemporal: string }>('/admin/personal', { email: i.email, nombre: i.nombre, apellido: i.apellido, rolId: Number(i.rolId) }));
      if (r) {
        setIntegrante(null);
        setPassword(r.passwordTemporal);
        void personal.recargar();
      }
    }
  };
  const cambiarEstado = async () => {
    const i = integrante!;
    if (await accion.ejecutar(() => api.patch(`/admin/personal/${i.id}/estado`, { activo: !i.activo }))) {
      setIntegrante(null);
      toast(i.activo ? 'Cuenta desactivada. Se conserva el historial de sus operaciones.' : 'Cuenta reactivada.');
      void personal.recargar();
    }
  };
  const guardarRol = async (e: FormEvent) => {
    e.preventDefault();
    const r = rol!;
    const permisos = Object.entries(r.matriz)
      .filter(([, acceso]) => acceso)
      .flatMap(([modulo, acceso]) => (acceso === 'GESTION' ? [{ modulo, acceso: 'GESTION' }, { modulo, acceso: 'CONSULTA' }] : [{ modulo, acceso }]));
    if (!r.nombre.trim() || permisos.length === 0) return accion.setError('Indicá el nombre y al menos un permiso.');
    const ok = await accion.ejecutar(() => (r.id ? api.put(`/admin/roles/${r.id}`, { nombre: r.nombre, permisos }) : api.post('/admin/roles', { nombre: r.nombre, permisos })));
    if (ok) {
      setRol(null);
      toast('Rol guardado. Los permisos rigen desde el próximo ingreso de cada cuenta.');
      void roles.recargar();
    }
  };
  const eliminarRol = async () => {
    if (await accion.ejecutar(() => api.delete(`/admin/roles/${rol!.id}`))) {
      setRol(null);
      toast('Rol eliminado.');
      void roles.recargar();
    }
  };

  return (
    <>
      <Encabezado
        ceja="ADMINISTRACIÓN GENERAL"
        titulo="Usuarios, roles y permisos"
        subtitulo="El personal accede únicamente a los módulos que su rol habilita."
        accion={
          <Boton
            icono="plus"
            onClick={() => {
              accion.limpiar();
              setIntegrante({ email: '', nombre: '', apellido: '', rolId: '' });
            }}
          >
            Crear cuenta de personal
          </Boton>
        }
      />
      <ErrorFormulario>{!integrante && !rol ? (accion.error ?? personal.error) : null}</ErrorFormulario>
      <section className="card">
        <CabeceraTarjeta titulo="Cuentas administrativas" subtitulo="El alta de estas cuentas no forma parte del registro público." />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Personal</th>
                <th>Cuenta</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {personal.datos?.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>
                      {i.usuario.nombre} {i.usuario.apellido}
                    </strong>
                  </td>
                  <td>{i.usuario.email}</td>
                  <td>{i.rol.nombre}</td>
                  <td>
                    <Insignia color={i.usuario.activo ? '' : 'neutral'}>{i.usuario.activo ? 'Activa' : 'Desactivada'}</Insignia>
                  </td>
                  <td>
                    <Boton
                      estilo="outline"
                      chico
                      icono="edit"
                      onClick={() => {
                        accion.limpiar();
                        setIntegrante({ id: i.id, email: i.usuario.email, nombre: i.usuario.nombre, apellido: i.usuario.apellido, rolId: String(i.rolId), activo: i.usuario.activo });
                      }}
                    >
                      Editar cuenta
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {personal.datos?.length === 0 && <Vacio titulo="Sin cuentas de personal" icono="users" />}
      </section>
      <section className="card section-gap">
        <CabeceraTarjeta
          titulo="Roles por módulo"
          subtitulo="Sin acceso, consulta o gestión."
          accion={
            <Boton
              estilo="outline"
              chico
              icono="plus"
              onClick={() => {
                accion.limpiar();
                setRol({ nombre: '', principal: false, usos: 0, matriz: {} });
              }}
            >
              Crear rol
            </Boton>
          }
        />
        <div className="role-summary-grid">
          {roles.datos?.map((r) => {
            const m = matrizDe(r);
            const gestion = Object.values(m).filter((a) => a === 'GESTION').length;
            const consulta = Object.values(m).filter((a) => a === 'CONSULTA').length;
            return (
              <article key={r.id}>
                <div className="spread">
                  <h3>{r.nombre}</h3>
                  <Insignia color="neutral">{r.esPrincipal ? 'Rol principal' : 'Personalizable'}</Insignia>
                </div>
                <p>
                  {r.esPrincipal ? 'Todos los módulos con gestión' : `${gestion} módulos con gestión · ${consulta} con consulta`} · {r._count.personal} {r._count.personal === 1 ? 'cuenta' : 'cuentas'}
                </p>
                <Boton
                  estilo="outline"
                  chico
                  icono="shield"
                  onClick={() => {
                    accion.limpiar();
                    setRol({ id: r.id, nombre: r.nombre, principal: r.esPrincipal, usos: r._count.personal, matriz: m });
                  }}
                >
                  {r.esPrincipal ? 'Ver permisos' : 'Configurar permisos'}
                </Boton>
              </article>
            );
          })}
        </div>
      </section>

      <Modal titulo={integrante?.id ? 'Editar cuenta' : 'Crear cuenta de personal'} subtitulo="La cuenta ingresa por el portal interno con una contraseña temporal." abierto={!!integrante} onCerrar={() => setIntegrante(null)}>
        {integrante && (
          <form onSubmit={guardarIntegrante}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            <div className="form-grid">
              <label>
                Nombre
                <input required maxLength={100} value={integrante.nombre} onChange={(e) => setIntegrante({ ...integrante, nombre: e.target.value })} />
                <AyudaNombre valor={integrante.nombre} />
              </label>
              <label>
                Apellido
                <input required maxLength={100} value={integrante.apellido} onChange={(e) => setIntegrante({ ...integrante, apellido: e.target.value })} />
                <AyudaNombre valor={integrante.apellido} />
              </label>
              <label className="wide">
                Correo electrónico
                <input type="email" required readOnly={!!integrante.id} value={integrante.email} onChange={(e) => setIntegrante({ ...integrante, email: e.target.value })} />
              </label>
              <label className="wide">
                Rol
                <select required value={integrante.rolId} onChange={(e) => setIntegrante({ ...integrante, rolId: e.target.value })}>
                  <option value="">Elegí un rol</option>
                  {roles.datos?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-actions split">
              {integrante.id ? (
                <Boton estilo={integrante.activo ? 'danger' : 'soft'} cargando={accion.enviando} onClick={cambiarEstado}>
                  {integrante.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}
                </Boton>
              ) : (
                <span />
              )}
              <div>
                <Boton estilo="outline" onClick={() => setIntegrante(null)}>
                  Cancelar
                </Boton>
                <button type="submit" className="btn primary" disabled={accion.enviando}>
                  Guardar cuenta
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Figura 66: permisos por módulo de un rol. */}
      <Modal titulo={rol?.id ? `Permisos de ${rol.nombre}` : 'Crear rol'} subtitulo="Cada módulo admite consulta o gestión de forma independiente." abierto={!!rol} onCerrar={() => setRol(null)}>
        {rol && (
          <form onSubmit={guardarRol}>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
            <label>
              Nombre del rol
              <input required maxLength={100} disabled={rol.principal} value={rol.nombre} onChange={(e) => setRol({ ...rol, nombre: e.target.value })} />
            </label>
            <div className="permissions-grid">
              {modulos.datos?.map((m) => (
                <label key={m.codigo}>
                  {m.nombre}
                  <select
                    disabled={rol.principal}
                    value={rol.principal ? 'GESTION' : (rol.matriz[m.codigo] ?? '')}
                    onChange={(e) => setRol({ ...rol, matriz: { ...rol.matriz, [m.codigo]: e.target.value as Acceso } })}
                  >
                    <option value="">Sin acceso</option>
                    <option value="CONSULTA">Consulta</option>
                    <option value="GESTION">Gestión</option>
                  </select>
                </label>
              ))}
            </div>
            <p className="page-note">
              {rol.principal ? 'El rol de administrador general tiene todos los permisos y no se modifica.' : 'Gestión incluye consulta. Usuarios y permisos es exclusivo del administrador general.'}
            </p>
            {!rol.principal && (
              <div className="form-actions split">
                {rol.id && rol.usos === 0 ? (
                  <Boton estilo="danger" cargando={accion.enviando} onClick={eliminarRol}>
                    Eliminar rol
                  </Boton>
                ) : (
                  <span />
                )}
                <div>
                  <Boton estilo="outline" onClick={() => setRol(null)}>
                    Cancelar
                  </Boton>
                  <button type="submit" className="btn primary" disabled={accion.enviando}>
                    Guardar permisos
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>
      <ModalExito
        abierto={!!password}
        titulo="Cuenta creada."
        descripcion={`Contraseña temporal: ${password ?? ''}. Se muestra una sola vez; la persona la cambia al ingresar.`}
        boton="Listo"
        onCerrar={() => setPassword(null)}
      />
    </>
  );
}
