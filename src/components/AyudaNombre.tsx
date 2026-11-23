import { errorNombre } from '../validations/formularios';

/**
 * Texto debajo de un nombre o apellido: el error en rojo apenas se escribe un número o
 * un símbolo (o el que devolvió el formulario); si no hay error, la aclaración «Solo letras.».
 */
export function AyudaNombre({ valor, error }: { valor: string; error?: string | null }) {
  const texto = error ?? (valor.trim() ? errorNombre(valor) : undefined);
  return texto ? <small role="alert">{texto}</small> : <small>Solo letras.</small>;
}

/** Mensaje general cuando el nombre o el apellido tienen números o símbolos (o falta alguno). */
export function errorNombreCompleto(nombre: string, apellido: string): string | undefined {
  if (errorNombre(nombre) || errorNombre(apellido)) return 'Revisá el nombre y el apellido: usá solo letras, sin números ni símbolos.';
  return undefined;
}
