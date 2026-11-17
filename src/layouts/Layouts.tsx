import { useEffect, useState } from 'react';
import { Insignia } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { SedeProvider } from '../contexts/SedeContext';
import { api } from '../services/api';
import { etiqueta } from '../utils/formato';
import { CajaSedeAdmin, PanelLayout, type ItemNavegacion } from './PanelLayout';

/** Navegación del socio (prototipo: "TU DÍA A DÍA" y "PARA VOS"). */
export function SocioLayout() {
  const [perfil, setPerfil] = useState<{ esPremium: boolean; sede: { nombre: string; gimnasio?: { razonSocial: string } } } | null>(null);
  useEffect(() => {
    api.get<NonNullable<typeof perfil>>('/socio/perfil').then(setPerfil).catch(() => undefined);
  }, []);
  return (
    <PanelLayout
      config={{
        rol: 'socio',
        portal: 'NEUROGYM',
        nombreRol: 'Tu espacio',
        subtituloUsuario: perfil?.esPremium ? 'Plan Premium' : 'Plan Básico',
        rutaUsuario: '/socio/perfil',
        movil: ['/socio', '/socio/rutina', '/socio/turnos', '/socio/qr', '/socio/perfil'],
        grupos: [
          [
            'TU DÍA A DÍA',
            [
              { ruta: '/socio', texto: 'Mi resumen', icono: 'grid' },
              { ruta: '/socio/rutina', texto: 'Mi rutina', icono: 'dumbbell' },
              { ruta: '/socio/turnos', texto: 'Mis turnos', icono: 'calendar' },
              { ruta: '/socio/qr', texto: 'Mi QR de ingreso', icono: 'camera' },
            ],
          ],
          [
            'PARA VOS',
            [
              { ruta: '/socio/pagos', texto: 'Cuotas y pagos', icono: 'wallet' },
              { ruta: '/socio/beneficios', texto: 'Mis beneficios', icono: 'gift' },
              { ruta: '/socio/marketplace', texto: 'Profesionales', icono: 'users', insignia: 'PREMIUM' },
              { ruta: '/socio/incidencias', texto: 'Equipamiento', icono: 'tool' },
              { ruta: '/socio/perfil', texto: 'Mi perfil', icono: 'user' },
            ],
          ],
        ],
        insignias: perfil?.sede.gimnasio && <span className="badge neutral doc-gym-badge">{perfil.sede.gimnasio.razonSocial}</span>,
        cajaSede: (
          <div className="sede-box">
            <div className="eyebrow">TU SEDE</div>
            {/* La sede del socio la asigna el gimnasio: se muestra, no se elige. */}
            <select aria-label="Tu sede" disabled value="sede">
              <option value="sede">{perfil?.sede.nombre ?? '…'}</option>
            </select>
          </div>
        ),
      }}
    />
  );
}

/** Navegación del profesional independiente ("TU ESPACIO"). */
export function ProfesionalLayout() {
  const [especialidad, setEspecialidad] = useState('');
  useEffect(() => {
    api
      .get<{ especialidad: string }>('/profesional/perfil')
      .then((p) => setEspecialidad(p.especialidad === 'NUTRICION' ? 'Nutricionista' : 'Deportólogo/a'))
      .catch(() => undefined);
  }, []);
  return (
    <PanelLayout
      config={{
        rol: 'profesional',
        portal: 'NEUROGYM',
        nombreRol: 'Profesionales',
        subtituloUsuario: 'Profesional',
        rutaUsuario: '/profesional/perfil',
        movil: ['/profesional', '/profesional/solicitudes', '/profesional/servicios', '/profesional/perfil', '/profesional/suscripcion'],
        grupos: [
          [
            'TU ESPACIO',
            [
              { ruta: '/profesional', texto: 'Mi agenda', icono: 'calendar' },
              { ruta: '/profesional/solicitudes', texto: 'Solicitudes', icono: 'message' },
              { ruta: '/profesional/servicios', texto: 'Mis servicios', icono: 'clipboard' },
              { ruta: '/profesional/perfil', texto: 'Mi perfil', icono: 'user' },
              { ruta: '/profesional/suscripcion', texto: 'Mi plan Marketplace', icono: 'receipt' },
            ],
          ],
        ],
        insignias: <span className="badge neutral doc-gym-badge">Marketplace compartido</span>,
        cajaSede: (
          <div className="sede-box">
            <div className="eyebrow">PROFESIONAL INDEPENDIENTE</div>
            <div style={{ fontSize: 12, marginTop: 5, color: '#dbe7ce' }}>{especialidad || 'Profesional'} · Rosario</div>
          </div>
        ),
      }}
    />
  );
}

/** Módulos administrativos del prototipo con el permiso que habilita cada uno (patrón Composite en el backend). */
const MODULOS_ADMIN: (ItemNavegacion & { modulo?: string; soloAdmin?: boolean })[] = [
  { ruta: '/admin', texto: 'Panel general', icono: 'grid' },
  { ruta: '/admin/recepcion', texto: 'Recepción QR', icono: 'camera', modulo: 'RECEPCION' },
  { ruta: '/admin/socios', texto: 'Socios', icono: 'users', modulo: 'SOCIOS' },
  { ruta: '/admin/turnos', texto: 'Turnos y asistencia', icono: 'calendar', modulo: 'SEDES' },
  { ruta: '/admin/pagos', texto: 'Cobros', icono: 'wallet', modulo: 'COBROS' },
  { ruta: '/admin/retencion', texto: 'Constancia y regreso', icono: 'heart', modulo: 'RETENCION' },
  { ruta: '/admin/analitica', texto: 'NeuroGym Intelligence', icono: 'chart', modulo: 'INTELLIGENCE' },
  { ruta: '/admin/equipamiento', texto: 'Equipamiento', icono: 'dumbbell', modulo: 'EQUIPAMIENTO' },
  { ruta: '/admin/incidencias', texto: 'Incidencias', icono: 'tool', modulo: 'EQUIPAMIENTO' },
  { ruta: '/admin/mantenimiento', texto: 'Mantenimiento', icono: 'clipboard', modulo: 'EQUIPAMIENTO' },
  { ruta: '/admin/sedes', texto: 'Sedes', icono: 'building', modulo: 'SEDES' },
  { ruta: '/admin/precios', texto: 'Precios y políticas', icono: 'settings', modulo: 'PRECIOS' },
  { ruta: '/admin/accesos', texto: 'Usuarios y permisos', icono: 'shield', soloAdmin: true },
  { ruta: '/admin/suscripcion', texto: 'Suscripción SaaS', icono: 'receipt', modulo: 'CONFIGURACION' },
];

/** Panel administrativo: muestra solo los módulos que el rol puede consultar. */
export function AdminLayout() {
  const { sesion, puede } = useAuth();
  const [gimnasio, setGimnasio] = useState<{ razonSocial: string; suscripcion: { tipo: string } | null } | null>(null);
  useEffect(() => {
    api.get<NonNullable<typeof gimnasio>>('/admin/gimnasio').then(setGimnasio).catch(() => undefined);
  }, []);
  const visibles = MODULOS_ADMIN.filter((m) => (m.soloAdmin ? sesion?.esAdminGeneral : !m.modulo || puede(m.modulo)));
  return (
    <SedeProvider>
      <PanelLayout
        config={{
          rol: 'admin',
          portal: 'ACCESO INTERNO',
          nombreRol: 'Administración',
          subtituloUsuario: sesion?.rol ?? 'Personal',
          rutaUsuario: '/admin',
          movil: [0, 1, 2, 5, 6].map((i) => visibles[i]?.ruta).filter(Boolean) as string[],
          grupos: [
            ['TU GIMNASIO', visibles.slice(0, 5)],
            ['OPERACIÓN', visibles.slice(5)],
          ].filter(([, l]) => l.length > 0) as [string, ItemNavegacion[]][],
          insignias: (
            <>
              {gimnasio && <span className="badge neutral doc-gym-badge">{gimnasio.razonSocial}</span>}
              {gimnasio?.suscripcion && <Insignia color={gimnasio.suscripcion.tipo === 'INTELLIGENCE' ? 'lilac' : 'neutral'}>{etiqueta(gimnasio.suscripcion.tipo)}</Insignia>}
              <Insignia color="neutral">{sesion?.rol ?? 'Personal'}</Insignia>
            </>
          ),
          cajaSede: <CajaSedeAdmin />,
        }}
      />
    </SedeProvider>
  );
}
