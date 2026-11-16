import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, registrarExpiracion, tokenAlmacenado } from '../services/api';
import type { Sesion, TipoAcceso } from '../types';

interface ContextoAuth {
  sesion: Sesion | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string, administrativo?: boolean) => Promise<Sesion>;
  aplicarSesion: (token: string, usuario: Sesion) => void;
  cerrarSesion: () => void;
  /** Solo oculta opciones: la autorización real la valida el backend. */
  puede: (modulo: string, acceso?: TipoAcceso) => boolean;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = useCallback(() => {
    tokenAlmacenado.borrar();
    setSesion(null);
  }, []);

  useEffect(() => {
    registrarExpiracion(cerrarSesion);
    if (!tokenAlmacenado.leer()) return setCargando(false);
    api
      .get<Sesion>('/auth/sesion')
      .then(setSesion)
      .catch(cerrarSesion)
      .finally(() => setCargando(false));
  }, [cerrarSesion]);

  const aplicarSesion = useCallback((token: string, usuario: Sesion) => {
    tokenAlmacenado.guardar(token);
    setSesion(usuario);
  }, []);

  const iniciarSesion = useCallback(
    async (email: string, password: string, administrativo = false) => {
      const respuesta = await api.post<{ token: string; usuario: Sesion }>(administrativo ? '/auth/admin/login' : '/auth/login', { email, password });
      aplicarSesion(respuesta.token, respuesta.usuario);
      return respuesta.usuario;
    },
    [aplicarSesion],
  );

  const puede = useCallback(
    (modulo: string, acceso: TipoAcceso = 'CONSULTA') => {
      if (sesion?.tipo !== 'PERSONAL') return false;
      if (sesion.esAdminGeneral) return true;
      return sesion.permisos.includes(`${modulo}:${acceso}`) || (acceso === 'CONSULTA' && sesion.permisos.includes(`${modulo}:GESTION`));
    },
    [sesion],
  );

  const valor = useMemo(() => ({ sesion, cargando, iniciarSesion, aplicarSesion, cerrarSesion, puede }), [sesion, cargando, iniciarSesion, aplicarSesion, cerrarSesion, puede]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}

/** Ruta de inicio según el perfil del usuario. */
export const inicioDe = (sesion: Sesion) => (sesion.tipo === 'SOCIO' ? '/socio' : sesion.tipo === 'PROFESIONAL' ? '/profesional' : '/admin');
