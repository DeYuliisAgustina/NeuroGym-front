import { ICONOS } from './iconos';

/** Ícono del prototipo original (mismo trazo y tamaño: clase `icon`). */
export function Icono({ n, extra = '' }: { n: string; extra?: string }) {
  return (
    <svg
      className={`icon ${extra}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Trazos constantes definidos en iconos.ts (no provienen de datos del usuario).
      dangerouslySetInnerHTML={{ __html: ICONOS[n] ?? ICONOS.activity }}
    />
  );
}
