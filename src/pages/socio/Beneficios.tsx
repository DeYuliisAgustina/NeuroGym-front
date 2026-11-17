import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { Boton, Cargando, Encabezado, ErrorFormulario, FilaDato, Insignia, Modal, Pestanas, Vacio } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { fechaLarga } from '../../utils/formato';

interface Beneficio {
  id: number;
  nombre: string;
  descripcion: string;
  costoPuntos: number;
  vigenciaDias: number;
}
interface Canje {
  id: number;
  fecha: string;
  venceEl: string;
  vigente: boolean;
  puntosUtilizados: number;
  beneficio: Beneficio;
}
interface Resumen {
  saldoPuntos: number;
  diasConstanciaMes: number;
  bonificacionPremium: { hasta: string; porcentaje: string } | null;
  beneficios: Beneficio[];
  canjes: Canje[];
}

const ARTE: [string, string][] = [
  ['peach', 'users'],
  ['lilac', 'sparkles'],
  ['mint', 'leaf'],
];
const codigoCupon = (c: Canje) => `NG-${String(c.id).padStart(5, '0')}-${c.beneficio.id}`;

/** Mis beneficios (RF11, Figura 49): puntos por constancia (RD9), canjes y cupones. */
export function Beneficios() {
  const toast = useToast();
  const [vista, setVista] = useState<'disponibles' | 'canjes'>('disponibles');
  const resumen = useApi(() => api.get<Resumen>('/socio/beneficios'));
  const [elegido, setElegido] = useState<Beneficio | null>(null);
  const [cupon, setCupon] = useState<Canje | null>(null);
  const accion = useAccion();
  if (resumen.cargando) return <Cargando />;
  if (resumen.error) return <ErrorFormulario>{resumen.error}</ErrorFormulario>;
  const r = resumen.datos!;

  const canjear = async () => {
    if (!elegido) return;
    if (await accion.ejecutar(() => api.post(`/socio/beneficios/${elegido.id}/canje`))) {
      toast(`Canjeaste "${elegido.nombre}". Tu cupón está en Mis canjes.`);
      setElegido(null);
      setVista('canjes');
      void resumen.recargar();
    }
  };

  return (
    <>
      <Encabezado ceja="MIS BENEFICIOS" titulo="Beneficios y canjes" subtitulo="Beneficios para acompañar tus hábitos, estés en Básico o en Premium." accion={<Insignia>Disponible para todos</Insignia>} />
      <section className="points-hero">
        <div>
          <div className="eyebrow">PUNTOS DISPONIBLES</div>
          <h2>Canjeá tus puntos.</h2>
          <p>Tus asistencias registradas se convierten en puntos.</p>
        </div>
        <div className="flex" style={{ gap: 26 }}>
          <div>
            <div className="points-number">
              {r.saldoPuntos}
              <small>puntos</small>
            </div>
            <p style={{ fontSize: 10, margin: '2px 0 0' }}>{r.diasConstanciaMes} asistencias este mes</p>
          </div>
          <div className="points-graphic">
            <Icono n="gift" />
          </div>
        </div>
      </section>
      <div className="toolbar">
        <Pestanas
          valor={vista}
          onCambiar={setVista}
          opciones={[
            { valor: 'disponibles', texto: 'Beneficios disponibles' },
            { valor: 'canjes', texto: `Mis canjes ${r.canjes.length ? `(${r.canjes.length})` : ''}`.trim() },
          ]}
        />
        {r.bonificacionPremium && <span className="muted" style={{ fontSize: 10 }}>Premium bonificado hasta el {fechaLarga(r.bonificacionPremium.hasta, false)}</span>}
      </div>
      {vista === 'canjes' ? (
        <section className="card">
          {r.canjes.map((c) => (
            <div key={c.id} className="history-item">
              <div className="exercise-icon">
                <Icono n="gift" />
              </div>
              <div>
                <h3>{c.beneficio.nombre}</h3>
                <p>
                  Canje del {fechaLarga(c.fecha)} · {c.puntosUtilizados} puntos {c.vigente ? '' : '· vencido'}
                </p>
              </div>
              <Boton estilo="soft" chico icono="receipt" onClick={() => setCupon(c)}>
                Ver cupón
              </Boton>
            </div>
          ))}
          {r.canjes.length === 0 && (
            <Vacio
              titulo="Tus próximos premios, acá"
              descripcion="Canjeá un beneficio y encontrá el cupón en este espacio."
              icono="gift"
              accion={
                <Boton estilo="soft" chico onClick={() => setVista('disponibles')}>
                  Ver beneficios
                </Boton>
              }
            />
          )}
        </section>
      ) : (
        <div className="three-col">
          {r.beneficios.map((b, i) => {
            const [color, icono] = ARTE[i % ARTE.length];
            return (
              <article key={b.id} className="benefit-card">
                <div className={`benefit-art ${color}`}>
                  <Icono n={icono} />
                </div>
                <div className="benefit-content">
                  <div className="eyebrow">Vigencia {b.vigenciaDias} días</div>
                  <h3>{b.nombre}</h3>
                  <p>{b.descripcion}</p>
                  <div className="benefit-bottom">
                    <strong>{b.costoPuntos} puntos</strong>
                    <Boton
                      estilo="outline"
                      chico
                      icono="arrow"
                      onClick={() => {
                        accion.limpiar();
                        setElegido(b);
                      }}
                    >
                      Canjear
                    </Boton>
                  </div>
                </div>
              </article>
            );
          })}
          {r.beneficios.length === 0 && <Vacio titulo="Sin beneficios publicados" descripcion="Tu gimnasio todavía no cargó beneficios." icono="gift" />}
        </div>
      )}
      <aside className="soft-alert green section-gap">
        <Icono n="heart" />
        <div>
          <h4>Volver también es parte del camino</h4>
          <p>Si tu frecuencia baja o pausás el entrenamiento, el gimnasio puede ofrecerte un incentivo para regresar. Se contempla para todos los planes.</p>
          <Link to="/socio/turnos">Encontrar mi próximo turno</Link>
        </div>
      </aside>

      <Modal
        titulo="Canjear beneficio"
        subtitulo="Revisá tu beneficio antes de canjearlo."
        abierto={!!elegido}
        onCerrar={() => setElegido(null)}
        pie={
          <>
            <Boton estilo="outline" onClick={() => setElegido(null)}>
              Volver
            </Boton>
            <Boton icono="gift" cargando={accion.enviando} disabled={!!elegido && r.saldoPuntos < elegido.costoPuntos} onClick={canjear}>
              Confirmar canje
            </Boton>
          </>
        }
      >
        {elegido && (
          <>
            <div className="modal-hero-icon">
              <Icono n="gift" />
            </div>
            <h3>{elegido.nombre}</h3>
            <p className="modal-text" style={{ marginTop: 14 }}>
              {elegido.descripcion}
            </p>
            <FilaDato etiqueta="Costo del canje">{elegido.costoPuntos} puntos</FilaDato>
            <FilaDato etiqueta="Tus puntos disponibles">{r.saldoPuntos} puntos</FilaDato>
            <FilaDato etiqueta="Saldo después del canje">{r.saldoPuntos - elegido.costoPuntos} puntos</FilaDato>
            <p className="page-note">
              {r.saldoPuntos < elegido.costoPuntos ? `Te faltan ${elegido.costoPuntos - r.saldoPuntos} puntos para este beneficio.` : `El cupón vale ${elegido.vigenciaDias} días desde el canje.`}
            </p>
            <ErrorFormulario>{accion.error}</ErrorFormulario>
          </>
        )}
      </Modal>
      <Modal titulo="Mi cupón" subtitulo="Tu beneficio ya está canjeado." abierto={!!cupon} onCerrar={() => setCupon(null)} pie={<Boton onClick={() => setCupon(null)}>Listo</Boton>}>
        {cupon && (
          <>
            <div className="modal-hero-icon">
              <Icono n="gift" />
            </div>
            <h3 style={{ fontSize: 19 }}>{cupon.beneficio.nombre}</h3>
            <p className="modal-text" style={{ marginTop: 12 }}>
              {cupon.beneficio.descripcion}
            </p>
            <div className="coupon">
              <strong>{codigoCupon(cupon)}</strong>
              <p>Presentá este código en la recepción de tu sede</p>
            </div>
            <FilaDato etiqueta="Canje">{cupon.puntosUtilizados} puntos</FilaDato>
            <FilaDato etiqueta="Vigencia">{cupon.vigente ? `Hasta el ${fechaLarga(cupon.venceEl)}` : `Venció el ${fechaLarga(cupon.venceEl)}`}</FilaDato>
          </>
        )}
      </Modal>
    </>
  );
}
