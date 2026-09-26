import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { richiediPermessoNotifiche, salvaTokenPush } from '@/lib/notifiche';
import { useAppStore } from '@/store/useAppStore';
import { colori, spazi } from '@/lib/theme';

export default function PassoNotifiche() {
  const utente = useAppStore((s) => s.utente);
  const completaOnboarding = useAppStore((s) => s.completaOnboarding);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  /** Chiude l'onboarding: crea il profilo e (se richiesto) registra il token push. */
  const concludi = async (conNotifiche: boolean) => {
    setErrore(null);
    setCaricamento(true);
    try {
      if (conNotifiche) {
        await richiediPermessoNotifiche();
      }

      const erroreProfilo = await completaOnboarding();
      if (erroreProfilo) {
        setErrore(erroreProfilo);
        return;
      }

      if (conNotifiche && utente) {
        await salvaTokenPush(utente.id); // best effort, non blocca mai
      }

      router.replace('/oggi');
    } finally {
      setCaricamento(false);
    }
  };

  return (
    <PassoOnboarding
      passo={6}
      icona="notifications-outline"
      titolo="Il briefing del mattino"
      descrizione="Ogni mattina, all'ora che scegli tu: le lezioni di oggi, le scadenze in arrivo e cosa studiare. Attiva le notifiche per riceverlo."
      etichettaBottone="Attiva le notifiche"
      onAvanti={() => concludi(true)}
      etichettaSecondaria="Non ora"
      onSecondaria={() => concludi(false)}
      caricamento={caricamento}
      errore={errore}
    >
      <Text style={stili.beta}>
        Stai usando una beta: nuove funzioni arrivano di continuo.
      </Text>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  beta: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spazi.sm,
  },
});
