import { useState } from 'react';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { SelettoreFotoOrario } from '@/components/SelettoreFotoOrario';
import { estraiOrarioDaFoto } from '@/lib/estrazioneOrario';
import { useAppStore } from '@/store/useAppStore';

export default function PassoFotoOrario() {
  const fotoOrario = useAppStore((s) => s.fotoOrario);
  const impostaFotoOrario = useAppStore((s) => s.impostaFotoOrario);
  const impostaLezioniEstratte = useAppStore((s) => s.impostaLezioniEstratte);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const estrai = async () => {
    if (!fotoOrario) return;
    setErrore(null);
    setCaricamento(true);
    const { lezioni, errore: erroreEstrazione } = await estraiOrarioDaFoto(
      fotoOrario.base64,
      fotoOrario.tipo
    );
    setCaricamento(false);

    if (erroreEstrazione || !lezioni) {
      setErrore(erroreEstrazione);
      return;
    }
    impostaLezioniEstratte(lezioni);
    router.push('/anteprima-orario?da=onboarding');
  };

  return (
    <PassoOnboarding
      passo={2}
      icona="camera-outline"
      titolo="Fotografa il tuo orario"
      descrizione="Una foto o uno screenshot dell'orario delle lezioni: l'AI lo trasforma nel tuo calendario personale."
      etichettaBottone={caricamento ? 'Sto leggendo il tuo orario…' : 'Estrai le lezioni'}
      bottoneDisabilitato={!fotoOrario}
      caricamento={caricamento}
      onAvanti={estrai}
      etichettaSecondaria="Salto, lo farò dopo"
      onSecondaria={() => router.push('/onboarding/notifiche')}
      errore={errore}
    >
      <SelettoreFotoOrario foto={fotoOrario} onFoto={impostaFotoOrario} />
    </PassoOnboarding>
  );
}
