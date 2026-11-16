import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useEffect, useId } from 'react';
import { etiqueta, tonoEstado } from '../utils/formato';

/** Componentes de interfaz reutilizables (botones, campos, avisos, modales). */

type Variante = 'primario' | 'secundario' | 'acento' | 'peligro' | 'texto';

export function Boton({
  variante = 'primario',
  chico,
  bloque,
  cargando,
  children,
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; chico?: boolean; bloque?: boolean; cargando?: boolean }) {
  return (
    <button
      type="button"
      className={`btn btn-${variante} ${chico ? 'btn-chico' : ''} ${bloque ? 'btn-bloque' : ''} ${className}`}
      disabled={cargando || resto.disabled}
      {...resto}
    >
      {cargando ? 'Procesando…' : children}
    </button>
  );
}

export function Campo({ etiqueta: texto, error, ayuda, ...resto }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string; ayuda?: string }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{texto}</label>
      <input id={id} aria-invalid={!!error} {...resto} />
      {ayuda && <small>{ayuda}</small>}
      {error && <span className="error-campo">{error}</span>}
    </div>
  );
}

export function Selector({
  etiqueta: texto,
  error,
  opciones,
  vacio,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; error?: string; opciones: { valor: string | number; texto: string }[]; vacio?: string }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{texto}</label>
      <select id={id} aria-invalid={!!error} {...resto}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {error && <span className="error-campo">{error}</span>}
    </div>
  );
}

export function AreaTexto({ etiqueta: texto, error, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string; error?: string }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{texto}</label>
      <textarea id={id} aria-invalid={!!error} {...resto} />
      {error && <span className="error-campo">{error}</span>}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'error' | 'exito' | 'info' | 'alerta'; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Estado({ valor }: { valor: string }) {
  return <span className={`etiqueta ${tonoEstado(valor)}`}>{etiqueta(valor)}</span>;
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <div className="cargando">{texto}</div>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>;
}

export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="encabezado-pagina fila-entre">
      <div>
        <h1>{titulo}</h1>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {acciones && <div className="fila">{acciones}</div>}
    </div>
  );
}

export function Pestanas<T extends string>({ valor, opciones, onCambiar }: { valor: T; opciones: { valor: T; texto: string }[]; onCambiar: (v: T) => void }) {
  return (
    <div className="pestanas" role="tablist">
      {opciones.map((o) => (
        <button key={o.valor} role="tab" aria-selected={valor === o.valor} className={`pestana ${valor === o.valor ? 'activa' : ''}`} onClick={() => onCambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Modal({ titulo, abierto, onCerrar, children }: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="fila-entre">
          <h2>{titulo}</h2>
          <Boton variante="texto" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </Boton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Kpi({ titulo, valor, detalle }: { titulo: string; valor: ReactNode; detalle?: string }) {
  return (
    <div className="tarjeta">
      <small>{titulo}</small>
      <div className="kpi">{valor}</div>
      {detalle && <small>{detalle}</small>}
    </div>
  );
}
