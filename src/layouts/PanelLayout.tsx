import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icono } from '../components/Icono';
import { ModalAyuda, ModalPrivacidad } from '../components/ModalesInfo';
import { Notificaciones } from '../components/Notificaciones';
import { Avatar, Boton, Insignia, Marca, inicialesDe } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useSedeVista } from '../contexts/SedeContext';
import { api } from '../services/api';
import type { Sede } from '../types';

export interface ItemNavegacion {
  ruta: string;
  texto: string;
  icono: string;
  insignia?: string;
}

export interface ConfiguracionPanel {
  rol: 'socio' | 'admin' | 'profesional';
  /** Grupos de la barra lateral: [etiqueta, ítems]. */
  grupos: [string, ItemNavegacion[]][];
  /** Rutas que aparecen en la barra inferior del celular. */
  movil: string[];
  nombreRol: string;
  portal: string;
  subtituloUsuario: string;
  rutaUsuario: string;
  insignias?: React.ReactNode;
  cajaSede?: React.ReactNode;
}

/**
 * Armazón de los paneles con el mismo marcado del prototipo: barra lateral
 * (sidebar), encabezado (app-topbar), encabezado y navegación inferior en celular.
 */
export function PanelLayout({ config }: { config: ConfiguracionPanel }) {
  const { sesion, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [info, setInfo] = useState<'privacidad' | 'ayuda' | null>(null);
  const items = config.grupos.flatMap(([, lista]) => lista);
  const actual = [...items].sort((a, b) => b.ruta.length - a.ruta.length).find((i) => ubicacion.pathname.startsWith(i.ruta));

  useEffect(() => setMenuAbierto(false), [ubicacion.pathname]);
  useEffect(() => {
    api
      .get<{ leida: boolean }[]>('/notificaciones', { noLeidas: 'true' })
      .then((l) => setSinLeer(l.length))
      .catch(() => undefined);
  }, [ubicacion.pathname, notificaciones]);

  const salir = () => {
    cerrarSesion();
    navegar(config.rol === 'admin' ? '/admin/ingreso' : '/');
  };
  const nombre = sesion?.nombre ?? '';
  const enlace = (i: ItemNavegacion, clase: string) => (
    <NavLink key={i.ruta} to={i.ruta} end={i.ruta.split('/').length <= 2} className={({ isActive }) => `${clase} ${isActive ? 'active' : ''}`.trim()}>
      <Icono n={i.icono} />
      {clase === 'mobile-nav' ? <span>{i.texto}</span> : i.texto}
      {clase === 'nav-item' && i.insignia && <span className="mini-badge">{i.insignia}</span>}
    </NavLink>
  );

  return (
    <>
      <div className="mobile-header">
        <button type="button" aria-label="Abrir menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto((v) => !v)}>
          <Icono n="menu" />
        </button>
        <Marca />
        <button type="button" aria-label="Notificaciones" onClick={() => setNotificaciones(true)}>
          <Icono n="bell" />
        </button>
      </div>
      <aside className={`sidebar ${menuAbierto ? 'open' : ''}`.trim()} aria-label="Navegación principal">
        <Marca />
        {config.grupos.map(([etiqueta, lista]) => (
          <div key={etiqueta} style={{ display: 'contents' }}>
            <div className="nav-label">{etiqueta}</div>
            <nav className="nav-group">{lista.map((i) => enlace(i, 'nav-item'))}</nav>
          </div>
        ))}
        <div className="sidebar-bottom">
          <Boton estilo="outline" chico icono="logout" onClick={salir}>
            Cerrar sesión
          </Boton>
          {config.cajaSede}
          <button className="side-bottom-link" type="button" onClick={() => setInfo('ayuda')}>
            <Icono n="help" />
            Ayuda y contacto
          </button>
          {config.rol !== 'admin' && (
            <Link className="side-bottom-link" to="/">
              <Icono n="globe" />
              Sobre NeuroGym
            </Link>
          )}
          <div className="side-caption">NEUROGYM · ROSARIO</div>
        </div>
      </aside>
      <div className="app-shell">
        <header className="app-topbar">
          <div className="breadcrumb">
            <span className="portal-label">{config.portal}</span>
            {config.nombreRol}
            <Icono n="chevron" />
            <strong>{actual?.texto ?? 'Inicio'}</strong>
          </div>
          <div className="top-actions">
            {config.insignias}
            <button className="icon-button" type="button" aria-label="Ver notificaciones" onClick={() => setNotificaciones(true)}>
              <Icono n="bell" />
              {sinLeer > 0 && <i className="notification-dot" />}
            </button>
            <Link className="user-top" to={config.rutaUsuario}>
              <Avatar iniciales={inicialesDe(nombre)} />
              <div>
                <strong>{nombre.split(' ')[0]}</strong>
                <small>{config.subtituloUsuario}</small>
              </div>
            </Link>
          </div>
        </header>
        <main id="main" className="app-content">
          <div className="animation-in" key={ubicacion.pathname}>
            <Outlet />
          </div>
          <footer className="dashboard-footer">
            <span>© 2026 NeuroGym</span>
            <button type="button" onClick={() => setInfo('privacidad')}>
              Privacidad y autonomía
            </button>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="Accesos rápidos">
        {config.movil.map((ruta) => items.find((i) => i.ruta === ruta)).filter(Boolean).map((i) => enlace(i!, 'mobile-nav'))}
      </nav>
      <Notificaciones abierto={notificaciones} onCerrar={() => setNotificaciones(false)} />
      <ModalPrivacidad abierto={info === 'privacidad'} onCerrar={() => setInfo(null)} />
      <ModalAyuda abierto={info === 'ayuda'} onCerrar={() => setInfo(null)} />
    </>
  );
}

/** Caja "Vista de sedes" (administración) que filtra los listados por sede. */
export function CajaSedeAdmin() {
  const { sedeId, setSedeId } = useSedeVista();
  const [sedes, setSedes] = useState<Sede[]>([]);
  useEffect(() => {
    api.get<Sede[]>('/admin/sedes').then(setSedes).catch(() => setSedes([]));
  }, []);
  return (
    <div className="sede-box">
      <div className="eyebrow">VISTA DE SEDES</div>
      <select aria-label="Seleccionar sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
        <option value="">Todas las sedes</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export { Insignia };
