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

  // Dialogo di accoglienza ("dialogo:1"…"dialogo:5"): riprende dalla domanda salvata.
  // "orario" e "notifiche" sono passi che non esistono più: chi era fermo lì ha
  // già fatto tutto ciò che viene prima, quindi prosegue dal dialogo (che al suo
  // avvio riscrive lo stato in "dialogo:1").
  const stato = profilo.accoglienza_stato;
  if (stato?.startsWith('dialogo:') || stato === 'orario' || stato === 'notifiche') {
    return <Redirect href="/onboarding/dialogo" />;
  }

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
  }

  return <Redirect href="/oggi" />;
}
