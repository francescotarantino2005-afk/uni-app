import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';

/**
 * Punto d'ingresso:
 * - non loggato            → accesso/registrazione
 * - loggato senza profilo  → onboarding
 * - loggato con profilo    → home
 */
export default function Ingresso() {
  const recupero = useAppStore((s) => s.recupero);
  const utente = useAppStore((s) => s.utente);
  const profilo = useAppStore((s) => s.profilo);

  // Il recupero password ha la precedenza su tutto: nessun ingresso in app.
  if (recupero) return <Redirect href="/reset-password" />;
  if (!utente) return <Redirect href="/auth" />;
  if (!profilo) return <Redirect href="/onboarding/ateneo" />;
  return <Redirect href="/oggi" />;
}
