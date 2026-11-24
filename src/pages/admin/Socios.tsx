import { useEffect, useState, type FormEvent } from 'react';
import { AyudaNombre, errorNombreCompleto } from '../../components/AyudaNombre';
import { Icono } from '../../components/Icono';
import { Avatar, Boton, Encabezado, ErrorFormulario, Insignia, inicialesDe, Modal, ModalExito, Vacio } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSedeVista } from '../../contexts/SedeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Sede } from '../../types';
import { fechaCorta, fechaLarga } from '../../utils/formato';
import { validarSocio } from '../../validations/formularios';
import { RutinaSocio } from './RutinaSocio';

interface SocioFila {
  id: number;
  telefono: string;
  /** RF2: se registró solo y espera que el gimnasio confirme el alta. */
  pendienteAlta: boolean;
  usuario: { id: number; email: string; nombre: string; apellido: string; activo: boolean; fechaAlta: string };
  plan: { tipo: 'BASICO' | 'PREMIUM' };
  sede: { id: number; nombre: string };
  estadoCuota: 'PENDIENTE' | 'PAGADA' | 'IMPAGA' | null;
  asistenciasMes: number;
  ultimaVisita: string | null;
}
interface Gimnasio {
  suscripcion: { tipo: string; maxSociosActivos: number } | null;
  uso: { sociosActivos: number };
}

const vacio = { email: '', nombre: '', apellido: '', telefono: '', sedeId: '', plan: 'BASICO', consentimientoDatos: false };
const CUOTA: Record<string, [string, '' | 'warning' | 'danger']> = { PAGADA: ['Al día', ''], PENDIENTE: ['Pendiente', 'warning'], IMPAGA: ['Impaga', 'danger'] };
const EstadoCuota = ({ estado }: { estado: SocioFila['estadoCuota'] }) => (estado ? <Insignia color={CUOTA[estado][1]}>{CUOTA[estado][0]}</Insignia> : <Insignia color="neutral">Sin cuota</Insignia>);

/** Socios del gimnasio (RF16, Figura 63): alta, confirmación de autorregistros (RF2), ficha con edición y desactivación lógica y reversible (RD20). */
export function Socios() {
  const { puede } = useAuth();
  const toast = useToast();
  const gestion = puede('SOCIOS', 'GESTION');
  const { sedeId, setSedeId } = useSedeVista();
  const [filtros, setFiltros] = useState({ busqueda: '', plan: '', cuota: '', activo: 'true' });
  const socios = useApi(
    () =>
      api.get<SocioFila[]>('/admin/socios', {
        ...(filtros.busqueda ? { busqueda: filtros.busqueda } : {}),
        ...(sedeId ? { sedeId } : {}),
        ...(filtros.plan ? { plan: filtros.plan } : {}),
        // "Pendientes de alta": socios que se registraron solos (RF2) y esperan la confirmación.
        ...(filtros.activo === 'pendiente' ? { pendiente: 'true' } : { activo: filtros.activo, pendiente: 'false' }),
      }),
    [filtros.busqueda, sedeId, filtros.plan, filtros.activo],
  );
  const pendientes = useApi(() => api.get<SocioFila[]>('/admin/socios', { pendiente: 'true' }), [filtros.activo]);
  const cantidadPendientes = pendientes.datos?.length ?? 0;
  const sedes = useApi(() => api.get<Sede[]>('/admin/sedes').catch(() => [] as Sede[]));
  const gimnasio = useApi(() => api.get<Gimnasio>('/admin/gimnasio'));
  const [alta, setAlta] = useState(false);
  const [ficha, setFicha] = useState<SocioFila | null>(null);
  // RF5: rutina del socio (se abre desde la ficha).
  const [rutinaDe, setRutinaDe] = useState<SocioFila | null>(null);
  const [password, setPassword] = useState<{ email: string; clave: string } | null>(null);

  const lista = (socios.datos ?? []).filter((s) => !filtros.cuota || s.estadoCuota === filtros.cuota);
  const limpiar = () => {
    setFiltros({ busqueda: '', plan: '', cuota: '', activo: 'true' });
    setSedeId('');
  };

  return (
    <>
      <Encabezado
        ceja="SOCIOS DEL GIMNASIO"
        titulo="Socios"
        subtitulo="Consultá los socios y su actividad en las sedes del gimnasio."
        accion={
          gestion && (
            <Boton icono="plus" onClick={() => setAlta(true)}>
              Registrar socio
            </Boton>
          )
        }
      />
      {cantidadPendientes > 0 && filtros.activo !== 'pendiente' && (
        <div className="soft-alert" role="status">
          <div>
            <h4>{cantidadPendientes === 1 ? '1 socio se registró y espera el alta' : `${cantidadPendientes} socios se registraron y esperan el alta`}</h4>
            <p>Revisá sus datos y confirmá el alta para que puedan ingresar a NeuroGym.</p>
            <div className="form-actions">
              <Boton chico icono="user" onClick={() => setFiltros({ ...filtros, activo: 'pendiente' })}>
                Ver pendientes de alta
              </Boton>
            </div>
          </div>
        </div>
      )}
      {/* RF5: la rutina de cada socio se gestiona desde su ficha. */}
      <aside className="soft-alert green" aria-label="Rutinas de los socios" style={{ marginBottom: 20 }}>
        <Icono n="sparkles" />
        <div>
          <h4>Rutinas de los socios</h4>
          <p>
            {gestion
              ? 'Para crear con IA o editar la rutina de un socio, tocá «Ver ficha» y después el botón «Rutina».'
              : 'Para consultar la rutina de un socio, tocá «Ver ficha» y después el botón «Rutina».'}
          </p>
        </div>
      </aside>
      <div className="toolbar">
        <h3>
          {lista.length} {lista.length === 1 ? 'socio encontrado' : 'socios encontrados'}
        </h3>
      </div>
      <div className="list-filters" aria-label="Filtros de búsqueda">
        <label className="filter-field filter-search">
          <span>Buscar</span>
          <div className="search-input">
            <Icono n="search" />
            <input type="search" aria-label="Buscar socio o correo" placeholder="Buscar socio o correo" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
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
          <span>Plan</span>
          <select aria-label="Plan" value={filtros.plan} onChange={(e) => setFiltros({ ...filtros, plan: e.target.value })}>
            <option value="">Todos</option>
            <option value="BASICO">Básico</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Estado de cuota</span>
          <select aria-label="Estado de cuota" value={filtros.cuota} onChange={(e) => setFiltros({ ...filtros, cuota: e.target.value })}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="IMPAGA">Impaga</option>
            <option value="PAGADA">Al día</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select aria-label="Estado del socio" value={filtros.activo} onChange={(e) => setFiltros({ ...filtros, activo: e.target.value })}>
            <option value="true">Activos</option>
            <option value="false">Desactivados</option>
            <option value="pendiente">Pendientes de alta{cantidadPendientes ? ` (${cantidadPendientes})` : ''}</option>
          </select>
        </label>
        <Boton estilo="outline" chico icono="refresh" className="clear-filters" onClick={limpiar}>
          Limpiar filtros
        </Boton>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Sede</th>
                <th>Plan</th>
                <th>Asistencias</th>
                <th>Última visita</th>
                <th>Cuota</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="table-avatar">
                      <Avatar iniciales={inicialesDe(`${s.usuario.nombre} ${s.usuario.apellido}`)} />
                      <div>
                        <strong>
                          {s.usuario.nombre} {s.usuario.apellido}
                        </strong>
                        <small>{s.usuario.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{s.sede.nombre}</td>
                  <td>
                    <Insignia color={s.plan.tipo === 'PREMIUM' ? 'lilac' : 'neutral'}>{s.plan.tipo === 'PREMIUM' ? 'Premium' : 'Básico'}</Insignia>
                  </td>
                  <td>{s.asistenciasMes} este mes</td>
                  <td>{s.ultimaVisita ? fechaCorta(s.ultimaVisita) : 'Sin asistencias'}</td>
                  <td>{s.pendienteAlta ? <Insignia color="warning">Pendiente de alta</Insignia> : <EstadoCuota estado={s.estadoCuota} />}</td>
                  <td>
                    <Boton estilo="outline" chico icono="chevron" onClick={() => setFicha(s)}>
                      {s.pendienteAlta ? 'Revisar alta' : 'Ver ficha'}
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {socios.datos && lista.length === 0 && <Vacio titulo="No encontramos socios" descripcion="Probá con otra búsqueda o limpiá los filtros." icono="users" />}
        <ErrorFormulario>{socios.error}</ErrorFormulario>
      </section>

      {alta && (
        <AltaSocio
          sedes={(sedes.datos ?? []).filter((s) => s.habilitada)}
          sedeInicial={sedeId}
          gimnasio={gimnasio.datos}
          alCerrar={() => setAlta(false)}
          alGuardar={(email, clave) => {
            setAlta(false);
            setPassword({ email, clave });
            void socios.recargar();
            void gimnasio.recargar();
          }}
        />
      )}
      {ficha?.pendienteAlta && (
        <RevisarAlta
          socio={ficha}
          gestion={gestion}
          sedes={sedes.datos ?? []}
          alCerrar={() => setFicha(null)}
          alResolver={(mensaje) => {
            setFicha(null);
            if (mensaje) toast(mensaje);
            void socios.recargar();
            void pendientes.recargar();
            void gimnasio.recargar();
          }}
        />
      )}
      {ficha && !ficha.pendienteAlta && (
        <FichaSocio
          socio={ficha}
          gestion={gestion}
          sedes={sedes.datos ?? []}
          alCerrar={() => setFicha(null)}
          alVerRutina={() => {
            setRutinaDe(ficha);
            setFicha(null);
          }}
          alCambiar={(mensaje) => {
            setFicha(null);
            toast(mensaje);
            void socios.recargar();
            void pendientes.recargar();
            void gimnasio.recargar();
          }}
        />
      )}
      {rutinaDe && (
        <RutinaSocio
          socioId={rutinaDe.id}
          nombre={`${rutinaDe.usuario.nombre} ${rutinaDe.usuario.apellido}`}
          activo={rutinaDe.usuario.activo}
          gestion={gestion}
          alCerrar={() => setRutinaDe(null)}
        />
      )}
      <ModalExito
        abierto={!!password}
        titulo="Socio registrado."
        descripcion={`Entregale al socio su contraseña temporal: ${password?.clave ?? ''}. Ingresa con ${password?.email ?? ''} y la cambia desde su perfil.`}
        boton="Listo"
        onCerrar={() => setPassword(null)}
      />
    </>
  );
}

/** "Registrar socio" (Figura 63 b): alta con consentimiento y control de la capacidad de la suscripción. */
function AltaSocio({ sedes, sedeInicial, gimnasio, alCerrar, alGuardar }: { sedes: Sede[]; sedeInicial: string; gimnasio: Gimnasio | null; alCerrar: () => void; alGuardar: (email: string, clave: string) => void }) {
  const [f, setF] = useState({ ...vacio, sedeId: sedeInicial || String(sedes[0]?.id ?? '') });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const accion = useAccion();
  useEffect(() => {
    if (!f.sedeId && sedes[0]) setF((x) => ({ ...x, sedeId: String(sedes[0].id) }));
  }, [sedes, f.sedeId]);
  const limite = gimnasio?.suscripcion?.maxSociosActivos ?? 0;
  const activos = gimnasio?.uso.sociosActivos ?? 0;
  const disponible = !gimnasio || activos < limite;
  const cambiar = (campo: string) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });
  const error = (campo: string) => (errores[campo] ?? accion.errores[campo] ? <small role="alert">{errores[campo] ?? accion.errores[campo]}</small> : null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const v = validarSocio(f);
    setErrores(v);
    if (Object.keys(v).length) return;
    const r = await accion.ejecutar(() =>
      api.post<{ passwordTemporal: string }>('/admin/socios', {
        email: f.email,
        nombre: f.nombre,
        apellido: f.apellido,
        telefono: f.telefono,
        sedeId: Number(f.sedeId),
        plan: f.plan,
        consentimientoDatos: f.consentimientoDatos,
      }),
    );
    if (r) alGuardar(f.email, r.passwordTemporal);
  };
  return (
    <Modal titulo="Registrar socio" subtitulo="Alta de una persona asociada al gimnasio." abierto onCerrar={alCerrar}>
      <form onSubmit={guardar} noValidate>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label>
            Nombre
            <input required maxLength={60} autoComplete="given-name" value={f.nombre} onChange={cambiar('nombre')} />
            <AyudaNombre valor={f.nombre} error={errores.nombre ?? accion.errores.nombre} />
          </label>
          <label>
            Apellido
            <input required maxLength={60} autoComplete="family-name" value={f.apellido} onChange={cambiar('apellido')} />
            <AyudaNombre valor={f.apellido} error={errores.apellido ?? accion.errores.apellido} />
          </label>
          <label>
            Correo electrónico
            <input type="email" required maxLength={160} autoComplete="email" value={f.email} onChange={cambiar('email')} />
            {error('email')}
          </label>
          <label>
            Teléfono
            <input type="tel" required maxLength={30} autoComplete="tel" placeholder="+54 341 555 0123" value={f.telefono} onChange={cambiar('telefono')} />
            {error('telefono')}
          </label>
          <label>
            Sede
            <select required value={f.sedeId} onChange={cambiar('sedeId')}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {error('sedeId')}
          </label>
          <label>
            Plan
            <select required value={f.plan} onChange={cambiar('plan')}>
              <option value="BASICO">Básico</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </label>
        </div>
        <label className="check-field" style={{ marginTop: 20 }}>
          <input type="checkbox" checked={f.consentimientoDatos} onChange={(e) => setF({ ...f, consentimientoDatos: e.target.checked })} />
          El socio otorgó su consentimiento para el tratamiento de datos.
        </label>
        {error('consentimientoDatos')}
        <p className="page-note">El alta habilita el acceso del socio con el correo registrado y una contraseña temporal. En su primer ingreso completa la bienvenida y genera su primera rutina.</p>
        {gimnasio?.suscripcion && (
          <div className={`soft-alert ${disponible ? 'green' : ''}`.trim()}>
            <div>
              <h4>NeuroGym {gimnasio.suscripcion.tipo === 'INTELLIGENCE' ? 'Intelligence' : 'Standard'}</h4>
              <p>
                {activos.toLocaleString('es-AR')} de {limite.toLocaleString('es-AR')} socios activos.
                {disponible ? '' : ' Se alcanzó la capacidad de la suscripción; no se pueden registrar más socios.'}
              </p>
            </div>
          </div>
        )}
        <div className="form-actions">
          <Boton estilo="outline" onClick={alCerrar}>
            Cancelar
          </Boton>
          <button type="submit" className="btn primary" disabled={!disponible || accion.enviando}>
            Guardar socio
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * RF2: revisión del autorregistro. Es la misma ficha del socio (datos editables)
 * con una sola fila de acciones: Rechazar (pide confirmación) y Dar de alta.
 * Si el personal corrigió algún dato, se guarda antes de dar el alta.
 */
function RevisarAlta({ socio: s, gestion, sedes, alCerrar, alResolver }: { socio: SocioFila; gestion: boolean; sedes: Sede[]; alCerrar: () => void; alResolver: (mensaje: string | null) => void }) {
  const original = { nombre: s.usuario.nombre, apellido: s.usuario.apellido, telefono: s.telefono, sedeId: String(s.sede.id) };
  const [f, setF] = useState(original);
  const [rechazando, setRechazando] = useState(false);
  const accion = useAccion();
  const nombre = `${s.usuario.nombre} ${s.usuario.apellido}`;
  const cambiado = (Object.keys(original) as (keyof typeof original)[]).some((k) => f[k].trim() !== original[k]);

  const resolver = async (aprobar: boolean) => {
    if (aprobar && errorNombreCompleto(f.nombre, f.apellido)) return accion.setError(errorNombreCompleto(f.nombre, f.apellido)!);
    const ok = await accion.ejecutar(async () => {
      if (aprobar && cambiado) await api.put(`/admin/socios/${s.id}`, { nombre: f.nombre, apellido: f.apellido, telefono: f.telefono, sedeId: Number(f.sedeId) });
      return api.patch(`/admin/socios/${s.id}/alta`, { aprobar });
    });
    if (ok) alResolver(aprobar ? `Listo: ${f.nombre.trim()} ya puede ingresar a NeuroGym.` : 'Registro rechazado.');
  };
  // Si otra persona del gimnasio ya lo resolvió, se actualiza la lista en lugar de mostrar un error.
  const yaResuelto = !!accion.error && /no tiene un registro pendiente/.test(accion.error);
  useEffect(() => {
    if (yaResuelto) alResolver('Este registro ya había sido resuelto.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yaResuelto]);

  return (
    <Modal
      titulo={
        <>
          {nombre} <Insignia color="warning">Pendiente de alta</Insignia>
        </>
      }
      subtitulo={`Se registró el ${fechaLarga(s.usuario.fechaAlta)}`}
      encabezado={<Avatar iniciales={inicialesDe(nombre)} color="mint" grande />}
      abierto
      onCerrar={alCerrar}
    >
      <div className="ficha-resumen">
        <div>
          <span>Plan</span>
          <strong>{s.plan.tipo === 'PREMIUM' ? 'Premium' : 'Básico'}</strong>
        </div>
        <div>
          <span>Asistencias</span>
          <strong>{s.asistenciasMes} este mes</strong>
        </div>
        <div>
          <span>Última visita</span>
          <strong>{s.ultimaVisita ? fechaCorta(s.ultimaVisita) : '—'}</strong>
        </div>
        <div>
          <span>Cuota</span>
          <EstadoCuota estado={s.estadoCuota} />
        </div>
      </div>
      <ErrorFormulario>{accion.error}</ErrorFormulario>
      <div className="form-grid">
        <label>
          Nombre
          <input required disabled={!gestion || rechazando} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <AyudaNombre valor={f.nombre} />
        </label>
        <label>
          Apellido
          <input required disabled={!gestion || rechazando} value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} />
          <AyudaNombre valor={f.apellido} />
        </label>
        <label>
          Correo electrónico
          <input type="email" value={s.usuario.email} readOnly />
        </label>
        <label>
          Teléfono
          <input type="tel" required disabled={!gestion || rechazando} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        </label>
        <label>
          Sede
          <select disabled={!gestion || rechazando} value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>
            {sedes.map((x) => (
              <option key={x.id} value={x.id} disabled={!x.habilitada && String(x.id) !== f.sedeId}>
                {x.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plan
          <input value={s.plan.tipo === 'PREMIUM' ? 'Premium' : 'Básico'} disabled />
        </label>
      </div>
      <p className="page-note">
        {rechazando
          ? '¿Rechazar este registro? La persona no va a poder ingresar a NeuroGym.'
          : 'Revisá los datos (podés corregirlos). Al darlo de alta va a poder ingresar, se le genera la cuota del mes y le avisamos por WhatsApp.'}
      </p>
      {gestion && (
        <div className="form-actions split">
          {rechazando ? (
            <>
              <Boton estilo="outline" onClick={() => setRechazando(false)}>
                Volver
              </Boton>
              <Boton estilo="danger" cargando={accion.enviando} onClick={() => resolver(false)}>
                Sí, rechazar
              </Boton>
            </>
          ) : (
            <>
              <Boton estilo="outline" onClick={() => setRechazando(true)}>
                Rechazar
              </Boton>
              <Boton icono="check" cargando={accion.enviando} onClick={() => resolver(true)}>
                Dar de alta
              </Boton>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Ficha del socio con edición y desactivación (Figura 63 c). */
function FichaSocio({
  socio: s,
  gestion,
  sedes,
  alCerrar,
  alCambiar,
  alVerRutina,
}: {
  socio: SocioFila;
  gestion: boolean;
  sedes: Sede[];
  alCerrar: () => void;
  alCambiar: (mensaje: string) => void;
  alVerRutina: () => void;
}) {
  const [f, setF] = useState({ nombre: s.usuario.nombre, apellido: s.usuario.apellido, telefono: s.telefono, sedeId: String(s.sede.id) });
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const accion = useAccion();
  const nombre = `${s.usuario.nombre} ${s.usuario.apellido}`;
  const activo = s.usuario.activo;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (errorNombreCompleto(f.nombre, f.apellido)) return accion.setError(errorNombreCompleto(f.nombre, f.apellido)!);
    if (await accion.ejecutar(() => api.put(`/admin/socios/${s.id}`, { nombre: f.nombre, apellido: f.apellido, telefono: f.telefono, sedeId: Number(f.sedeId) }))) alCambiar('Ficha del socio actualizada.');
  };
  const cambiarEstado = async () => {
    if (await accion.ejecutar(() => api.patch(`/admin/socios/${s.id}/estado`, { activo: !activo }))) alCambiar(activo ? 'Socio desactivado. Su historial se conserva.' : 'Socio reactivado.');
  };

  return (
    <Modal
      titulo={
        <>
          {nombre} <Insignia color={activo ? '' : 'neutral'}>{activo ? 'Activo' : 'Desactivado'}</Insignia>
        </>
      }
      subtitulo={`Ficha del socio · alta ${fechaLarga(s.usuario.fechaAlta)}`}
      encabezado={<Avatar iniciales={inicialesDe(nombre)} color="mint" grande />}
      abierto
      onCerrar={alCerrar}
    >
      <div className="ficha-resumen">
        <div>
          <span>Plan</span>
          <strong>{s.plan.tipo === 'PREMIUM' ? 'Premium' : 'Básico'}</strong>
        </div>
        <div>
          <span>Asistencias</span>
          <strong>{s.asistenciasMes} este mes</strong>
        </div>
        <div>
          <span>Última visita</span>
          <strong>{s.ultimaVisita ? fechaCorta(s.ultimaVisita) : '—'}</strong>
        </div>
        <div>
          <span>Cuota</span>
          <EstadoCuota estado={s.estadoCuota} />
        </div>
      </div>
      <div className="spread" style={{ margin: '0 0 16px' }}>
        <p className="muted" style={{ margin: 0 }}>{gestion ? 'Generá con IA o ajustá la rutina que el socio ve en «Mi rutina».' : 'Rutina que el socio ve en «Mi rutina».'}</p>
        <Boton estilo="soft" chico icono="dumbbell" onClick={alVerRutina}>
          Rutina
        </Boton>
      </div>
      <form onSubmit={guardar}>
        <ErrorFormulario>{accion.error}</ErrorFormulario>
        <div className="form-grid">
          <label>
            Nombre
            <input required disabled={!gestion} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <AyudaNombre valor={f.nombre} />
          </label>
          <label>
            Apellido
            <input required disabled={!gestion} value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} />
          <AyudaNombre valor={f.apellido} />
          </label>
          <label>
            Correo electrónico
            <input type="email" value={s.usuario.email} readOnly />
          </label>
          <label>
            Teléfono
            <input type="tel" required disabled={!gestion} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
          </label>
          <label>
            Sede
            <select disabled={!gestion} value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>
              {sedes.map((x) => (
                <option key={x.id} value={x.id} disabled={!x.habilitada && String(x.id) !== f.sedeId}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plan
            <input value={s.plan.tipo === 'PREMIUM' ? 'Premium' : 'Básico'} disabled />
          </label>
        </div>
        <p className="page-note">El plan no se edita desde la ficha: el socio contrata o da de baja el Plan Premium, o el gimnasio lo otorga como beneficio.</p>
        <div className="soft-alert green">
          <div>
            <p>
              {activo
                ? 'Desactivar al socio inhabilita su acceso y las nuevas reservas, y deja de computarlo entre los socios activos. Se conservan sus cuotas, pagos, turnos y asistencias, y la cuenta puede reactivarse.'
                : 'Reactivar al socio vuelve a habilitar su acceso y lo cuenta entre los socios activos de la suscripción.'}
            </p>
          </div>
        </div>
        {confirmarBaja && (
          <div className="soft-alert" role="alert">
            <div>
              <h4>{activo ? '¿Desactivar a este socio?' : '¿Reactivar a este socio?'}</h4>
              <p>{activo ? 'No podrá ingresar ni reservar hasta que lo reactives.' : 'Se verificará la capacidad de tu suscripción.'}</p>
              <div className="form-actions">
                <Boton estilo="outline" chico onClick={() => setConfirmarBaja(false)}>
                  Volver
                </Boton>
                <Boton estilo={activo ? 'danger' : 'primary'} chico cargando={accion.enviando} onClick={cambiarEstado}>
                  {activo ? 'Confirmar desactivación' : 'Confirmar reactivación'}
                </Boton>
              </div>
            </div>
          </div>
        )}
        <div className="form-actions split">
          {gestion ? (
            <Boton estilo={activo ? 'danger' : 'soft'} icono="user" onClick={() => setConfirmarBaja(true)}>
              {activo ? 'Desactivar socio' : 'Reactivar socio'}
            </Boton>
          ) : (
            <span />
          )}
          <div>
            <Boton estilo="outline" onClick={alCerrar}>
              Cancelar
            </Boton>
            {gestion && (
              <button type="submit" className="btn primary" disabled={accion.enviando}>
                Guardar cambios
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
