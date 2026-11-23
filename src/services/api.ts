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
    // El correo repetido se muestra debajo del campo de correo, como los demás errores.
    if (this.codigo === 'EMAIL_EN_USO') return { email: 'Este correo ya tiene una cuenta. Si es tuyo, ingresá o recuperá tu contraseña.' };
    if (!Array.isArray(this.detalle)) return {};
    return Object.fromEntries((this.detalle as { campo: string; mensaje: string }[]).map((d) => [d.campo, d.mensaje]));
  }
}

/**
 * Sesión por pestaña: cada pestaña guarda su token en sessionStorage, así el
 * personal y un socio pueden usar NeuroGym a la vez en pestañas distintas (y al
 * duplicar una pestaña se copia su sesión). El último ingreso queda además en
 * localStorage como sesión inicial de las pestañas nuevas.
 */
export const tokenAlmacenado = {
  leer: () => {
    try {
      const propio = sessionStorage.getItem(CLAVE_TOKEN);
      if (propio) return propio;
      const compartido = localStorage.getItem(CLAVE_TOKEN);
      // La pestaña nueva toma el último ingreso y lo fija como propio.
      if (compartido) sessionStorage.setItem(CLAVE_TOKEN, compartido);
      return compartido;
    } catch {
      return null;
    }
  },
  guardar: (token: string) => {
    try {
      sessionStorage.setItem(CLAVE_TOKEN, token);
      localStorage.setItem(CLAVE_TOKEN, token);
    } catch {
      /* almacenamiento no disponible */
    }
  },
  borrar: () => {
    try {
      const propio = sessionStorage.getItem(CLAVE_TOKEN);
      sessionStorage.removeItem(CLAVE_TOKEN);
      // Solo se borra la sesión compartida si es la de esta pestaña (no cierra la de otra).
      if (!propio || localStorage.getItem(CLAVE_TOKEN) === propio) localStorage.removeItem(CLAVE_TOKEN);
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
