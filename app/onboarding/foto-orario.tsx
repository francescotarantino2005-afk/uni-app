import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { colori, raggi, spazi } from '@/lib/theme';

export default function PassoFotoOrario() {
  return (
    <PassoOnboarding
      passo={2}
      icona="camera-outline"
      titolo="Fotografa il tuo orario"
      descrizione="Una foto o uno screenshot dell'orario delle lezioni: l'AI lo trasforma nel tuo calendario personale."
      etichettaBottone="Continua"
      onAvanti={() => router.push('/onboarding/notifiche')}
    >
      <View style={stili.riquadro}>
        <Ionicons name="image-outline" size={32} color={colori.testoSecondario} />
        <Text style={stili.testoRiquadro}>
          Qui aprirai fotocamera o galleria{'\n'}(estrazione AI in arrivo)
        </Text>
      </View>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  riquadro: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spazi.sm,
    marginTop: spazi.sm,
    paddingVertical: spazi.xl,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colori.bordo,
    backgroundColor: colori.superficie,
  },
  testoRiquadro: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
