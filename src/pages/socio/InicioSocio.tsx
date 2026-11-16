import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aviso, Boton, Cargando, Estado, Kpi } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { Cuota, Turno } from '../../types';
import { diaSemanaCorto, dinero } from '../../utils/formato';

interface Perfil {
  id: number;
  saldoPuntos: number;
  esPremium: boolean;
  plan: { tipo: string };
  sede: { nombre: string };
  usuario: { nombre: string };
  preferencia: unknown;
}

const OBJETIVOS = ['Fuerza y bienestar', 'Resistencia', 'Hipertrofia', 'Movilidad'];
const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'];

/** Bienvenida de tres pasos: objetivo, experiencia y días (CU-003-001, sin datos biométricos RD15). */
function Bienvenida({ alTerminar }: { alTerminar: () => void }) {
  const [paso, setPaso] = useState(1);
  const [objetivo, setObjetivo] = useState('');
  const [nivel, setNivel] = useState('');
  const [dias, setDias] = useState(3);
  const accion = useAccion();
  const generar = async () => {
    const ok = await accion.ejecutar(() => api.post('/socio/rutina', { objetivo, nivel, diasPorSemana: dias }));
    if (ok) alTerminar();
  };
  return (
    <div className="tarjeta pila">
      <small>Paso {paso} de 3</small>
      <Aviso tipo="error">{accion.error}</Aviso>
      {paso === 1 && (
        <>
          <h2>¿Cuál es tu objetivo?</h2>
          <div className="grilla-2">
            {OBJETIVOS.map((o) => (
              <button key={o} className={`dia-chip ${objetivo === o ? 'activa' : ''}`} onClick={() => setObjetivo(o)}>
                {o}
              </button>
            ))}
          </div>
          <Boton disabled={!objetivo} onClick={() => setPaso(2)}>
            Continuar
          </Boton>
        </>
      )}
      {paso === 2 && (
        <>
          <h2>¿Cuánta experiencia tenés?</h2>
          <div className="fila">
            {NIVELES.map((n) => (
              <button key={n} className={`dia-chip ${nivel === n ? 'activa' : ''}`} onClick={() => setNivel(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="fila">
            <Boton variante="secundario" onClick={() => setPaso(1)}>
              Volver
            </Boton>
            <Boton disabled={!nivel} onClick={() => setPaso(3)}>
              Continuar
            </Boton>
          </div>
        </>
      )}
      {paso === 3 && (
        <>
          <h2>¿Cuántos días por semana entrenás?</h2>
          <div className="fila">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button key={d} className={`dia-chip ${dias === d ? 'activa' : ''}`} onClick={() => setDias(d)}>
                {d}
              </button>
            ))}
          </div>
          <small>No necesitamos datos de salud ni medidas corporales.</small>
          <div className="fila">
            <Boton variante="secundario" onClick={() => setPaso(2)}>
              Volver
            </Boton>
            <Boton cargando={accion.enviando} onClick={generar}>
              Generar mi primera rutina
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}

/** Inicio del socio: resumen de turnos, cuota, puntos y accesos rápidos. */
export function InicioSocio() {
  const navegar = useNavigate();
  const perfil = useApi(() => api.get<Perfil>('/socio/perfil'));
  const reservas = useApi(() => api.get<{ proximas: { id: number; turno: Turno }[] }>('/socio/reservas'));
  const cuota = useApi(() => api.get<{ cuota: Cuota | null }>('/socio/cuota'));
  if (perfil.cargando) return <Cargando />;
  if (perfil.error || !perfil.datos) return <Aviso tipo="error">{perfil.error}</Aviso>;
  const p = perfil.datos;
  if (!p.preferencia) {
    return (
      <div className="pila">
        <h1>¡Hola, {p.usuario.nombre}!</h1>
        <p className="tenue">Contanos cómo querés entrenar y armamos tu rutina.</p>
        <Bienvenida alTerminar={() => navegar('/socio/rutina')} />
      </div>
    );
  }
  const proxima = reservas.datos?.proximas[0];
  return (
    <div className="pila">
      <div>
        <h1>¡Hola, {p.usuario.nombre}!</h1>
        <p className="tenue">
          {p.sede.nombre} · Plan {p.esPremium ? 'Premium' : 'Básico'}
        </p>
      </div>
      <div className="grilla-3">
        <div className="tarjeta tarjeta-oscura">
          <small>Próximo turno</small>
          {proxima ? (
            <>
              <h3>{proxima.turno.actividad}</h3>
              <div>
                {diaSemanaCorto(proxima.turno.fecha)} · {proxima.turno.horaInicio} h
              </div>
              <Link to="/socio/qr" className="btn btn-acento btn-chico" style={{ marginTop: '0.6rem' }}>
                Mi QR de ingreso
              </Link>
            </>
          ) : (
            <>
              <p>No tenés turnos reservados.</p>
              <Link to="/socio/turnos" className="btn btn-acento btn-chico">
                Reservar
              </Link>
            </>
          )}
        </div>
        <div className="tarjeta">
          <small>Cuota del período</small>
          {cuota.datos?.cuota ? (
            <>
              <div className="kpi importe">{dinero(cuota.datos.cuota.importeFinal)}</div>
              <Estado valor={cuota.datos.cuota.estado} />
              <div>
                <Link to="/socio/cuotas">Ver cuotas y pagos</Link>
              </div>
            </>
          ) : (
            <p className="tenue">Sin cuotas registradas.</p>
          )}
        </div>
        <Kpi titulo="Mis puntos" valor={p.saldoPuntos} detalle="Sumás puntos con cada día de asistencia." />
      </div>
      <div className="grilla-2">
        <Link to="/socio/rutina" className="tarjeta" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Mi rutina →</h3>
          <p className="tenue">Consultá tu rutina, marcá ejercicios y registrá tu entrenamiento.</p>
        </Link>
        <Link to={p.esPremium ? '/socio/profesionales' : '/socio/perfil'} className="tarjeta" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Profesionales →</h3>
          <p className="tenue">{p.esPremium ? 'Consultas con nutricionistas y deportólogos.' : 'Disponible con el Plan Premium.'}</p>
        </Link>
      </div>
    </div>
  );
}
