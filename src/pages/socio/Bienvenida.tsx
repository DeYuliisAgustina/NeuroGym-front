import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, ErrorFormulario, FilaDato } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion } from '../../hooks/useApi';
import { api } from '../../services/api';
import { ArteAcceso } from '../publico/Ingreso';

const OBJETIVOS: [string, string, string][] = [
  ['Fuerza y bienestar', 'Sentite más fuerte', 'dumbbell'],
  ['Resistencia', 'Seguí tu ritmo', 'activity'],
  ['Hipertrofia', 'Construí tu progreso', 'trend'],
  ['Movilidad', 'Movete mejor', 'heart'],
];

/** Bienvenida en tres pasos: las preferencias generan la primera rutina (CU-003). */
export function Bienvenida() {
  const navegar = useNavigate();
  const mostrar = useToast();
  const [paso, setPaso] = useState(1);
  const [objetivo, setObjetivo] = useState(OBJETIVOS[0][0]);
  const [nivel, setNivel] = useState('Principiante');
  const [dias, setDias] = useState('3');
  const [sede, setSede] = useState('');
  const accion = useAccion();

  useEffect(() => {
    api
      .get<{ sede: { nombre: string }; preferencia: { objetivo: string; nivel: string; diasPorSemana: number } | null }>('/socio/perfil')
      .then((p) => {
        setSede(p.sede.nombre);
        if (p.preferencia) {
          setObjetivo(p.preferencia.objetivo);
          setNivel(p.preferencia.nivel);
          setDias(String(p.preferencia.diasPorSemana));
        }
      })
      .catch(() => undefined);
  }, []);

  const generar = async () => {
    const r = await accion.ejecutar(() => api.post('/socio/rutina', { objetivo, nivel, diasPorSemana: Number(dias) }));
    if (r) {
      mostrar('Tu rutina está lista. Podés editar cada ejercicio.');
      navegar('/socio/rutina');
    }
  };

  return (
    <div className="auth-page">
      <ArteAcceso bajada="Una experiencia que empieza con vos.">
        A tu ritmo.
        <br />
        Con tus objetivos.
      </ArteAcceso>
      <main className="auth-form-wrap" id="main">
        <div className="auth-form">
          <Link to="/socio" className="auth-back">
            <Icono n="back" />
            Volver a mi espacio
          </Link>
          <div className="onboarding-progress">
            {[1, 2, 3].map((n) => (
              <span key={n} className={paso >= n ? 'active' : ''} />
            ))}
          </div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            PASO {paso} DE 3
          </div>
          <h1>{paso === 1 ? '¿Cuál es tu objetivo?' : paso === 2 ? 'Organizá tus entrenamientos.' : 'Revisá tus preferencias.'}</h1>
          <p>
            {paso === 1
              ? 'Elegí un objetivo para personalizar tu experiencia.'
              : paso === 2
                ? 'Contanos cómo querés organizar tu entrenamiento.'
                : 'Estas preferencias serán la base de tu rutina. Podés cambiarlas cuando quieras.'}
          </p>
          {paso === 1 && (
            <>
              <div className="onboarding-options">
                {OBJETIVOS.map(([o, d, i]) => (
                  <button key={o} type="button" className={`option-card ${objetivo === o ? 'active' : ''}`.trim()} aria-pressed={objetivo === o} onClick={() => setObjetivo(o)}>
                    <Icono n={i} />
                    <h3>{o}</h3>
                    <p>{d}</p>
                  </button>
                ))}
              </div>
              <Boton completo icono="arrow" onClick={() => setPaso(2)}>
                Continuar
              </Boton>
            </>
          )}
          {paso === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPaso(3);
              }}
            >
              <label>
                Tu experiencia
                <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
                  {['Principiante', 'Intermedio', 'Avanzado'].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Días por semana
                <select value={dias} onChange={(e) => setDias(e.target.value)}>
                  {['2', '3', '4', '5'].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Tu sede
                <select value="sede" disabled>
                  <option value="sede">{sede || '…'}</option>
                </select>
              </label>
              <div className="form-actions">
                <Boton estilo="outline" onClick={() => setPaso(1)}>
                  Volver
                </Boton>
                <button className="btn primary" type="submit">
                  Continuar
                  <Icono n="arrow" />
                </button>
              </div>
            </form>
          )}
          {paso === 3 && (
            <>
              <div className="card" style={{ marginBottom: 25 }}>
                <FilaDato etiqueta="Objetivo">{objetivo}</FilaDato>
                <FilaDato etiqueta="Nivel">{nivel}</FilaDato>
                <FilaDato etiqueta="Frecuencia">{dias} días por semana</FilaDato>
                <FilaDato etiqueta="Sede">{sede}</FilaDato>
              </div>
              <ErrorFormulario>{accion.error}</ErrorFormulario>
              <Boton completo icono="sparkles" cargando={accion.enviando} onClick={generar}>
                Generar mi primera rutina
              </Boton>
              <button type="button" className="text-link" style={{ marginTop: 14 }} onClick={() => setPaso(2)}>
                Volver
              </button>
            </>
          )}
          <p className="auth-note">
            La personalización usa tus preferencias de entrenamiento.
            <br />
            No se solicitan datos biométricos.
          </p>
        </div>
      </main>
    </div>
  );
}
