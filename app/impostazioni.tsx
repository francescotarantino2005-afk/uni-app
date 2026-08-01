import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { BadgeBeta } from '@/components/BadgeBeta';
import { colori, raggi, spazi } from '@/lib/theme';

const NOME_APP = 'Assistente Studente';

type Voce = {
  icona: keyof typeof Ionicons.glyphMap;
  titolo: string;
  sottotitolo: string;
  rotta: '/preferenze' | '/in-arrivo';
};

const VOCI: Voce[] = [
  {
    icona: 'sunny-outline',
    titolo: 'Il briefing del mattino',
    sottotitolo: 'Scegli a che ora ricevere la tua giornata',
    rotta: '/preferenze',
  },
  {
    icona: 'sparkles-outline',
    titolo: 'In arrivo',
    sottotitolo: 'Le funzioni su cui stiamo lavorando',
    rotta: '/in-arrivo',
  },
];

export default function SchermataImpostazioni() {
  const profilo = useAppStore((s) => s.profilo);

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Impostazioni</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={stili.contenuto}>
        <View style={stili.testata}>
          <View style={stili.rigaNome}>
            <Text style={stili.nomeApp}>{NOME_APP}</Text>
            <BadgeBeta />
          </View>
          {profilo?.ateneo ? <Text style={stili.ateneo}>{profilo.ateneo}</Text> : null}
        </View>

        <View style={stili.lista}>
          {VOCI.map((v) => (
            <Pressable key={v.rotta} style={stili.voce} onPress={() => router.push(v.rotta)}>
              <Ionicons name={v.icona} size={22} color={colori.accento} />
              <View style={{ flex: 1 }}>
                <Text style={stili.voceTitolo}>{v.titolo}</Text>
                <Text style={stili.voceSottotitolo}>{v.sottotitolo}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colori.testoSecondario} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colori.sfondo },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: { color: colori.testo, fontSize: 20, fontWeight: '800' },
  contenuto: { padding: spazi.lg, paddingTop: spazi.sm, gap: spazi.lg },
  testata: { gap: spazi.xs },
  rigaNome: { flexDirection: 'row', alignItems: 'center', gap: spazi.sm },
  nomeApp: { color: colori.testo, fontSize: 22, fontWeight: '800' },
  ateneo: { color: colori.testoSecondario, fontSize: 14 },
  lista: { gap: spazi.sm },
  voce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  voceTitolo: { color: colori.testo, fontSize: 16, fontWeight: '700' },
  voceSottotitolo: { color: colori.testoSecondario, fontSize: 13, marginTop: 2 },
});
