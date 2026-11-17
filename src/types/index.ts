/** Tipos compartidos con las respuestas de la API de NeuroGym-back. */

export type TipoUsuario = 'SOCIO' | 'PERSONAL' | 'PROFESIONAL';
export type TipoAcceso = 'CONSULTA' | 'GESTION';
export type MedioPago = 'PAGO_UNICO' | 'DEBITO_AUTOMATICO' | 'EFECTIVO';
export type EstadoCuota = 'PENDIENTE' | 'PAGADA' | 'IMPAGA';
export type TipoPlan = 'BASICO' | 'PREMIUM';
export type EstadoEquipo = 'OPERATIVO' | 'FUERA_DE_SERVICIO' | 'SERVICE_PROGRAMADO' | 'DADO_DE_BAJA';
export type EstadoTurnoProfesional = 'SOLICITADO' | 'CONFIRMADO' | 'RECHAZADO' | 'CANCELADO' | 'REPROGRAMADO' | 'COMPLETADO';

export interface Sesion {
  usuarioId: number;
  tipo: TipoUsuario;
  nombre: string;
  gimnasioId?: number;
  socioId?: number;
  sedeId?: number;
  personalId?: number;
  profesionalId?: number;
  esAdminGeneral?: boolean;
  rol?: string;
  permisos: string[];
}

export interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  horarios: string;
  habilitada: boolean;
  _count?: { socios: number; equipos: number };
}

export interface Turno {
  id: number;
  sedeId: number;
  sede?: string;
  actividad: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cupo: number;
  reservadas: number;
  disponibles: number;
  habilitado: boolean;
  reservaPropiaId?: number | null;
}

export interface Composicion {
  medio: MedioPago;
  cuotaBase: number;
  adicionalPremium: number;
  descuento: number;
  importeFinal: number;
}

export interface Cuota {
  id: number;
  periodo: string;
  estado: EstadoCuota;
  fechaVencimiento: string;
  cuotaBase: number;
  adicionalPremium: number;
  descuento: number;
  importeFinal: number;
  /** Cuota del período de un socio adherido: Mercado Pago la debitará (no admite otros medios). */
  debitoProgramado?: boolean;
  /** Medios con los que puede abonarse esta cuota (el débito solo cubre el período en curso). */
  mediosHabilitados?: MedioPago[];
}

export interface Comprobante {
  numero: string;
  fechaEmision: string;
  fechaEnvio: string | null;
  socio: string;
  sede: string;
  periodo: string;
  plan: string;
  cuotaBase: number;
  adicionalPremium: number;
  descuento: number;
  importe: number;
  medio: MedioPago;
  fechaPago: string;
  referencia: string;
}

export interface Notificacion {
  id: number;
  tipo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
}

export interface EjercicioRutina {
  id: number;
  ejercicioId: number;
  nombre: string;
  grupoMuscular: string;
  dia: number;
  orden: number;
  series: number;
  repeticiones: number;
  pesoKg: number | null;
  descansoSeg: number | null;
  disponible: boolean;
  equipos: { id: number; nombre: string; estado: EstadoEquipo }[];
  mantenimientoHasta: string | null;
}

export interface TurnoProfesional {
  id: number;
  profesionalId: number;
  estado: EstadoTurnoProfesional;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  modalidad: 'ONLINE' | 'PRESENCIAL';
  motivo: string | null;
  socio: string;
  profesional: string;
  especialidad: string;
  metodoPago: { id: number; tipo: string; obraSocial: string | null };
  comision: { importeDeclarado: string; importeComision: string; exenta: boolean } | null;
}

export interface MetodoPago {
  id: number;
  tipo: 'OBRA_SOCIAL' | 'PARTICULAR' | 'ACUERDO_CONSULTA';
  obraSocial: string | null;
}
