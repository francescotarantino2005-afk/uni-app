import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { PassoOnboarding, usaPassiLibretto } from '@/components/PassoOnboarding';
import { richiediPermessoNotifiche, salvaTokenPush } from '@/lib/notifiche';
import { useAppStore } from '@/store/useAppStore';
import { colori, spazi } from '@/lib/theme';

export default function PassoNotifiche() {
  const utente = useAppStore((s) => s.utente);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const { conLibretto } = usaPassiLibretto();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  /** Ultimo passo a tocchi: registra il token push (se richiesto) e apre il dialogo. */
  const concludi = async (conNotifiche: boolean) => {
    setErrore(null);
    setCaricamento(true);
    try {
      if (conNotifiche) {
        await richiediPermessoNotifiche();
      }

      const erroreProfilo = await aggiornaAccoglienza({ accoglienza_stato: 'dialogo:1' });
      if (erroreProfilo) {
        setErrore(erroreProfilo);
        return;
      }

      if (conNotifiche && utente) {
        await salvaTokenPush(utente.id); // best effort, non blocca mai
      }

      router.replace('/onboarding/dialogo');
    } finally {
      setCaricamento(false);
    }
  };

  return (
    <PassoOnboarding
      passo={conLibretto ? 7 : 6}
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
