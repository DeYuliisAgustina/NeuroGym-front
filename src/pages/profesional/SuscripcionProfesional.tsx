import { useState } from 'react';
import { Icono } from '../../components/Icono';
import { Boton, CabeceraTarjeta, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { dinero, fechaCorta } from '../../utils/formato';
import type { PerfilProfesionalDatos } from './Agenda';

interface PlanMarketplace {
  id: number;
  tipo: 'BASICO' | 'PROFESIONAL';
  precioMensualUsd: string;
  porcentajeComision: string;
  perfilPromocionado: boolean;
}
interface Comisiones {
  total: number;
  comisiones: { id: number; importeDeclarado: string; importeComision: string; porcentaje?: string; exenta: boolean; turno: { fecha: string } }[];
}

/** Mi plan Marketplace (RF28, Figura 54 b): plan, pausa de la publicación, comisiones y promociones. */
export function SuscripcionProfesional() {
  const toast = useToast();
  const perfil = useApi(() => api.get<PerfilProfesionalDatos>('/profesional/perfil'));
  const planes = useApi(() => api.get<PlanMarketplace[]>('/publico/planes-marketplace'));
  const comisiones = useApi(() => api.get<Comisiones>('/profesional/comisiones'));
  const [copiado, setCopiado] = useState(false);
  const accion = useAccion();
  const p = perfil.datos;
  if (perfil.cargando || !p) return <Cargando />;
  const actual = planes.datos?.find((x) => x.tipo === p.plan.tipo);

  const cambiarPlan = async (tipo: PlanMarketplace['tipo']) => {
    if (await accion.ejecutar(() => api.put('/profesional/plan', { plan: tipo }))) {
      toast(`Plan Marketplace ${tipo === 'BASICO' ? 'Básico' : 'Profesional'} activo. Rige para las próximas consultas.`);
      void perfil.recargar();
    }
  };
  const pausar = async () => {
    if (await accion.ejecutar(() => api.put('/profesional/perfil', { publicacionPausada: !p.publicacionPausada }))) {
      toast(p.publicacionPausada ? 'Tu perfil vuelve a recibir solicitudes.' : 'Publicación pausada: no recibís nuevas solicitudes.');
      void perfil.recargar();
    }
  };
  const copiar = async () => {
    if (!p.codigoReferido) return;
    await navigator.clipboard?.writeText(p.codigoReferido).catch(() => undefined);
    setCopiado(true);
  };

  return (
    <>
      <Encabezado
        ceja="MI SUSCRIPCIÓN"
        titulo="Mi plan Marketplace"
        subtitulo="Tu publicación, tu visibilidad y tus condiciones comerciales."
        accion={<Insignia color={p.plan.tipo === 'PROFESIONAL' ? 'lilac' : 'neutral'}>Marketplace {p.plan.tipo === 'PROFESIONAL' ? 'Profesional' : 'Básico'}</Insignia>}
      />
      <ErrorFormulario>{accion.error}</ErrorFormulario>
      <div className="two-col">
        <div className="stack">
          <section className="card">
            <CabeceraTarjeta titulo="Elegí el plan para tu actividad" subtitulo="Precios de referencia en USD. Cobro en pesos al tipo de cambio vigente." />
            <div className="marketplace-plan-grid">
              {planes.datos?.map((pl) => {
                const elegido = pl.tipo === p.plan.tipo;
                return (
                  <article key={pl.id} className={`marketplace-plan ${elegido ? 'selected' : ''}`.trim()}>
                    <div className="eyebrow">MARKETPLACE</div>
                    <h2>{pl.tipo === 'BASICO' ? 'Básico' : 'Profesional'}</h2>
                    <div className="plan-number">
                      USD {Number(pl.precioMensualUsd)}
                      <small> / mes</small>
                    </div>
                    <p>+ {Number(pl.porcentajeComision)}% por consulta realizada y pagada.</p>
                    <p>{pl.perfilPromocionado ? 'Perfil promocionado con mayor visibilidad.' : 'Perfil y servicios visibles en el directorio.'}</p>
                    <Boton estilo={elegido ? 'soft' : 'outline'} chico icono="check" disabled={elegido} cargando={accion.enviando && !elegido} onClick={() => cambiarPlan(pl.tipo)}>
                      {elegido ? 'Plan actual' : `Elegir ${pl.tipo === 'BASICO' ? 'Básico' : 'Profesional'}`}
                    </Boton>
                  </article>
                );
              })}
            </div>
            <div className="preference-row">
              <div>
                <h4>Publicación en el marketplace</h4>
                <p>{p.publicacionPausada ? 'Tu perfil está pausado: no recibe nuevas solicitudes.' : 'Al pausarla, tu perfil deja de recibir nuevas solicitudes.'}</p>
              </div>
              <Boton estilo="outline" chico icono="refresh" onClick={pausar}>
                {p.publicacionPausada ? 'Reactivar publicación' : 'Pausar publicación'}
              </Boton>
            </div>
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Comisiones registradas" subtitulo="Solo consultas realizadas y pagadas." />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Consulta</th>
                    <th>Valor</th>
                    <th>Condición</th>
                    <th>Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {comisiones.datos?.comisiones.map((c) => (
                    <tr key={c.id}>
                      <td>{fechaCorta(c.turno.fecha)}</td>
                      <td>{dinero(c.importeDeclarado)}</td>
                      <td>{c.exenta ? 'Profesionales Fundadores' : 'Según plan'}</td>
                      <td>{dinero(c.importeComision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {comisiones.datos?.comisiones.length === 0 && <Vacio titulo="Todavía no hay comisiones" descripcion="Una consulta confirmada o realizada sin pago no genera comisión." icono="receipt" />}
            {!!comisiones.datos?.comisiones.length && <FilaDato etiqueta="Total de comisiones">{dinero(comisiones.datos.total)}</FilaDato>}
          </section>
        </div>
        <div className="stack">
          <section className="intelligence-teaser">
            <div className="eyebrow">TU PLAN ACTUAL</div>
            <h2>USD {actual ? Number(actual.precioMensualUsd) : '—'} / mes</h2>
            <p>Comisión del {Number(p.plan.porcentajeComision)}%. Los cambios de plan se aplican a las próximas consultas; el historial conserva la condición registrada.</p>
            <Insignia color="neutral">{p.publicacionPausada ? 'Publicación pausada' : 'Suscripción activa'}</Insignia>
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Profesionales Fundadores" subtitulo="Primeros 20 profesionales participantes." />
            <p>{p.consultasExentas > 0 ? 'Tu perfil participa del programa.' : 'No tenés consultas sin comisión disponibles.'}</p>
            <FilaDato etiqueta="Consultas sin comisión restantes">{p.consultasExentas} de 5</FilaDato>
            <p className="page-note">La exención se utiliza al registrar una consulta realizada y pagada.</p>
          </section>
          <section className="card">
            <CabeceraTarjeta titulo="Referidos Profesionales" subtitulo="Un mes de suscripción gratuito para ambas partes." />
            <p>Se acredita cuando la persona referida abona su primera mensualidad. Acumulable con Fundadores.</p>
            <FilaDato etiqueta="Tu código de referido">{p.codigoReferido ?? '—'}</FilaDato>
            {p.codigoReferido && (
              <Boton estilo="outline" chico icono="users" onClick={copiar}>
                {copiado ? 'Código copiado' : 'Copiar código'}
              </Boton>
            )}
          </section>
        </div>
      </div>
      <aside className="soft-alert green section-gap">
        <Icono n="wallet" />
        <div>
          <h4>Conceptos separados</h4>
          <p>Las comisiones de consultas y las mensualidades son conceptos distintos. Los importes de las consultas pertenecen a los profesionales.</p>
        </div>
      </aside>
    </>
  );
}
