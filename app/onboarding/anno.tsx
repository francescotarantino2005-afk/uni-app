import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function PassoAnno() {
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Registra solo il bivio matricola / anni successivi: la colonna anno resta
  // vuota, riservata all'anno di corso vero.
  const scegli = async (matricola: boolean) => {
    setErrore(null);
    setSalvataggio(true);
    const err = await aggiornaAccoglienza({ matricola, accoglienza_stato: 'nome_bot' });
    setSalvataggio(false);
    if (err) {
      setErrore(err);
      return;
    }
    router.push('/onboarding/nome-bot');
  };

  return (
    <PassoOnboarding
      passo={3}
      icona="flag-outline"
      titolo="A che punto sei?"
      descrizione="Così so se stai partendo ora o hai già esami alle spalle: cambia il modo in cui ti do una mano."
    >
      <View style={stili.contenitore}>
        <Pressable style={stili.scelta} disabled={salvataggio} onPress={() => scegli(true)}>
          <Ionicons name="leaf-outline" size={26} color={colori.testoSecondario} />
          <View style={{ flex: 1 }}>
            <Text style={stili.titoloScelta}>Primo anno</Text>
            <Text style={stili.sottoScelta}>Matricola: sto iniziando adesso</Text>
          </View>
        </Pressable>
        <Pressable style={stili.scelta} disabled={salvataggio} onPress={() => scegli(false)}>
          <Ionicons name="trending-up-outline" size={26} color={colori.testoSecondario} />
          <View style={{ flex: 1 }}>
            <Text style={stili.titoloScelta}>Anni successivi</Text>
            <Text style={stili.sottoScelta}>Ho già dato qualche esame</Text>
          </View>
        </Pressable>
        <MessaggioErrore messaggio={errore} />
      </View>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  contenitore: { alignSelf: 'stretch', gap: spazi.md, marginTop: spazi.sm },
  scelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
  },
  titoloScelta: { color: colori.testo, fontSize: 17, fontWeight: '800' },
  sottoScelta: { color: colori.testoSecondario, fontSize: 13, marginTop: 2 },
});
