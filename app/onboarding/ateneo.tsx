import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { colori, raggi, spazi } from '@/lib/theme';

// Lista segnaposto: nello Sprint 1 vero arriverà la lista completa con ricerca.
const ATENEI_ESEMPIO = [
  'Università di Bologna',
  'Sapienza Università di Roma',
  'Politecnico di Milano',
  'Università di Napoli Federico II',
];

export default function PassoAteneo() {
  const [selezionato, setSelezionato] = useState<string | null>(null);

  return (
    <PassoOnboarding
      passo={1}
      icona="business-outline"
      titolo="Dove studi?"
      descrizione="Scegli il tuo ateneo: ci serve per proporti le scadenze giuste e capire il tuo calendario."
      etichettaBottone="Continua"
      onAvanti={() => router.push('/onboarding/foto-orario')}
    >
      <View style={stili.lista}>
        {ATENEI_ESEMPIO.map((nome) => (
          <Pressable
            key={nome}
            onPress={() => setSelezionato(nome)}
            style={[stili.voce, selezionato === nome && stili.voceSelezionata]}
          >
            <Text style={[stili.testoVoce, selezionato === nome && stili.testoVoceSelezionata]}>
              {nome}
            </Text>
          </Pressable>
        ))}
        <Text style={stili.nota}>Lista completa con ricerca in arrivo</Text>
      </View>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  lista: {
    alignSelf: 'stretch',
    gap: spazi.sm,
    marginTop: spazi.sm,
  },
  voce: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  voceSelezionata: {
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  testoVoce: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '500',
  },
  testoVoceSelezionata: {
    color: colori.accento,
    fontWeight: '700',
  },
  nota: {
    color: colori.testoSecondario,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spazi.xs,
  },
});
