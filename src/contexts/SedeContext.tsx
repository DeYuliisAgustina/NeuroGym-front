import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * "Vista de sedes" del panel administrativo: la sede elegida en la barra
 * lateral filtra los listados que admiten sede ('' = todas las sedes).
 */
const SedeContext = createContext<{ sedeId: string; setSedeId: (v: string) => void }>({ sedeId: '', setSedeId: () => undefined });

export function SedeProvider({ children }: { children: ReactNode }) {
  const [sedeId, setSedeId] = useState('');
  return <SedeContext.Provider value={{ sedeId, setSedeId }}>{children}</SedeContext.Provider>;
}

export const useSedeVista = () => useContext(SedeContext);
