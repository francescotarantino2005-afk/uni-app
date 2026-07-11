import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SchermataPlaceholder } from '@/components/SchermataPlaceholder';
import { useAppStore } from '@/store/useAppStore';
import { colori, spazi } from '@/lib/theme';

export default function SchermataOggi() {
  const profilo = useAppStore((s) => s.profilo);
  const esci = useAppStore((s) => s.esci);

  const gestisciUscita = async () => {
    await esci();
    router.replace('/auth');
  };

  return (
    <View style={stili.schermo}>
      <SchermataPlaceholder
        icona="sunny-outline"
        titolo="La tua giornata"
        descrizione={
          profilo?.ateneo
            ? `Qui vedrai le lezioni di oggi e le prossime scadenze di ${profilo.ateneo}.`
            : "Qui vedrai le lezioni di oggi e le prossime scadenze, a colpo d'occhio appena apri l'app."
        }
        sprint="In arrivo nello Sprint 2"
      />
      <Pressable onPress={gestisciUscita} style={stili.bottoneEsci}>
        <Text style={stili.testoEsci}>Esci dall'account</Text>
      </Pressable>
    </View>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  bottoneEsci: {
    alignSelf: 'center',
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.lg,
    marginBottom: spazi.md,
  },
  testoEsci: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
  },
});
