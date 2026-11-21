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
        setError(e.message);
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
