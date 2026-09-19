import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { CampoTesto } from '@/components/CampoTesto';
import { cercaAtenei } from '@/lib/atenei';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function PassoAteneo() {
  const ateneoSelezionato = useAppStore((s) => s.ateneoSelezionato);
  const impostaAteneo = useAppStore((s) => s.impostaAteneo);
  const [query, setQuery] = useState('');
  const risultati = useMemo(() => cercaAtenei(query), [query]);

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
      <View style={stili.contenitore}>
        <CampoTesto
          etichetta="Cerca il tuo ateneo"
          value={query}
          onChangeText={setQuery}
          placeholder="nome, città o sigla (es. polimi)"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        <FlatList
          data={risultati}
          keyExtractor={(a) => a.nome}
          style={stili.lista}
          contentContainerStyle={stili.contenutoLista}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => {
            const scelto = ateneoSelezionato === item.nome;
            return (
              <Pressable
                onPress={() => impostaAteneo(item.nome)}
                style={[stili.voce, scelto && stili.voceSelezionata]}
              >
                <Text style={[stili.nome, scelto && stili.nomeSelezionato]} numberOfLines={2}>
                  {item.nome}
                </Text>
                <Text style={stili.citta}>{item.citta}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={stili.vuoto}>Nessun ateneo trovato per “{query}”.</Text>
          }
        />
      </View>
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  contenitore: {
    alignSelf: 'stretch',
    gap: spazi.sm,
    marginTop: spazi.sm,
  },
  lista: {
    maxHeight: 300,
  },
  contenutoLista: {
    gap: spazi.sm,
    paddingBottom: spazi.xs,
  },
  voce: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  // stato selezionato = elemento attivo: qui il viola è ammesso.
  voceSelezionata: {
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  nome: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '500',
  },
  nomeSelezionato: {
    color: colori.accento,
    fontWeight: '700',
  },
  citta: {
    color: colori.testoSecondario,
    fontSize: 12,
    marginTop: 2,
  },
  vuoto: {
    color: colori.testoSecondario,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spazi.md,
  },
});
