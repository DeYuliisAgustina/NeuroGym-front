import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/img/logo-neurogym.jpg';
import { etiqueta } from '../utils/formato';
import { Icono } from './Icono';

/**
 * Componentes de interfaz con el mismo marcado y las mismas clases que el
 * prototipo original (btn, badge, page-heading, card-head, empty, kpi, dialog).
 */

export type EstiloBoton = 'primary' | 'mint' | 'outline' | 'soft' | 'danger';

export function Boton({
  estilo = 'primary',
  chico,
  completo,
  icono,
  cargando,
  children,
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { estilo?: EstiloBoton; chico?: boolean; completo?: boolean; icono?: string; cargando?: boolean }) {
  return (
    <button
      type="button"
      className={`btn ${estilo} ${chico ? 'small' : ''} ${completo ? 'full' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      disabled={cargando || resto.disabled}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {icono && <Icono n={icono} />}
      <span>{cargando ? 'Procesando…' : children}</span>
    </button>
  );
}

export function BotonEnlace({ a, estilo = 'primary', icono, chico, children }: { a: string; estilo?: EstiloBoton; icono?: string; chico?: boolean; children: ReactNode }) {
  return (
    <Link className={`btn ${estilo} ${chico ? 'small' : ''}`.trim()} to={a}>
      {icono && <Icono n={icono} />}
      {children}
    </Link>
  );
}

export function EnlaceTexto({ a, children, icono = 'arrow' }: { a: string; children: ReactNode; icono?: string }) {
  return (
    <Link className="text-link" to={a}>
      {children}
      <Icono n={icono} />
    </Link>
  );
}

/** Marca oficial de NeuroGym (logo del prototipo). */
export function Marca({ className = '', a = '/' }: { className?: string; a?: string }) {
  return (
    <Link to={a} className={`brand ${className}`.trim()} aria-label="NeuroGym, inicio">
      <img className="official-logo" src={logo} alt="NeuroGym" width={369} height={253} />
    </Link>
  );
}

export type ColorInsignia = '' | 'neutral' | 'warning' | 'danger' | 'lilac' | 'mint';

export function Insignia({ children, color = '' }: { children: ReactNode; color?: ColorInsignia }) {
  return (
    <span className={`badge ${color}`.trim()}>
      <i className="dot" />
      {children}
    </span>
  );
}

/** Color de la insignia según el estado (misma regla que statusBadge del prototipo). */
export function colorDeEstado(estado: string): ColorInsignia {
  if (['IMPAGA', 'RECHAZADO', 'RECHAZADA', 'FUERA_DE_SERVICIO', 'ALTO', 'DADO_DE_BAJA', 'CANCELADA'].includes(estado)) return 'danger';
  if (['PENDIENTE', 'SERVICE_PROGRAMADO', 'EN_GESTION', 'SOLICITADO', 'MEDIO', 'PROGRAMADO', 'REPROGRAMADO', 'PREPARADA', 'REPORTADA'].includes(estado)) return 'warning';
  if (['CANCELADO', 'COMPLETADO', 'RESUELTA', 'REALIZADO', 'BAJO'].includes(estado)) return 'neutral';
  return '';
}

export function Estado({ valor, texto }: { valor: string; texto?: string }) {
  return <Insignia color={colorDeEstado(valor)}>{texto ?? etiqueta(valor)}</Insignia>;
}

export function Encabezado({ ceja, titulo, subtitulo, accion }: { ceja: string; titulo: string; subtitulo?: string; accion?: ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{ceja}</div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {accion}
    </header>
  );
}

export function CabeceraTarjeta({ titulo, subtitulo, accion }: { titulo: string; subtitulo?: string; accion?: ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h2>{titulo}</h2>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Vacio({ titulo, descripcion, icono = 'calendar', accion }: { titulo: string; descripcion?: string; icono?: string; accion?: ReactNode }) {
  return (
    <div className="empty">
      <Icono n={icono} />
      <h3>{titulo}</h3>
      {descripcion && <p>{descripcion}</p>}
      {accion}
    </div>
  );
}

export function Kpi({ etiqueta: texto, valor, unidad = '', pie, icono = 'calendar' }: { etiqueta: string; valor: ReactNode; unidad?: string; pie?: string; icono?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {texto}
        <Icono n={icono} />
      </div>
      <div className="kpi-value">
        {valor}
        <small>{unidad}</small>
      </div>
      {pie && (
        <div className="kpi-footer">
          <Icono n="trend" />
          {pie}
        </div>
      )}
    </div>
  );
}

export function Avatar({ iniciales, color = '', grande }: { iniciales: string; color?: string; grande?: boolean }) {
  return <span className={`avatar ${color} ${grande ? 'large' : ''}`.trim()}>{iniciales}</span>;
}

export const inicialesDe = (nombre: string) =>
  nombre
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Fila "dato: valor" del prototipo. */
export function FilaDato({ etiqueta: texto, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="info-row">
      <span>{texto}</span>
      <strong>{children}</strong>
    </div>
  );
}

// ---------------- Formularios (label > control, como el prototipo) ----------------

export function Campo({ etiqueta: texto, ayuda, error, ...resto }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; error?: string }) {
  return (
    <label>
      {texto}
      <input aria-invalid={!!error || undefined} {...resto} />
      {ayuda && <small>{ayuda}</small>}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export function Selector({
  etiqueta: texto,
  opciones,
  vacio,
  error,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; opciones: { valor: string | number; texto: string }[]; vacio?: string; error?: string }) {
  return (
    <label>
      {texto}
      <select aria-invalid={!!error || undefined} {...resto}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export function AreaTexto({ etiqueta: texto, error, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string; error?: string }) {
  return (
    <label>
      {texto}
      <textarea aria-invalid={!!error || undefined} {...resto} />
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

/** Error del formulario (clase form-error del prototipo). */
export function ErrorFormulario({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="form-error" role="alert">
      {children}
    </div>
  );
}

/** Leyenda de seguridad bajo una acción de pago (payment-security del prototipo). */
export function Nota({ children, icono = 'shield' }: { children: ReactNode; icono?: string }) {
  return (
    <div className="payment-security">
      <Icono n={icono} />
      {children}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="empty" aria-busy="true">
      <Icono n="refresh" />
      <p>{texto}</p>
    </div>
  );
}

export function Pestanas<T extends string>({ valor, opciones, onCambiar }: { valor: T; opciones: { valor: T; texto: string }[]; onCambiar: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="tab" aria-selected={valor === o.valor} className={`tab ${valor === o.valor ? 'active' : ''}`.trim()} onClick={() => onCambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

// ---------------- Modal (<dialog> nativo, como el prototipo) ----------------

export function Modal({
  titulo,
  subtitulo,
  abierto,
  onCerrar,
  pie,
  ancho,
  encabezado,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  abierto: boolean;
  onCerrar: () => void;
  pie?: ReactNode;
  ancho?: 'wide';
  /** Elemento previo al título (por ejemplo, el avatar de la ficha del socio). */
  encabezado?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Navegadores sin showModal: se abre como diálogo no modal para no ocultar el contenido.
    if (abierto && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);
  if (!abierto) return null;
  return (
    <dialog
      ref={ref}
      id="ng-dialog"
      className={ancho ?? ''}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        // Clic fuera del contenido: cierra (mismo comportamiento del prototipo).
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onCerrar();
      }}
    >
      <div className="modal-inner">
        <header className="modal-top">
          <div className={encabezado ? 'modal-person' : undefined}>
            {encabezado}
            <div>
              <h2 id="modal-title">{titulo}</h2>
              {subtitulo && <p>{subtitulo}</p>}
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onCerrar} aria-label="Cerrar">
            <Icono n="close" />
          </button>
        </header>
        {children}
        {pie && <div className="form-actions">{pie}</div>}
      </div>
    </dialog>
  );
}

/** Confirmación de éxito (modal-success del prototipo). */
export function ModalExito({ abierto, titulo, descripcion, boton = 'Continuar', onCerrar }: { abierto: boolean; titulo: string; descripcion: string; boton?: string; onCerrar: () => void }) {
  return (
    <Modal titulo="" abierto={abierto} onCerrar={onCerrar}>
      <div className="modal-success">
        <div className="modal-hero-icon">
          <Icono n="check" />
        </div>
        <h3>{titulo}</h3>
        <p>{descripcion}</p>
        <Boton icono="arrow" onClick={onCerrar}>
          {boton}
        </Boton>
      </div>
    </Modal>
  );
}
