import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Notificaciones } from '../components/Notificaciones';
import { useAuth } from '../contexts/AuthContext';

export interface ItemNavegacion {
  ruta: string;
  texto: string;
  icono: string;
  fin?: boolean;
}

/** Estructura común de los paneles (socio, personal y profesional), Mobile First. */
export function PanelLayout({ items, subtitulo }: { items: ItemNavegacion[]; subtitulo: string }) {
  const { sesion, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const salir = () => {
    cerrarSesion();
    navegar('/');
  };
  return (
    <div className="panel">
      <header className="panel-barra no-imprimir">
        <div>
          <a className="marca" href="/">
            Neuro<span>Gym</span>
          </a>
          <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
            {subtitulo} · {sesion?.nombre}
          </div>
        </div>
        <div className="fila">
          <Notificaciones />
          <button className="btn btn-texto btn-chico" onClick={salir}>
            Salir
          </button>
        </div>
      </header>
      <div className="panel-cuerpo">
        <nav className="panel-lateral no-imprimir" aria-label="Navegación principal">
          {items.map((i) => (
            <NavLink key={i.ruta} to={i.ruta} end={i.fin}>
              <span aria-hidden>{i.icono}</span>
              {i.texto}
            </NavLink>
          ))}
        </nav>
        <main className="panel-contenido">
          <div className="contenedor">
            <Outlet />
          </div>
        </main>
      </div>
      <nav className="navegacion-inferior no-imprimir" aria-label="Navegación">
        {items.map((i) => (
          <NavLink key={i.ruta} to={i.ruta} end={i.fin}>
            <span className="icono" aria-hidden>
              {i.icono}
            </span>
            {i.texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
