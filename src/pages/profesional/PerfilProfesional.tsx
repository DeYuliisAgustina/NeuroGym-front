import { useEffect, useState, type FormEvent } from 'react';
import { CambioPassword } from '../../components/CambioPassword';
import { AyudaNombre, errorNombreCompleto } from '../../components/AyudaNombre';
import { Icono } from '../../components/Icono';
import { Avatar, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, inicialesDe } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero, etiqueta } from '../../utils/formato';
import { profesionDe, type PerfilProfesionalDatos } from './Agenda';

/** Perfil profesional (RF29, Figura 54): datos visibles para los socios Premium. */
export function PerfilProfesional() {
  const toast = useToast();
  const perfil = useApi(() => api.get<PerfilProfesionalDatos>('/profesional/perfil'));
  const p = perfil.datos;
  const [f, setF] = useState({ nombre: '', apellido: '' });
  const accion = useAccion();
  useEffect(() => {
    if (p) setF({ nombre: p.usuario.nombre, apellido: p.usuario.apellido });
  }, [p]);
  if (perfil.cargando || !p) return <Cargando />;
  const nombre = `${p.usuario.nombre} ${p.usuario.apellido}`;
  const servicio = p.servicios.find((s) => s.visible) ?? p.servicios[0];

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (errorNombreCompleto(f.nombre, f.apellido)) return accion.setError(errorNombreCompleto(f.nombre, f.apellido)!);
    if (await accion.ejecutar(() => api.put('/profesional/perfil', f))) {
      toast('Perfil guardado.');
      void perfil.recargar();
    }
  };

  return (
    <>
      <Encabezado ceja="MI PERFIL" titulo="Perfil profesional" subtitulo="Estos datos se muestran en la lista de profesionales." />
      <div className="two-col">
        <div className="stack">
          <section className="card">
            <div className="profile-identity">
              <Avatar iniciales={inicialesDe(nombre)} color="peach" grande />
              <div>
                <h2>{nombre}</h2>
                <p>{profesionDe(p.especialidad)} independiente · Rosario</p>
                <Insignia color={p.plan.perfilPromocionado ? 'lilac' : 'neutral'}>{p.plan.perfilPromocionado ? 'Perfil promocionado' : 'Marketplace Básico'}</Insignia>
              </div>
            </div>
            <form onSubmit={guardar}>
              <ErrorFormulario>{accion.error}</ErrorFormulario>
              <div className="form-grid">
                <label>
                  Nombre
                  <input required maxLength={100} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
                  <AyudaNombre valor={f.nombre} />
                </label>
                <label>
                  Apellido
                  <input required maxLength={100} value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} />
                  <AyudaNombre valor={f.apellido} />
                </label>
                <label className="wide">
                  Correo electrónico
                  <input type="email" value={p.usuario.email} readOnly />
                </label>
                <label className="wide">
                  Profesión
                  <input value={`${profesionDe(p.especialidad)} · ${etiqueta(p.especialidad)}`} readOnly />
                </label>
              </div>
              <p className="page-note">La presentación, la modalidad y el valor se editan en Mis servicios.</p>
              <div className="form-actions">
                <button className="btn primary" type="submit" disabled={accion.enviando}>
                  <Icono n="check" />
                  Guardar perfil
                </button>
              </div>
            </form>
          </section>
          <CambioPassword />
        </div>
        <section className="card" style={{ alignSelf: 'start' }}>
          <CabeceraTarjeta titulo="Vista del socio" subtitulo="Tu servicio en NeuroGym." />
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {servicio?.nombre ?? etiqueta(p.especialidad)}
          </div>
          <h3>{nombre}</h3>
          <p style={{ fontSize: 12, lineHeight: 1.9, margin: '14px 0 20px' }}>{servicio?.descripcion ?? 'Todavía no cargaste la descripción de tu servicio.'}</p>
          <FilaDato etiqueta="Modalidad">{etiqueta(p.modalidadAtencion)}</FilaDato>
          <FilaDato etiqueta="Consulta">{dinero(p.valorConsulta)}</FilaDato>
          <FilaDato etiqueta="Visibilidad">{p.publicacionPausada ? 'Pausada' : servicio?.visible ? 'Visible' : 'Oculta'}</FilaDato>
        </section>
      </div>
    </>
  );
}
