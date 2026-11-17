import { Link } from 'react-router-dom';
import hero from '../../assets/img/hero-entrenamiento.webp';
import { Icono } from '../../components/Icono';
import { BotonEnlace, CabeceraTarjeta, Cargando, Encabezado, EnlaceTexto, ErrorFormulario, Insignia, Kpi, Vacio } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Cuota, EjercicioRutina, Turno } from '../../types';
import { fechaLarga, hoyIso, sumarDiasIso, conSede } from '../../utils/formato';

interface Perfil {
  saldoPuntos: number;
  esPremium: boolean;
  sede: { nombre: string };
  usuario: { nombre: string };
  preferencia: { objetivo: string; diasPorSemana: number } | null;
}
interface Asistencia {
  id: number;
  fecha: string;
  actividad: string;
}
interface Beneficios {
  saldoPuntos: number;
  beneficios: { id: number; costoPuntos: number; disponible: boolean }[];
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Lunes de la semana de una fecha ISO. */
function lunesDe(fechaIso: string) {
  const d = new Date(`${fechaIso}T12:00:00Z`).getUTCDay();
  return sumarDiasIso(fechaIso, d === 0 ? -6 : 1 - d);
}

export const iconoEjercicio = (grupo: string) => (/pierna|glúteo|gluteo|cuádriceps|isquio/i.test(grupo) ? 'legs' : /cardio|resistencia/i.test(grupo) ? 'activity' : 'dumbbell');

/** Mi resumen del socio: rutina del día, actividad de la semana, puntos, próximo turno y cuota. */
export function InicioSocio() {
  const perfil = useApi(() => api.get<Perfil>('/socio/perfil'));
  const reservas = useApi(() => api.get<{ proximas: { id: number; turno: Turno }[] }>('/socio/reservas'));
  const cuota = useApi(() => api.get<{ cuota: Cuota | null }>('/socio/cuota'));
  const asistencias = useApi(() => api.get<Asistencia[]>('/socio/asistencias'));
  const rutina = useApi(() => api.get<{ rutina: { ejercicios: EjercicioRutina[] } | null }>('/socio/rutina'));
  const beneficios = useApi(() => api.get<Beneficios>('/socio/beneficios'));

  if (perfil.cargando) return <Cargando />;
  if (perfil.error || !perfil.datos) return <ErrorFormulario>{perfil.error}</ErrorFormulario>;
  const p = perfil.datos;
  const hoy = hoyIso();
  const lunes = lunesDe(hoy);
  const semana = DIAS.map((_, i) => sumarDiasIso(lunes, i));
  const mes = hoy.slice(0, 7);
  const asistenciasMes = asistencias.datos?.filter((a) => a.fecha.startsWith(mes)).length ?? 0;
  const diasConAsistencia = new Set(asistencias.datos?.filter((a) => a.fecha >= lunes).map((a) => a.fecha));
  const diasReservados = new Set(reservas.datos?.proximas.map((r) => r.turno.fecha));
  const objetivoSemanal = p.preferencia?.diasPorSemana ?? 3;
  const proxima = reservas.datos?.proximas[0];
  const c = cuota.datos?.cuota;
  const ejercicios = rutina.datos?.rutina?.ejercicios ?? [];
  const diaRutina = ejercicios.length ? Math.min(...ejercicios.map((e) => e.dia)) : 1;
  const deHoy = ejercicios.filter((e) => e.dia === diaRutina).sort((a, b) => a.orden - b.orden);
  const sinEquipo = ejercicios.find((e) => !e.disponible);
  const saldo = beneficios.datos?.saldoPuntos ?? p.saldoPuntos;
  const costoMinimo = Math.min(...(beneficios.datos?.beneficios.filter((b) => b.disponible).map((b) => b.costoPuntos) ?? []), Infinity);
  const progreso = Number.isFinite(costoMinimo) ? Math.min(100, Math.round((saldo / costoMinimo) * 100)) : 0;
  const titulo = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).toUpperCase();
  const estadoCuota = !c ? '—' : c.estado === 'PAGADA' ? 'Al día' : c.estado === 'IMPAGA' ? 'Impaga' : 'Pendiente';

  return (
    <>
      <Encabezado
        ceja={titulo}
        titulo={`Hola, ${p.usuario.nombre}.`}
        subtitulo="Consultá tu rutina, tus próximos turnos y el estado de tu cuota."
        accion={
          <BotonEnlace a="/socio/turnos" estilo="outline" icono="plus">
            Reservar un turno
          </BotonEnlace>
        }
      />
      <section className="dashboard-hero">
        <img src={hero} alt="Entrenamiento con mancuernas" width={1536} height={1024} />
        <div className="dash-hero-content">
          <div className="eyebrow">ENTRENAMIENTO DE HOY</div>
          <h2>{ejercicios.length ? 'Tu rutina está lista.' : 'Armemos tu rutina.'}</h2>
          <p>{ejercicios.length ? `${p.preferencia?.objetivo ?? 'Tu objetivo'} · ${deHoy.length} ejercicios · ${conSede(p.sede.nombre)}.` : 'Elegí tu objetivo y generá tu primera rutina personalizada.'}</p>
          <BotonEnlace a={ejercicios.length ? '/socio/rutina' : '/socio/bienvenida'} estilo="mint" icono="arrow">
            {ejercicios.length ? 'Ver mi entrenamiento' : 'Personalizar mi rutina'}
          </BotonEnlace>
        </div>
        <div className="hero-bottom-tag">
          <Icono n="sparkles" />
          Mi entrenamiento
        </div>
      </section>

      <section className="kpi-grid" aria-label="Tu actividad">
        <Kpi etiqueta="Asistencias este mes" valor={asistenciasMes} unidad="sesiones" pie="Asistencias registradas" icono="calendar" />
        <Kpi etiqueta="Objetivo semanal" valor={objetivoSemanal} unidad="días" pie={`${diasConAsistencia.size} de ${objetivoSemanal} entrenamientos`} icono="target" />
        <Kpi etiqueta="Mis puntos" valor={saldo} unidad="pts" pie="Cada asistencia suma" icono="gift" />
        <Kpi etiqueta="Mi cuota" valor={estadoCuota} pie={c ? (c.estado === 'PAGADA' ? 'Comprobante disponible' : `Vence el ${fechaLarga(c.fechaVencimiento, false)}`) : undefined} icono="wallet" />
      </section>

      <div className="dashboard-grid">
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Actividad de la semana" subtitulo="Asistencias y entrenamientos planificados." accion={<Insignia color="neutral">Esta semana</Insignia>} />
            <div className="spread">
              <div>
                <div className="kpi-value" style={{ fontSize: 27 }}>
                  {diasConAsistencia.size} <small>entrenamientos</small>
                </div>
                <p className="week-stat">Objetivo: {objetivoSemanal} entrenamientos</p>
              </div>
              <span className="badge">Cada asistencia suma puntos</span>
            </div>
            <div className="chart" aria-label="Días con asistencia confirmada de esta semana">
              {semana.map((d, i) => {
                const asistio = diasConAsistencia.has(d);
                const reservado = diasReservados.has(d);
                return (
                  <div key={d} className="chart-column">
                    <div className={`chart-bar ${asistio ? 'highlight' : ''}`.trim()} style={{ ['--h' as string]: asistio ? '100%' : reservado ? '45%' : '5%' }} />
                    <small>{DIAS[i]}</small>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <span>
                <i />
                Asistencia registrada
              </span>
              <span>
                <i className="pale" />
                Reserva pendiente de ingreso
              </span>
            </div>
          </section>

          <section className="card">
            <CabeceraTarjeta
              titulo="Tu entrenamiento de hoy"
              subtitulo={ejercicios.length ? `${p.preferencia?.objetivo ?? ''} · ${deHoy.length} ejercicios` : 'Todavía no generaste tu rutina.'}
              accion={<EnlaceTexto a="/socio/rutina">Ver rutina</EnlaceTexto>}
            />
            {deHoy.slice(0, 3).map((e) => (
              <div key={e.id} className="routine-mini">
                <div className="exercise-icon">
                  <Icono n={iconoEjercicio(e.grupoMuscular)} />
                </div>
                <div>
                  <h4>{e.nombre}</h4>
                  <p>
                    {e.series} series · {e.repeticiones} repeticiones
                  </p>
                </div>
                <Insignia color="neutral">{e.pesoKg !== null ? `${e.pesoKg} kg` : 'Peso libre'}</Insignia>
              </div>
            ))}
            {!ejercicios.length && <Vacio titulo="Sin rutina por ahora" descripcion="Generala en tres pasos según tu objetivo." icono="dumbbell" />}
            <div className="routine-card-footer">
              <p>
                <Icono n="clock" /> {Math.max(20, deHoy.length * 11)} min · Descansos incluidos
              </p>
              <BotonEnlace a={ejercicios.length ? '/socio/rutina' : '/socio/bienvenida'} estilo="soft" chico icono="arrow">
                {ejercicios.length ? 'Empezar rutina' : 'Generar rutina'}
              </BotonEnlace>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="points-card">
            <div className="eyebrow">BENEFICIOS POR ASISTENCIA</div>
            <h2 className="points-title">Mis puntos</h2>
            <div className="points-row">
              <div className="points-number">
                {saldo}
                <small>puntos</small>
              </div>
              <div className="points-graphic">
                <Icono n="gift" />
              </div>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progreso}%` }} />
            </div>
            <p>{progreso >= 100 ? 'Ya podés canjear un beneficio. Elegí el tuyo.' : Number.isFinite(costoMinimo) ? `Te faltan ${costoMinimo - saldo} puntos para tu próximo beneficio.` : 'Seguí sumando puntos con cada asistencia.'}</p>
            <BotonEnlace a="/socio/beneficios" estilo="outline" icono="arrow">
              Descubrir mis beneficios
            </BotonEnlace>
          </section>

          <section className="card">
            <CabeceraTarjeta titulo="Tu próximo turno" subtitulo={proxima ? 'Reserva confirmada.' : 'Sin reservas próximas.'} />
            {proxima ? (
              <>
                <div className="appointment">
                  <div className="date-square">
                    <small>{new Date(`${proxima.turno.fecha}T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase()}</small>
                    <strong>{Number(proxima.turno.fecha.slice(8, 10))}</strong>
                  </div>
                  <div>
                    <h4>{proxima.turno.actividad}</h4>
                    <p>
                      {new Date(`${proxima.turno.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '')} · {proxima.turno.horaInicio} a{' '}
                      {proxima.turno.horaFin}
                    </p>
                    <p>{conSede(proxima.turno.sede)}</p>
                  </div>
                </div>
                <div className="booking-foot">
                  <Insignia>Confirmado</Insignia>
                  <EnlaceTexto a="/socio/turnos">Mis turnos</EnlaceTexto>
                </div>
              </>
            ) : (
              <Vacio titulo="No tenés turnos reservados" descripcion="Elegí un horario disponible en tu sede." icono="calendar" accion={<BotonEnlace a="/socio/turnos" chico icono="plus">Reservar</BotonEnlace>} />
            )}
          </section>

          {sinEquipo && (
            <aside className="soft-alert">
              <Icono n="tool" />
              <div>
                <h4>Hay una variante para tu rutina</h4>
                <p>{sinEquipo.equipos.find((q) => q.estado !== 'OPERATIVO')?.nombre ?? 'Un equipo'} no está disponible. Podés elegir una alternativa y mantener tu turno.</p>
                <Link to="/socio/rutina">Ver sugerencia de ejercicio</Link>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
