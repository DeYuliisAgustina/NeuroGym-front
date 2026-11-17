import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Cargando } from '../components/ui';
import { AdminLayout, ProfesionalLayout, SocioLayout } from '../layouts/Layouts';
import { RutaProtegida } from './RutaProtegida';

// Carga diferida por pantalla: reduce el JavaScript inicial en celulares (RNF1).
const Cobros = lazy(() => import('../pages/admin/Cobros').then((m) => ({ default: m.Cobros })));
const Configuracion = lazy(() => import('../pages/admin/Configuracion').then((m) => ({ default: m.Configuracion })));
const EquipamientoAdmin = lazy(() => import('../pages/admin/EquipamientoAdmin').then((m) => ({ default: m.EquipamientoAdmin })));
const Incidencias = lazy(() => import('../pages/admin/Incidencias').then((m) => ({ default: m.Incidencias })));
const Intelligence = lazy(() => import('../pages/admin/Intelligence').then((m) => ({ default: m.Intelligence })));
const Mantenimiento = lazy(() => import('../pages/admin/Mantenimiento').then((m) => ({ default: m.Mantenimiento })));
const PanelGeneral = lazy(() => import('../pages/admin/PanelGeneral').then((m) => ({ default: m.PanelGeneral })));
const Personal = lazy(() => import('../pages/admin/Personal').then((m) => ({ default: m.Personal })));
const Precios = lazy(() => import('../pages/admin/Precios').then((m) => ({ default: m.Precios })));
const RecepcionQr = lazy(() => import('../pages/admin/RecepcionQr').then((m) => ({ default: m.RecepcionQr })));
const Retencion = lazy(() => import('../pages/admin/Retencion').then((m) => ({ default: m.Retencion })));
const Sedes = lazy(() => import('../pages/admin/Sedes').then((m) => ({ default: m.Sedes })));
const Socios = lazy(() => import('../pages/admin/Socios').then((m) => ({ default: m.Socios })));
const TurnosAdmin = lazy(() => import('../pages/admin/TurnosAdmin').then((m) => ({ default: m.TurnosAdmin })));
const Agenda = lazy(() => import('../pages/profesional/Agenda').then((m) => ({ default: m.Agenda })));
const PerfilProfesional = lazy(() => import('../pages/profesional/PerfilProfesional').then((m) => ({ default: m.PerfilProfesional })));
const Servicios = lazy(() => import('../pages/profesional/Servicios').then((m) => ({ default: m.Servicios })));
const Solicitudes = lazy(() => import('../pages/profesional/Solicitudes').then((m) => ({ default: m.Solicitudes })));
const SuscripcionProfesional = lazy(() => import('../pages/profesional/SuscripcionProfesional').then((m) => ({ default: m.SuscripcionProfesional })));
const Ingreso = lazy(() => import('../pages/publico/Ingreso').then((m) => ({ default: m.Ingreso })));
const Inicio = lazy(() => import('../pages/publico/Inicio').then((m) => ({ default: m.Inicio })));
const Registro = lazy(() => import('../pages/publico/Registro').then((m) => ({ default: m.Registro })));
const Beneficios = lazy(() => import('../pages/socio/Beneficios').then((m) => ({ default: m.Beneficios })));
const Bienvenida = lazy(() => import('../pages/socio/Bienvenida').then((m) => ({ default: m.Bienvenida })));
const CuotasPagos = lazy(() => import('../pages/socio/CuotasPagos').then((m) => ({ default: m.CuotasPagos })));
const Equipamiento = lazy(() => import('../pages/socio/Equipamiento').then((m) => ({ default: m.Equipamiento })));
const InicioSocio = lazy(() => import('../pages/socio/InicioSocio').then((m) => ({ default: m.InicioSocio })));
const MiQr = lazy(() => import('../pages/socio/MiQr').then((m) => ({ default: m.MiQr })));
const MiRutina = lazy(() => import('../pages/socio/MiRutina').then((m) => ({ default: m.MiRutina })));
const PerfilSocio = lazy(() => import('../pages/socio/PerfilSocio').then((m) => ({ default: m.PerfilSocio })));
const Profesionales = lazy(() => import('../pages/socio/Profesionales').then((m) => ({ default: m.Profesionales })));
const Turnos = lazy(() => import('../pages/socio/Turnos').then((m) => ({ default: m.Turnos })));

/** Redirige una ruta anterior conservando los parámetros (por ejemplo, el retorno de Mercado Pago). */
function Renombrada({ a }: { a: string }) {
  const { search } = useLocation();
  return <Navigate to={`${a}${search}`} replace />;
}

/** Navegación de la aplicación, separada por perfil (mapa de navegación del TFI, rutas del prototipo). */
export function AppRouter() {
  const socio = (elemento: React.ReactNode) => <RutaProtegida perfil="SOCIO">{elemento}</RutaProtegida>;
  const admin = (elemento: React.ReactNode, modulo?: string) => (
    <RutaProtegida perfil="PERSONAL" modulo={modulo}>
      {elemento}
    </RutaProtegida>
  );
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/ingreso" element={<Ingreso />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/profesionales/registro" element={<Navigate to="/registro?perfil=profesional" replace />} />
        <Route path="/admin/ingreso" element={<Ingreso administrativo />} />
        <Route path="/socio/bienvenida" element={socio(<Bienvenida />)} />

        <Route path="/socio" element={socio(<SocioLayout />)}>
          <Route index element={<InicioSocio />} />
          <Route path="rutina" element={<MiRutina />} />
          <Route path="turnos" element={<Turnos />} />
          <Route path="qr" element={<MiQr />} />
          <Route path="pagos" element={<CuotasPagos />} />
          <Route path="cuotas" element={<Renombrada a="/socio/pagos" />} />
          <Route path="beneficios" element={<Beneficios />} />
          <Route path="marketplace" element={<Profesionales />} />
          <Route path="incidencias" element={<Equipamiento />} />
          <Route path="perfil" element={<PerfilSocio />} />
        </Route>

        <Route
          path="/profesional"
          element={
            <RutaProtegida perfil="PROFESIONAL">
              <ProfesionalLayout />
            </RutaProtegida>
          }
        >
          <Route index element={<Agenda />} />
          <Route path="solicitudes" element={<Solicitudes />} />
          <Route path="servicios" element={<Servicios />} />
          <Route path="perfil" element={<PerfilProfesional />} />
          <Route path="suscripcion" element={<SuscripcionProfesional />} />
        </Route>

        <Route path="/admin" element={admin(<AdminLayout />)}>
          <Route index element={<PanelGeneral />} />
          <Route path="recepcion" element={admin(<RecepcionQr />, 'RECEPCION')} />
          <Route path="socios" element={admin(<Socios />, 'SOCIOS')} />
          <Route path="turnos" element={admin(<TurnosAdmin />, 'SEDES')} />
          <Route path="pagos" element={admin(<Cobros />, 'COBROS')} />
          <Route path="retencion" element={admin(<Retencion />, 'RETENCION')} />
          <Route path="analitica" element={admin(<Intelligence />, 'INTELLIGENCE')} />
          <Route path="equipamiento" element={admin(<EquipamientoAdmin />, 'EQUIPAMIENTO')} />
          <Route path="incidencias" element={admin(<Incidencias />, 'EQUIPAMIENTO')} />
          <Route path="mantenimiento" element={admin(<Mantenimiento />, 'EQUIPAMIENTO')} />
          <Route path="sedes" element={admin(<Sedes />, 'SEDES')} />
          <Route path="precios" element={admin(<Precios />, 'PRECIOS')} />
          <Route path="accesos" element={admin(<Personal />)} />
          <Route path="suscripcion" element={admin(<Configuracion />, 'CONFIGURACION')} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
