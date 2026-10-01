import { useState } from 'react';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { CampoTesto } from '@/components/CampoTesto';
import { useAppStore } from '@/store/useAppStore';

export default function PassoNomeBot() {
  const profilo = useAppStore((s) => s.profilo);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const [nome, setNome] = useState(profilo?.nome_bot ?? 'Lode');
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Chi ha già esami alle spalle passa dal libretto; le matricole vanno dritte al dialogo.
  const conLibretto = profilo?.matricola === false;

  const salva = async (nomeBot: string) => {
    setErrore(null);
    setSalvataggio(true);
    const err = await aggiornaAccoglienza({
      nome_bot: nomeBot,
      accoglienza_stato: conLibretto ? 'libretto' : 'dialogo:1',
    });
    setSalvataggio(false);
    if (err) {
      setErrore(err);
      return;
    }
    if (conLibretto) router.push('/onboarding/foto-libretto');
    else router.replace('/onboarding/dialogo');
  };

  return (
    <PassoOnboarding
      passo={4}
      icona="happy-outline"
      titolo="Come lo vuoi chiamare?"
      descrizione="Dai un nome al tuo assistente. Puoi tenere Lode o sceglierne uno tuo — lo cambi quando vuoi."
      etichettaBottone="Continua"
      bottoneDisabilitato={!nome.trim()}
      caricamento={salvataggio}
      onAvanti={() => salva(nome.trim() || 'Lode')}
      etichettaSecondaria="Salta, tienilo Lode"
      onSecondaria={() => salva('Lode')}
      errore={errore}
    >
      <CampoTesto
        etichetta="Nome dell'assistente"
        value={nome}
        onChangeText={setNome}
        placeholder="Lode"
        autoCapitalize="words"
      />
    </PassoOnboarding>
  );
}
