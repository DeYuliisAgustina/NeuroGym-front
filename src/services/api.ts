/**
 * Cliente HTTP de la capa de presentación: se comunica con la API REST de
 * NeuroGym-back mediante JSON. La autorización real siempre la decide el backend.
 */
const URL_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const CLAVE_TOKEN = 'neurogym.token';

export class ErrorApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
  }

  /** Errores de validación campo por campo devueltos por el backend (HTTP 400). */
  get errores(): Record<string, string> {
    if (!Array.isArray(this.detalle)) return {};
    return Object.fromEntries((this.detalle as { campo: string; mensaje: string }[]).map((d) => [d.campo, d.mensaje]));
  }
}

export const tokenAlmacenado = {
  leer: () => {
    try {
      return localStorage.getItem(CLAVE_TOKEN);
    } catch {
      return null;
    }
  },
  guardar: (token: string) => {
    try {
      localStorage.setItem(CLAVE_TOKEN, token);
    } catch {
      /* almacenamiento no disponible */
    }
  },
  borrar: () => {
    try {
      localStorage.removeItem(CLAVE_TOKEN);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

let alExpirarSesion: (() => void) | null = null;
export const registrarExpiracion = (callback: () => void) => {
  alExpirarSesion = callback;
};

type Opciones = { metodo?: string; cuerpo?: unknown; consulta?: Record<string, unknown> };

function armarUrl(ruta: string, consulta?: Record<string, unknown>) {
  const url = new URL(`${URL_BASE}${ruta}`);
  Object.entries(consulta ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function solicitar<T>(ruta: string, { metodo = 'GET', cuerpo, consulta }: Opciones = {}): Promise<T> {
  const token = tokenAlmacenado.leer();
  const esFormulario = cuerpo instanceof FormData;
  let respuesta: Response;
  try {
    respuesta = await fetch(armarUrl(ruta, consulta), {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cuerpo !== undefined && !esFormulario ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo === undefined ? undefined : esFormulario ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    // RD14: NeuroGym no opera sin conexión; se informa al usuario.
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revisá tu conexión e intentá nuevamente.');
  }
  if (respuesta.status === 204) return undefined as T;
  const tipo = respuesta.headers.get('content-type') ?? '';
  const datos = tipo.includes('application/json') ? await respuesta.json() : await respuesta.blob();
  if (!respuesta.ok) {
    const error = datos as { error?: string; mensaje?: string; detalle?: unknown };
    if (respuesta.status === 401 && token) alExpirarSesion?.();
    throw new ErrorApi(respuesta.status, error.error ?? 'ERROR', error.mensaje ?? 'Ocurrió un error', error.detalle);
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string, consulta?: Record<string, unknown>) => solicitar<T>(ruta, { consulta }),
  post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>(ruta, { metodo: 'POST', cuerpo: cuerpo ?? {} }),
  put: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>(ruta, { metodo: 'PUT', cuerpo: cuerpo ?? {} }),
  patch: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>(ruta, { metodo: 'PATCH', cuerpo: cuerpo ?? {} }),
  delete: <T>(ruta: string) => solicitar<T>(ruta, { metodo: 'DELETE' }),
  /** Descarga un archivo (por ejemplo, el reporte .xlsx o el .ics). */
  async descargar(ruta: string, nombre: string, consulta?: Record<string, unknown>) {
    const blob = await solicitar<Blob>(ruta, { consulta });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  },
};
