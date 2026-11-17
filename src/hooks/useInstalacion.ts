import { useEffect, useState } from 'react';

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Instalación de la PWA (RNF1): usa el aviso nativo del navegador cuando está disponible. */
export function useInstalacion() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    };
    window.addEventListener('beforeinstallprompt', guardar);
    return () => window.removeEventListener('beforeinstallprompt', guardar);
  }, []);
  const instalada = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  const instalar = async (): Promise<'instalada' | 'manual'> => {
    if (!evento) return 'manual';
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    return outcome === 'accepted' ? 'instalada' : 'manual';
  };
  return { disponible: !!evento, instalada, instalar };
}
