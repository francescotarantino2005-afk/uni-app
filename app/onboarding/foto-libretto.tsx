import { useState } from 'react';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { SelettoreFotoLibretto } from '@/components/SelettoreFotoLibretto';
import { estraiLibrettoDaFoto } from '@/lib/estrazioneLibretto';
import { useAppStore } from '@/store/useAppStore';

/** Solo per chi ha scelto "Anni successivi": foto del libretto → lettura → conferma. */
export default function PassoFotoLibretto() {
  const fotoLibretto = useAppStore((s) => s.fotoLibretto);
  const impostaFotoLibretto = useAppStore((s) => s.impostaFotoLibretto);
  const impostaEsamiEstratti = useAppStore((s) => s.impostaEsamiEstratti);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // "Lo faccio dopo": niente libretto, si passa al dialogo.
  const salta = async () => {
    setErrore(null);
    const err = await aggiornaAccoglienza({ accoglienza_stato: 'dialogo:1' });
    if (err) {
      setErrore(err);
      return;
    }
    impostaFotoLibretto([]);
    router.replace('/onboarding/dialogo');
  };

  const leggi = async () => {
    if (fotoLibretto.length === 0) return;
    setErrore(null);
    setCaricamento(true);
    const { esami, errore: erroreLettura } = await estraiLibrettoDaFoto(fotoLibretto);
    setCaricamento(false);

    if (erroreLettura || !esami) {
      setErrore(erroreLettura);
      return;
    }
    // Niente viene salvato qui: la conferma mostra tutto prima di scrivere.
    impostaEsamiEstratti(esami);
    router.push('/onboarding/conferma-libretto');
  };

  const n = fotoLibretto.length;

  return (
    <PassoOnboarding
      passo={5}
      icona="school-outline"
      titolo="Il tuo libretto"
      descrizione="Hai già degli esami alle spalle. Fammi una foto del libretto e te li metto dentro io."
      etichettaBottone={
        caricamento
          ? 'Sto leggendo il libretto…'
          : n > 1
            ? `Leggi le ${n} foto`
            : 'Leggi il libretto'
      }
      bottoneDisabilitato={n === 0}
      caricamento={caricamento}
      onAvanti={leggi}
      etichettaSecondaria="Lo faccio dopo"
      onSecondaria={salta}
      errore={errore}
    >
      <SelettoreFotoLibretto foto={fotoLibretto} onFoto={impostaFotoLibretto} />
    </PassoOnboarding>
  );
}
