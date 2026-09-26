import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { CampoTesto } from '@/components/CampoTesto';
import { suggerisciCorsi } from '@/lib/corsi';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function PassoCorso() {
  const profilo = useAppStore((s) => s.profilo);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const [corso, setCorso] = useState(profilo?.corso ?? '');
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const suggerimenti = useMemo(() => suggerisciCorsi(corso), [corso]);

  const salva = async (testo: string) => {
    setErrore(null);
    setSalvataggio(true);
    const err = await aggiornaAccoglienza({ corso: testo, accoglienza_stato: 'anno' });
    setSalvataggio(false);
    if (err) {
      setErrore(err);
      return;
    }
    router.push('/onboarding/anno');
  };

  const procedi = () => {
    const testo = corso.trim();
    if (!testo) return;
    // Molto corto o senza lettere: chiedi conferma UNA volta, poi accetta comunque.
    const dubbio = testo.length < 3 || !/[a-zà-ù]/i.test(testo);
    if (dubbio) {
      const messaggio = `Hai scritto "${testo}". È il nome giusto del corso?`;
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        if (window.confirm(messaggio)) salva(testo);
        return;
      }
      Alert.alert('Confermi il corso?', messaggio, [
        { text: 'Modifica', style: 'cancel' },
        { text: 'Sì, continua', onPress: () => salva(testo) },
      ]);
      return;
    }
    salva(testo);
  };

  return (
    <PassoOnboarding
      passo={2}
      icona="school-outline"
      titolo="Che corso fai?"
      descrizione="Scrivi il tuo corso di laurea: ti do qualche suggerimento mentre scrivi, ma puoi scrivere quello che vuoi."
      etichettaBottone="Continua"
      bottoneDisabilitato={!corso.trim()}
      caricamento={salvataggio}
      onAvanti={procedi}
      errore={errore}
    >
      <View style={stili.contenitore}>
        <CampoTesto
          etichetta="Corso di laurea"
          value={corso}
          onChangeText={setCorso}
          placeholder="es. Ingegneria Informatica"
          autoCapitalize="words"
        />
        {suggerimenti.length > 0 ? (
          <View style={stili.suggerimenti}>
            {suggerimenti.map((s) => (
              <Pressable key={s} style={stili.suggerimento} onPress={() => setCorso(s)}>
                <Text style={stili.testoSuggerimento}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  contenitore: { alignSelf: 'stretch', gap: spazi.sm, marginTop: spazi.sm },
  suggerimenti: { gap: spazi.xs },
  suggerimento: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoSuggerimento: { color: colori.testo, fontSize: 14 },
});
