/** Formateo de importes, fechas y etiquetas para la interfaz (es-AR). */

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
export const dinero = (valor: number | string | null | undefined) => pesos.format(Number(valor ?? 0));

export function fecha(valor: string | Date | null | undefined, conHora = false) {
  if (!valor) return '—';
  const texto = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor;
  return new Date(texto).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function diaSemanaCorto(fechaIso: string) {
  return new Date(`${fechaIso}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export const hoyIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

export function sumarDiasIso(fechaIso: string, dias: number) {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const ETIQUETAS: Record<string, string> = {
  PAGO_UNICO: 'Mercado Pago (pago único)',
  DEBITO_AUTOMATICO: 'Débito automático',
  EFECTIVO: 'Efectivo',
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  IMPAGA: 'Impaga',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  BASICO: 'Básico',
  PREMIUM: 'Premium',
  STANDARD: 'NeuroGym Standard',
  INTELLIGENCE: 'NeuroGym Intelligence',
  OPERATIVO: 'Operativo',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  SERVICE_PROGRAMADO: 'Service programado',
  DADO_DE_BAJA: 'Dado de baja',
  REPORTADA: 'Reportada',
  EN_GESTION: 'En gestión',
  RESUELTA: 'Resuelta',
  SOLICITADO: 'Solicitado',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
  REPROGRAMADO: 'Reprogramado',
  COMPLETADO: 'Completado',
  RESERVADO: 'Reservado',
  NUTRICION: 'Nutrición',
  DEPORTOLOGIA: 'Deportología',
  ONLINE: 'Online',
  PRESENCIAL: 'Presencial',
  ONLINE_Y_PRESENCIAL: 'Online y presencial',
  OBRA_SOCIAL: 'Obra social',
  PARTICULAR: 'Particular',
  ACUERDO_CONSULTA: 'A acordar en la consulta',
  PREPARADA: 'Preparada',
  APROBADA: 'Aprobada',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAJO: 'Bajo',
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  PROGRAMADO: 'Programado',
  REALIZADO: 'Realizado',
  QR: 'QR',
  MANUAL: 'Manual',
};
export const etiqueta = (valor: string | null | undefined) => (valor ? (ETIQUETAS[valor] ?? valor) : '—');

/** Clase de color para estados. */
export function tonoEstado(valor: string): string {
  if (['PAGADA', 'APROBADO', 'OPERATIVO', 'RESUELTA', 'CONFIRMADO', 'COMPLETADO', 'APROBADA', 'BAJO', 'REALIZADO'].includes(valor)) return 'etiqueta-ok';
  if (['IMPAGA', 'RECHAZADO', 'DADO_DE_BAJA', 'CANCELADO', 'ALTO', 'FUERA_DE_SERVICIO'].includes(valor)) return 'etiqueta-mal';
  if (['PENDIENTE', 'SERVICE_PROGRAMADO', 'EN_GESTION', 'SOLICITADO', 'MEDIO', 'PROGRAMADO', 'REPROGRAMADO'].includes(valor)) return 'etiqueta-alerta';
  return '';
}
