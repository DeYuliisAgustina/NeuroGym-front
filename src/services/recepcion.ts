import { api, ErrorApi } from './api';

/** Resultado que muestra la recepción luego de leer un QR. */
export interface ResultadoIngreso {
  resultado: string;
  mensaje?: string;
  socio?: string;
  actividad?: string;
  sede?: string;
  turno?: string;
  hora?: string;
  diaConstancia?: boolean;
  periodosAdeudados?: string[];
  politicaSugerida?: 'BLOQUEAR' | 'AUTORIZAR';
  puedeAutorizar?: boolean;
  reservaId?: number;
  codigoQrId?: number;
}

/** Rechazo de un paso (HTTP 422): se muestra como resultado de la recepción, no como error. */
function comoResultado(error: unknown): ResultadoIngreso {
  if (error instanceof ErrorApi && error.status === 422) {
    const socio = (error.detalle as { socio?: string } | undefined)?.socio;
    return { resultado: error.codigo, mensaje: error.message, ...(socio ? { socio } : {}) };
  }
  throw error;
}

/**
 * CU-004 en el orden de los diagramas de secuencia: validar el QR en el servidor
 * (Fig. 99), verificar la reserva vigente (Fig. 100) y el estado de la cuota
 * (Fig. 101), y confirmar la asistencia (Fig. 105). Con cuota pendiente se detiene
 * para que el personal decida autorizar o bloquear (Fig. 102).
 */
export async function ingresarConQr(codigo: string, sedeId: number): Promise<ResultadoIngreso> {
  try {
    const qr = await api.post<{ socioId: number; codigoQrId: number; socio: string }>('/qr/validacion', { codigo });
    const reserva = await api.get<ResultadoIngreso & { reservaId: number }>('/reservas/vigente', { socioId: qr.socioId, sedeId });
    const cuota = await api.get<{ alDia: boolean; periodosAdeudados: string[]; politicaSugerida: 'BLOQUEAR' | 'AUTORIZAR'; puedeAutorizar: boolean }>(
      `/cuotas/${qr.socioId}/estado`,
    );
    if (!cuota.alDia) {
      return {
        ...reserva,
        resultado: 'CUOTA_PENDIENTE',
        mensaje: 'Cuota pendiente',
        periodosAdeudados: cuota.periodosAdeudados,
        politicaSugerida: cuota.politicaSugerida,
        puedeAutorizar: cuota.puedeAutorizar,
        codigoQrId: qr.codigoQrId,
      };
    }
    return await api.post<ResultadoIngreso>('/asistencias', { reservaId: reserva.reservaId, codigoQrId: qr.codigoQrId });
  } catch (error) {
    return comoResultado(error);
  }
}
