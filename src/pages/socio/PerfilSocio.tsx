import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CambioPassword } from '../../components/CambioPassword';
import { Icono } from '../../components/Icono';
import { ModalPremium, type PreciosPlanes } from '../../components/ModalPremium';
import { Avatar, Boton, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, inicialesDe } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { useInstalacion } from '../../hooks/useInstalacion';
import { api } from '../../services/api';
import { dinero, fechaLarga, conSede } from '../../utils/formato';
import { telefonoValido } from '../../validations/formularios';

interface Perfil {
  telefono: string;
  esPremium: boolean;
  plan: { tipo: 'BASICO' | 'PREMIUM' };
  sede: { nombre: string; gimnasio: { razonSocial: string } };
  bonificacionVigente: { hasta: string } | null;
  preferencia: { objetivo: string; nivel: string; diasPorSemana: number } | null;
  usuario: { nombre: string; apellido: string; email: string };
  preciosPlanes: PreciosPlanes;
}

const conDebito = (n: number) => Math.round(n * 0.9 * 100) / 100;

/** Mi perfil del socio: datos de contacto, preferencias, plan (RF12), débito y contraseña. */
export function PerfilSocio() {
  const navegar = useNavigate();
  const toast = useToast();
  const perfil = useApi(() => api.get<Perfil>('/socio/perfil'));
  const cuota = useApi(() => api.get<{ adhesion: unknown }>('/socio/cuota'));
  const [telefono, setTelefono] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);
  const { disponible, instalada, instalar } = useInstalacion();
  const accion = useAccion();
  if (perfil.cargando) return <Cargando />;
  if (perfil.error) return <ErrorFormulario>{perfil.error}</ErrorFormulario>;
  const p = perfil.datos!;
  const tel = telefono ?? p.telefono;
  const nombre = `${p.usuario.nombre} ${p.usuario.apellido}`;
  const premiumContratado = p.plan.tipo === 'PREMIUM';
  const precio = p.preciosPlanes.cuotaBase + (premiumContratado ? p.preciosPlanes.adicionalPremium : 0);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!telefonoValido(tel)) return accion.setError('Revisá el teléfono: solo números, espacios, + o guiones.');
    if (await accion.ejecutar(() => api.put('/socio/perfil', { telefono: tel }))) {
      toast('Tus datos se guardaron.');
      void perfil.recargar();
    }
  };
  const instalarApp = async () => {
    const r = await instalar();
    toast(r === 'instalada' ? 'NeuroGym quedó instalada en tu dispositivo.' : 'Abrí el menú del navegador y elegí "Instalar aplicación" o "Agregar a la pantalla de inicio".');
  };

  return (
    <>
      <Encabezado ceja="MI CUENTA" titulo="Mi perfil" subtitulo="Gestioná tus preferencias, tu plan y tu acceso." />
      <div className="two-col">
        <div className="stack">
          <section className="card">
            <div className="profile-identity">
              <Avatar iniciales={inicialesDe(nombre)} color="mint" grande />
              <div>
                <h2>{nombre}</h2>
                <p>
                  Socio · {p.sede.gimnasio.razonSocial} · {conSede(p.sede.nombre)}
                </p>
                <Insignia color={p.esPremium ? 'lilac' : ''}>Plan {p.esPremium ? 'Premium' : 'Básico'}</Insignia>
              </div>
            </div>
            <form onSubmit={guardar}>
              <ErrorFormulario>{accion.error}</ErrorFormulario>
              <div className="form-grid">
                <label>
                  Nombre y apellido
                  <input value={nombre} readOnly autoComplete="name" />
                </label>
                <label>
                  Correo electrónico
                  <input type="email" value={p.usuario.email} readOnly autoComplete="email" />
                </label>
                <label>
                  Teléfono para notificaciones
                  <input type="tel" value={tel} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" required />
                </label>
                <label>
                  Sede habitual
                  <select value="sede" disabled>
                    <option value="sede">{p.sede.nombre}</option>
                  </select>
                </label>
                <label>
                  Objetivo de entrenamiento
                  <select value="o" disabled>
                    <option value="o">{p.preferencia?.objetivo ?? 'Sin definir'}</option>
                  </select>
                </label>
                <label>
                  Experiencia
                  <select value="n" disabled>
                    <option value="n">{p.preferencia?.nivel ?? 'Sin definir'}</option>
                  </select>
                </label>
              </div>
              <p className="page-note">El nombre, el correo y la sede los actualiza la recepción del gimnasio. El objetivo y la experiencia se cambian al generar una nueva rutina.</p>
              <div className="form-actions">
                <Boton estilo="outline" icono="sparkles" onClick={() => navegar('/socio/bienvenida')}>
                  Cambiar preferencias
                </Boton>
                <button className="btn primary" type="submit" disabled={accion.enviando}>
                  <Icono n="check" />
                  Guardar cambios
                </button>
              </div>
            </form>
            <div className="privacy-note">
              <Icono n="shield" />
              Tus preferencias ayudan a personalizar tu entrenamiento. No se solicitan datos biométricos.
            </div>
          </section>
          <CambioPassword />
        </div>
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Tu plan" subtitulo="Precios mensuales y gestión del acceso." />
            <div className="spread">
              <h3>Plan {premiumContratado ? 'Premium' : 'Básico'}</h3>
              <Insignia color={premiumContratado ? 'lilac' : ''}>{premiumContratado ? 'Marketplace incluido' : 'Incluido en tu cuota'}</Insignia>
            </div>
            <FilaDato etiqueta="Precio mensual">{dinero(precio)}</FilaDato>
            <div className="info-row discount-row">
              <span>Con débito automático</span>
              <strong>{dinero(conDebito(precio))}</strong>
            </div>
            {p.bonificacionVigente && !premiumContratado && <FilaDato etiqueta="Premium bonificado">Hasta el {fechaLarga(p.bonificacionVigente.hasta, false)}</FilaDato>}
            <p className="modal-text" style={{ margin: '14px 0 18px' }}>
              {premiumContratado ? 'Tenés acceso al marketplace de profesionales. Podés volver al Básico cuando quieras.' : 'Ya tenés turnos, rutinas, pagos y beneficios. Podés sumar el marketplace de profesionales con Premium.'}
            </p>
            <Boton estilo="outline" completo chico icono="sparkles" onClick={() => setPremium(true)}>
              {premiumContratado ? 'Gestionar Premium' : 'Conocer Premium'}
            </Boton>
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Tus preferencias" subtitulo="La información que te importa." />
            <div className="preference-row">
              <div>
                <h4>Débito automático</h4>
                <p>Adhesión voluntaria · 10% de descuento</p>
              </div>
              <button className={`toggle ${cuota.datos?.adhesion ? 'on' : ''}`.trim()} type="button" aria-label="Gestionar débito automático" aria-pressed={!!cuota.datos?.adhesion} onClick={() => navegar('/socio/pagos')}>
                <span />
              </button>
            </div>
            <div className="preference-row">
              <div>
                <h4>Avisos por WhatsApp</h4>
                <p>Comprobantes y consultas al {p.telefono}</p>
              </div>
              <Insignia color="neutral">Activo</Insignia>
            </div>
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Acceso desde el celular" subtitulo="Accedé desde tu pantalla de inicio." />
            <p className="modal-text" style={{ marginBottom: 17 }}>
              Usá la aplicación desde tu navegador o instalala en tu dispositivo para tenerla siempre a mano.
            </p>
            <Boton estilo="outline" completo chico icono="phone" disabled={instalada} onClick={instalarApp}>
              {instalada ? 'Ya está instalada' : disponible ? 'Instalar NeuroGym' : 'Cómo instalar NeuroGym'}
            </Boton>
          </section>
        </div>
      </div>
      <ModalPremium abierto={premium} onCerrar={() => setPremium(false)} precios={p.preciosPlanes} esPremium={premiumContratado} onCambio={() => void perfil.recargar()} />
    </>
  );
}
