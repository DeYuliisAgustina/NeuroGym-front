import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Cargando, Vacio } from '../components/ui';
import { inicioDe, useAuth } from '../contexts/AuthContext';
import type { TipoAcceso, TipoUsuario } from '../types';

/**
 * Protege rutas por perfil y, para el personal, por permiso de módulo.
 * Es una ayuda de navegación: el backend vuelve a validar cada operación.
 */
export function RutaProtegida({ perfil, modulo, acceso = 'CONSULTA', children }: { perfil: TipoUsuario; modulo?: string; acceso?: TipoAcceso; children: ReactNode }) {
  const { sesion, cargando, puede } = useAuth();
  const ubicacion = useLocation();
  if (cargando) return <Cargando />;
  if (!sesion) return <Navigate to={perfil === 'PERSONAL' ? '/admin/ingreso' : '/ingreso'} state={{ desde: `${ubicacion.pathname}${ubicacion.search}` }} replace />;
  if (sesion.tipo !== perfil) return <Navigate to={inicioDe(sesion)} replace />;
  // "Usuarios y permisos" es exclusivo del administrador general.
  const permitido = modulo ? puede(modulo, acceso) : ubicacion.pathname.startsWith('/admin/accesos') ? !!sesion.esAdminGeneral : true;
  if (!permitido) {
    return (
      <section className="card" role="alert">
        <Vacio titulo="Sin acceso a este módulo" descripcion="Tu rol no tiene permiso para acceder a esta sección." icono="shield" />
      </section>
    );
  }
  return <>{children}</>;
}
