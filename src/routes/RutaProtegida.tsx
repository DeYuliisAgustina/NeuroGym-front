import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Cargando } from '../components/ui';
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
  if (!sesion) return <Navigate to={perfil === 'PERSONAL' ? '/admin/ingreso' : '/ingreso'} state={{ desde: ubicacion.pathname }} replace />;
  if (sesion.tipo !== perfil) return <Navigate to={inicioDe(sesion)} replace />;
  if (modulo && !puede(modulo, acceso)) {
    return (
      <div className="contenedor">
        <div className="aviso aviso-alerta">Tu rol no tiene permiso para acceder a esta sección.</div>
      </div>
    );
  }
  return <>{children}</>;
}
