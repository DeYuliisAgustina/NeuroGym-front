import { useSyncExternalStore } from 'react';
import { api } from './api';

/**
 * Generación de rutina en segundo plano (CU-003): la IA tarda unos 20 a 30
 * segundos, así que el pedido sigue en curso aunque el socio cierre el modal o
 * navegue a otra pantalla. El estado vive fuera de los componentes para que
 * «Mi rutina» lo muestre al volver y el aviso llegue esté donde esté el socio.
 */
export interface EstadoGeneracion {
  enCurso: boolean;
  /** Momento de inicio (ms) para mostrar los segundos transcurridos. */
  inicio: number;
  error: string | null;
  /** Aumenta cada vez que termina una generación exitosa (para recargar la rutina). */
  version: number;
}

let estado: EstadoGeneracion = { enCurso: false, inicio: 0, error: null, version: 0 };
const oyentes = new Set<() => void>();

function actualizar(cambios: Partial<EstadoGeneracion>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export const useGeneracionRutina = () => useSyncExternalStore(suscribir, () => estado);

export interface PreferenciasRutina {
  objetivo: string;
  nivel: string;
  diasPorSemana: number;
}

/**
 * Inicia la generación sin bloquear la pantalla. `avisar` muestra el resultado
 * (toast global), aunque el socio ya no esté en «Mi rutina».
 */
export async function generarRutinaEnSegundoPlano(preferencias: PreferenciasRutina, avisar: (mensaje: string) => void) {
  if (estado.enCurso) return;
  actualizar({ enCurso: true, inicio: Date.now(), error: null });
  try {
    await api.post('/socio/rutina', preferencias);
    actualizar({ enCurso: false, version: estado.version + 1 });
    const enMiRutina = window.location.pathname.startsWith('/socio/rutina');
    avisar(enMiRutina ? '¡Tu nueva rutina está lista! Podés editar cada ejercicio.' : '¡Tu nueva rutina está lista! Entrá a «Mi rutina» para verla.');
  } catch (e) {
    const mensaje = (e as Error).message || 'No pudo generarse la rutina.';
    actualizar({ enCurso: false, error: mensaje });
    avisar('No pudo generarse la rutina. Se conserva tu rutina anterior.');
  }
}
