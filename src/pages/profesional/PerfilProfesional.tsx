import { useState } from 'react';
import { CambioPassword } from '../../components/CambioPassword';
import { AreaTexto, Aviso, Boton, Campo, Cargando, EncabezadoPagina, Selector } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { MetodoPago } from '../../types';
import { etiqueta } from '../../utils/formato';

interface Perfil {
  especialidad: string;
  modalidadAtencion: string;
  valorConsulta: string;
  publicacionPausada: boolean;
  codigoReferido: string | null;
  consultasExentas: number;
  usuario: { nombre: string; apellido: string; email: string };
  plan: { tipo: 'BASICO' | 'PROFESIONAL'; porcentajeComision: string; perfilPromocionado: boolean };
  servicios: { id: number; nombre: string; descripcion: string; visible: boolean }[];
  disponibilidad: { id: number; diaSemana: string; horaInicio: string; horaFin: string; duracionConsultaMin: number }[];
  metodosPago: MetodoPago[];
}

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

/** Perfil profesional (RF29, RF36): servicios, valor, disponibilidad, métodos de pago, plan y pausa. */
export function PerfilProfesional() {
  const perfil = useApi(() => api.get<Perfil>('/profesional/perfil'));
  const accion = useAccion();
  const [servicio, setServicio] = useState({ nombre: '', descripcion: '' });
  const [bloque, setBloque] = useState({ diaSemana: 'LUNES', horaInicio: '09:00', horaFin: '13:00', duracionConsultaMin: 45 });
  const [metodo, setMetodo] = useState({ tipo: 'PARTICULAR', obraSocial: '' });
  const [datos, setDatos] = useState<{ valorConsulta: string; modalidadAtencion: string } | null>(null);

  if (perfil.cargando) return <Cargando />;
  if (perfil.error) return <Aviso tipo="error">{perfil.error}</Aviso>;
  const p = perfil.datos!;
  const d = datos ?? { valorConsulta: p.valorConsulta, modalidadAtencion: p.modalidadAtencion };
  const hacer = async (fn: () => Promise<unknown>, mensaje: string) => {
    if (await accion.ejecutar(fn, mensaje)) void perfil.recargar();
  };

  return (
    <div>
      <EncabezadoPagina titulo={`${p.usuario.nombre} ${p.usuario.apellido}`} descripcion={`${etiqueta(p.especialidad)} · ${p.usuario.email}`} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-2">
        <div className="tarjeta">
          <h2>Perfil</h2>
          <Campo etiqueta="Valor de la consulta (ARS)" type="number" min={0} value={d.valorConsulta} onChange={(e) => setDatos({ ...d, valorConsulta: e.target.value })} />
          <Selector
            etiqueta="Modalidad de atención"
            value={d.modalidadAtencion}
            onChange={(e) => setDatos({ ...d, modalidadAtencion: e.target.value })}
            opciones={['ONLINE', 'PRESENCIAL', 'ONLINE_Y_PRESENCIAL'].map((m) => ({ valor: m, texto: etiqueta(m) }))}
          />
          <div className="fila">
            <Boton onClick={() => hacer(() => api.put('/profesional/perfil', { valorConsulta: Number(d.valorConsulta), modalidadAtencion: d.modalidadAtencion }), 'Perfil guardado.')}>Guardar perfil</Boton>
            <Boton variante="secundario" onClick={() => hacer(() => api.put('/profesional/perfil', { publicacionPausada: !p.publicacionPausada }), p.publicacionPausada ? 'Publicación reactivada.' : 'Publicación pausada.')}>
              {p.publicacionPausada ? 'Reactivar publicación' : 'Pausar publicación'}
            </Boton>
          </div>
          {p.publicacionPausada && <Aviso tipo="alerta">Tu perfil no recibe nuevas solicitudes.</Aviso>}
        </div>
        <div className="tarjeta">
          <h2>Plan Marketplace</h2>
          <p>
            <strong>{p.plan.tipo === 'BASICO' ? 'Marketplace Básico' : 'Marketplace Profesional'}</strong> · comisión {Number(p.plan.porcentajeComision)} %
            {p.plan.perfilPromocionado ? ' · perfil promocionado' : ''}
          </p>
          {p.consultasExentas > 0 && <p className="etiqueta etiqueta-violeta">Profesionales Fundadores: {p.consultasExentas} consultas sin comisión</p>}
          {p.codigoReferido && <p>Tu código de referido: <strong>{p.codigoReferido}</strong></p>}
          <Boton variante="secundario" onClick={() => hacer(() => api.put('/profesional/plan', { plan: p.plan.tipo === 'BASICO' ? 'PROFESIONAL' : 'BASICO' }), 'Plan actualizado.')}>
            Cambiar a {p.plan.tipo === 'BASICO' ? 'Marketplace Profesional' : 'Marketplace Básico'}
          </Boton>
        </div>
      </div>

      <div className="tarjeta" style={{ marginTop: '1rem' }}>
        <h2>Servicios</h2>
        {p.servicios.map((s) => (
          <div key={s.id} className="fila-entre" style={{ borderBottom: '1px solid var(--borde)', padding: '0.5rem 0' }}>
            <div>
              <strong>{s.nombre}</strong> {!s.visible && <span className="etiqueta">Oculto</span>}
              <div className="tenue">{s.descripcion}</div>
            </div>
            <div className="fila">
              <Boton variante="texto" chico onClick={() => hacer(() => api.put(`/profesional/servicios/${s.id}`, { visible: !s.visible }), 'Servicio actualizado.')}>
                {s.visible ? 'Ocultar' : 'Mostrar'}
              </Boton>
              <Boton variante="texto" chico onClick={() => hacer(() => api.delete(`/profesional/servicios/${s.id}`), 'Servicio eliminado.')}>
                Eliminar
              </Boton>
            </div>
          </div>
        ))}
        <div className="grilla-2" style={{ marginTop: '0.8rem' }}>
          <Campo etiqueta="Nuevo servicio" value={servicio.nombre} onChange={(e) => setServicio({ ...servicio, nombre: e.target.value })} />
          <AreaTexto etiqueta="Descripción" rows={2} value={servicio.descripcion} onChange={(e) => setServicio({ ...servicio, descripcion: e.target.value })} />
        </div>
        <Boton
          disabled={!servicio.nombre.trim() || !servicio.descripcion.trim()}
          onClick={() => hacer(async () => { await api.post('/profesional/servicios', servicio); setServicio({ nombre: '', descripcion: '' }); }, 'Servicio guardado.')}
        >
          Guardar servicio
        </Boton>
      </div>

      <div className="grilla-2" style={{ marginTop: '1rem' }}>
        <div className="tarjeta">
          <h2>Disponibilidad semanal</h2>
          {p.disponibilidad.map((b) => (
            <div key={b.id} className="fila-entre">
              <span>
                {b.diaSemana.charAt(0) + b.diaSemana.slice(1).toLowerCase()} · {b.horaInicio} a {b.horaFin} · {b.duracionConsultaMin} min
              </span>
              <Boton variante="texto" chico onClick={() => hacer(() => api.delete(`/profesional/disponibilidad/${b.id}`), 'Bloque eliminado.')}>
                Quitar
              </Boton>
            </div>
          ))}
          <div className="grilla-2" style={{ marginTop: '0.8rem' }}>
            <Selector etiqueta="Día" value={bloque.diaSemana} onChange={(e) => setBloque({ ...bloque, diaSemana: e.target.value })} opciones={DIAS.map((x) => ({ valor: x, texto: x.charAt(0) + x.slice(1).toLowerCase() }))} />
            <Campo etiqueta="Duración (min)" type="number" min={15} max={180} value={bloque.duracionConsultaMin} onChange={(e) => setBloque({ ...bloque, duracionConsultaMin: Number(e.target.value) })} />
            <Campo etiqueta="Desde" type="time" value={bloque.horaInicio} onChange={(e) => setBloque({ ...bloque, horaInicio: e.target.value })} />
            <Campo etiqueta="Hasta" type="time" value={bloque.horaFin} onChange={(e) => setBloque({ ...bloque, horaFin: e.target.value })} />
          </div>
          <Boton onClick={() => hacer(() => api.post('/profesional/disponibilidad', bloque), 'Disponibilidad agregada.')}>Agregar bloque</Boton>
        </div>
        <div className="tarjeta">
          <h2>Métodos de pago habilitados</h2>
          {p.metodosPago.map((m) => (
            <div key={m.id} className="fila-entre">
              <span>
                {etiqueta(m.tipo)}
                {m.obraSocial ? `: ${m.obraSocial}` : ''}
              </span>
              <Boton variante="texto" chico onClick={() => hacer(() => api.delete(`/profesional/metodos-pago/${m.id}`), 'Método eliminado.')}>
                Quitar
              </Boton>
            </div>
          ))}
          <Selector etiqueta="Método" value={metodo.tipo} onChange={(e) => setMetodo({ ...metodo, tipo: e.target.value })} opciones={['OBRA_SOCIAL', 'PARTICULAR', 'ACUERDO_CONSULTA'].map((x) => ({ valor: x, texto: etiqueta(x) }))} />
          {metodo.tipo === 'OBRA_SOCIAL' && <Campo etiqueta="Obra social" value={metodo.obraSocial} onChange={(e) => setMetodo({ ...metodo, obraSocial: e.target.value })} />}
          <Boton onClick={() => hacer(() => api.post('/profesional/metodos-pago', metodo.tipo === 'OBRA_SOCIAL' ? metodo : { tipo: metodo.tipo }), 'Método habilitado.')}>Habilitar método</Boton>
        </div>
      </div>
      <CambioPassword />
    </div>
  );
}
