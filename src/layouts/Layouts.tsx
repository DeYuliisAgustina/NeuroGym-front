import { useAuth } from '../contexts/AuthContext';
import { PanelLayout, type ItemNavegacion } from './PanelLayout';

/** Navegación del socio (Mapa de navegación del TFI, sector izquierdo). */
export function SocioLayout() {
  const items: ItemNavegacion[] = [
    { ruta: '/socio', texto: 'Inicio', icono: '⌂', fin: true },
    { ruta: '/socio/rutina', texto: 'Mi rutina', icono: '🏋' },
    { ruta: '/socio/turnos', texto: 'Turnos', icono: '📅' },
    { ruta: '/socio/qr', texto: 'Mi QR', icono: '▣' },
    { ruta: '/socio/cuotas', texto: 'Cuotas', icono: '$' },
    { ruta: '/socio/beneficios', texto: 'Beneficios', icono: '★' },
    { ruta: '/socio/profesionales', texto: 'Profesionales', icono: '✚' },
    { ruta: '/socio/equipamiento', texto: 'Equipos', icono: '⚙' },
    { ruta: '/socio/perfil', texto: 'Perfil', icono: '☺' },
  ];
  return <PanelLayout items={items} subtitulo="Socio" />;
}

/** Navegación del profesional (sector central). */
export function ProfesionalLayout() {
  return (
    <PanelLayout
      subtitulo="Profesional"
      items={[
        { ruta: '/profesional', texto: 'Mi agenda', icono: '📅', fin: true },
        { ruta: '/profesional/perfil', texto: 'Perfil y servicios', icono: '☺' },
      ]}
    />
  );
}

/** Navegación administrativa: solo muestra los módulos que el rol puede consultar. */
export function AdminLayout() {
  const { sesion, puede } = useAuth();
  const items: (ItemNavegacion & { modulo?: string; soloAdmin?: boolean })[] = [
    { ruta: '/admin', texto: 'Panel general', icono: '⌂', fin: true },
    { ruta: '/admin/recepcion', texto: 'Recepción QR', icono: '▣', modulo: 'RECEPCION' },
    { ruta: '/admin/socios', texto: 'Socios', icono: '👥', modulo: 'SOCIOS' },
    { ruta: '/admin/cobros', texto: 'Cuotas y cobros', icono: '$', modulo: 'COBROS' },
    { ruta: '/admin/turnos', texto: 'Horarios y cupos', icono: '📅', modulo: 'SEDES' },
    { ruta: '/admin/sedes', texto: 'Sedes', icono: '🏢', modulo: 'SEDES' },
    { ruta: '/admin/equipamiento', texto: 'Equipamiento', icono: '⚙', modulo: 'EQUIPAMIENTO' },
    { ruta: '/admin/retencion', texto: 'Constancia y regreso', icono: '★', modulo: 'RETENCION' },
    { ruta: '/admin/intelligence', texto: 'Intelligence', icono: '◆', modulo: 'INTELLIGENCE' },
    { ruta: '/admin/precios', texto: 'Planes y precios', icono: '%', modulo: 'PRECIOS' },
    { ruta: '/admin/personal', texto: 'Usuarios y permisos', icono: '🔑', soloAdmin: true },
    { ruta: '/admin/configuracion', texto: 'Políticas', icono: '⚑', modulo: 'CONFIGURACION' },
  ];
  const visibles = items.filter((i) => (i.soloAdmin ? sesion?.esAdminGeneral : !i.modulo || puede(i.modulo)));
  return <PanelLayout items={visibles} subtitulo="Administración" />;
}
