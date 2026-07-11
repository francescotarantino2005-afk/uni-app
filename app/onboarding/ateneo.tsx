import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { ATENEI } from '@/lib/atenei';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function PassoAteneo() {
  const ateneoSelezionato = useAppStore((s) => s.ateneoSelezionato);
  const impostaAteneo = useAppStore((s) => s.impostaAteneo);

  return (
    <PassoOnboarding
      passo={1}
      icona="business-outline"
      titolo="Dove studi?"
      descrizione="Scegli il tuo ateneo: ci serve per proporti le scadenze giuste e capire il tuo calendario."
      etichettaBottone="Continua"
      bottoneDisabilitato={!ateneoSelezionato}
      onAvanti={() => router.push('/onboarding/foto-orario')}
    >
      <ScrollView style={stili.lista} contentContainerStyle={stili.contenutoLista}>
        {ATENEI.map((nome) => (
          <Pressable
            key={nome}
            onPress={() => impostaAteneo(nome)}
            style={[stili.voce, ateneoSelezionato === nome && stili.voceSelezionata]}
          >
            <Text
              style={[stili.testoVoce, ateneoSelezionato === nome && stili.testoVoceSelezionata]}
            >
              {nome}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  lista: {
    alignSelf: 'stretch',
    maxHeight: 280,
    marginTop: spazi.sm,
  },
  contenutoLista: {
    gap: spazi.sm,
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
});
