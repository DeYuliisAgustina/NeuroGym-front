import { Link } from 'react-router-dom';
import { EncabezadoPagina, Kpi } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero, etiqueta } from '../../utils/formato';

interface Gimnasio {
  razonSocial: string;
  suscripcion: { tipo: string; maxSedes: number; maxSociosActivos: number } | null;
  uso: { sedesHabilitadas: number; sociosActivos: number };
}
interface Resumen {
  periodo: string;
  cuotas: { estado: string; cantidad: number; importe: number }[];
  pagosPorMedio: { medio: string; cantidad: number; importe: number }[];
}

/** Panel general del administrador: suscripción, uso y accesos según los permisos del rol. */
export function PanelGeneral() {
  const { sesion, puede } = useAuth();
  const gimnasio = useApi(() => api.get<Gimnasio>('/admin/gimnasio'));
  const resumen = useApi(() => (puede('COBROS') ? api.get<Resumen>('/admin/cuotas/resumen') : Promise.resolve(null)));
  const alertas = useApi(() => (puede('EQUIPAMIENTO') ? api.get<unknown[]>('/admin/equipos/alertas') : Promise.resolve(null)));
  const g = gimnasio.datos;
  const cobrado = resumen.datos?.pagosPorMedio.reduce((t, p) => t + p.importe, 0) ?? 0;
  const impagas = resumen.datos?.cuotas.find((c) => c.estado === 'IMPAGA')?.cantidad ?? 0;
  return (
    <div>
      <EncabezadoPagina titulo="Panel general" descripcion={g ? `${g.razonSocial} · ${etiqueta(g.suscripcion?.tipo)} · Rol: ${sesion?.rol}` : undefined} />
      {g && (
        <div className="grilla-4">
          <Kpi titulo="Socios activos" valor={g.uso.sociosActivos} detalle={`de ${g.suscripcion?.maxSociosActivos.toLocaleString('es-AR')} de la suscripción`} />
          <Kpi titulo="Sedes habilitadas" valor={g.uso.sedesHabilitadas} detalle={`de ${g.suscripcion?.maxSedes}`} />
          {resumen.datos && <Kpi titulo={`Cobrado ${resumen.datos.periodo}`} valor={dinero(cobrado)} detalle={`${impagas} cuotas impagas`} />}
          {alertas.datos && <Kpi titulo="Alertas de equipamiento" valor={alertas.datos.length} detalle="Services y recambios próximos" />}
        </div>
      )}
      <div className="grilla-3" style={{ marginTop: '1rem' }}>
        {[
          ['RECEPCION', '/admin/recepcion', 'Recepción QR', 'Validá ingresos y registrá asistencias.'],
          ['SOCIOS', '/admin/socios', 'Socios', 'Altas, modificaciones y bajas lógicas.'],
          ['COBROS', '/admin/cobros', 'Cuotas y cobros', 'Estados de cuota y pagos en efectivo.'],
          ['RETENCION', '/admin/retencion', 'Constancia y regreso', 'Señales de abandono e incentivos.'],
          ['EQUIPAMIENTO', '/admin/equipamiento', 'Equipamiento', 'Inventario, incidencias y mantenimientos.'],
          ['SEDES', '/admin/turnos', 'Horarios y cupos', 'Turnos de clases y musculación.'],
        ]
          .filter(([modulo]) => puede(modulo))
          .map(([, ruta, titulo, texto]) => (
            <Link key={ruta} to={ruta} className="tarjeta" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>{titulo} →</h3>
              <p className="tenue">{texto}</p>
            </Link>
          ))}
      </div>
    </div>
  );
}
