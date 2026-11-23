/**
 * Qué le falta a una contraseña nueva (la misma regla que el backend: 8 a 72 caracteres,
 * con letras y números). Devuelve, por ejemplo, «Te faltan 4 caracteres y un número».
 */
export function faltaEnPassword(password: string): string | undefined {
  if (password.length > 72) return 'Usá 72 caracteres como máximo';
  const faltan: string[] = [];
  const cantidad = 8 - password.length;
  if (cantidad > 0) faltan.push(cantidad === 1 ? '1 carácter' : `${cantidad} caracteres`);
  if (!/[A-Za-z]/.test(password)) faltan.push('una letra');
  if (!/\d/.test(password)) faltan.push('un número');
  if (!faltan.length) return undefined;
  const plural = faltan.length > 1 || cantidad > 1;
  const lista = faltan.length > 1 ? `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}` : faltan[0];
  return `Te ${plural ? 'faltan' : 'falta'} ${lista}`;
}

/**
 * Texto debajo de una contraseña nueva: mientras se escribe dice en rojo qué falta;
 * vacía muestra la regla (o el error del formulario) y, si cumple, lo confirma.
 */
export function AyudaPassword({ valor, error }: { valor: string; error?: string | null }) {
  if (!valor) return error ? <small role="alert">{error}</small> : <small>Mínimo 8 caracteres, con letras y números.</small>;
  const falta = faltaEnPassword(valor);
  if (falta) return <small role="alert">{falta}.</small>;
  return error ? <small role="alert">{error}</small> : <small>✓ La contraseña cumple con lo pedido.</small>;
}
