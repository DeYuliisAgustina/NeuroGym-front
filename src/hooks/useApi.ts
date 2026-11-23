import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi } from '../services/api';

/** Carga datos de la API con estado de carga, error y recarga manual. */
export function useApi<T>(cargar: () => Promise<T>, dependencias: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const ultimo = useRef(0);

  const recargar = useCallback(async () => {
    const id = ++ultimo.current;
    setCargando(true);
    setError(null);
    try {
      const resultado = await cargar();
      if (id === ultimo.current) setDatos(resultado);
    } catch (e) {
      if (id === ultimo.current) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la información');
    } finally {
      if (id === ultimo.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar, setDatos };
}

/** Nombre legible de cada campo, para decir arriba del formulario qué hay que revisar. */
const NOMBRES_CAMPO: Record<string, string> = {
  nombre: 'el nombre',
  apellido: 'el apellido',
  email: 'el correo electrónico',
  password: 'la contraseña',
  telefono: 'el teléfono',
  sedeId: 'la sede',
  valorConsulta: 'el valor de la consulta',
  consentimientoDatos: 'el consentimiento',
};

/**
 * Si el error trae campos puntuales, el mensaje general dice cuáles revisar
 * («Revisá el correo electrónico y el teléfono.») en lugar de uno genérico.
 */
export function mensajeConCampos(mensaje: string, errores: Record<string, string>): string {
  // En el mismo orden en que aparecen los campos en el formulario.
  const orden = Object.keys(NOMBRES_CAMPO);
  const campos = Object.keys(errores).sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
  const nombres = campos.map((c) => NOMBRES_CAMPO[c]);
  if (!nombres.length || nombres.some((n) => !n)) return mensaje;
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return `Revisá ${lista}. Te marcamos el error debajo de cada campo.`;
}

/** Ejecuta una acción (envío de formulario, botón) y expone su estado. */
export function useAccion() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<string | null>(null);

  const ejecutar = useCallback(async <T,>(accion: () => Promise<T>, mensajeExito?: string): Promise<T | undefined> => {
    setEnviando(true);
    setError(null);
    setErrores({});
    setExito(null);
    try {
      const resultado = await accion();
      if (mensajeExito) setExito(mensajeExito);
      // Las respuestas 204 (sin cuerpo) llegan como undefined: se devuelve true para que
      // el llamador distinga el éxito del error (que sí devuelve undefined).
      return (resultado ?? true) as T;
    } catch (e) {
      if (e instanceof ErrorApi) {
        setError(mensajeConCampos(e.message, e.errores));
        setErrores(e.errores);
      } else setError((e as Error).message || 'Ocurrió un error inesperado');
      return undefined;
    } finally {
      setEnviando(false);
    }
  }, []);

  const limpiar = useCallback(() => {
    setError(null);
    setErrores({});
    setExito(null);
  }, []);

  return { enviando, error, errores, exito, ejecutar, limpiar, setError, setExito };
}
