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

  // Accoglienza in corso: riprendi dal primo passo non ancora fatto.
  // (accoglienza_stato null = profilo creato prima della tappa 1 → dentro l'app.)
  switch (profilo.accoglienza_stato) {
    case 'corso':
      return <Redirect href="/onboarding/corso" />;
    case 'anno':
      return <Redirect href="/onboarding/anno" />;
    case 'nome_bot':
      return <Redirect href="/onboarding/nome-bot" />;
    case 'libretto':
      return <Redirect href="/onboarding/foto-libretto" />;
    case 'orario':
      return <Redirect href="/onboarding/foto-orario" />;
    case 'notifiche':
      return <Redirect href="/onboarding/notifiche" />;
  }

  return <Redirect href="/oggi" />;
}
