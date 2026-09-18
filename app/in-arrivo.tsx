import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BadgeBeta } from '@/components/BadgeBeta';
import { colori, raggi, spazi } from '@/lib/theme';

// Canale feedback: per ora la mail del fondatore. Sostituibile in un punto solo
// con un link WhatsApp/Telegram/form quando il canale definitivo sarà pronto.
const CANALE_FEEDBACK =
  'mailto:supportolode@gmail.com?subject=Feedback%20app%20(beta)';

type Stato = 'In sviluppo' | 'In progettazione' | 'Quasi pronto';

const COLORE_STATO: Record<Stato, string> = {
  'Quasi pronto': colori.successo,
  'In sviluppo': colori.testoSecondario,
  'In progettazione': colori.testoSecondario,
};

const VOCI: { titolo: string; testo: string; stato: Stato }[] = [
  {
    titolo: 'Assistente preparazione esami',
    testo:
      'Un tutor AI che conosce il linguaggio della tua disciplina: strategie di studio sul tuo manuale, spiegazioni, ripasso guidato.',
    stato: 'In sviluppo',
  },
  {
    titolo: 'Il tuo manuale nell’app',
    testo:
      'Inserisci il codice ISBN e l’app riconosce il tuo libro: capitoli, edizione, struttura. Il piano di studio si costruisce sui capitoli veri.',
    stato: 'In progettazione',
  },
  {
    titolo: 'Notifiche intelligenti',
    testo: 'Promemoria su sessioni, scadenze e ripassi, anche ad app chiusa.',
    stato: 'Quasi pronto',
  },
  {
    titolo: 'Scadenze regionali automatiche',
    testo:
      'Borse DSU, ISEE, tasse: le date del tuo ateneo e della tua regione, senza cercarle.',
    stato: 'In sviluppo',
  },
];

export default function SchermataInArrivo() {
  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>In arrivo</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={stili.contenuto}>
        <Text style={stili.sottotitolo}>
          Su cosa stiamo lavorando. Nessuna promessa di date: solo dove sta andando l’app.
        </Text>

        <View style={stili.lista}>
          {VOCI.map((v) => (
            <View key={v.titolo} style={stili.card}>
              <View style={stili.cardTesta}>
                <Text style={stili.cardTitolo}>{v.titolo}</Text>
                <View style={[stili.pill, { borderColor: COLORE_STATO[v.stato] }]}>
                  <Text style={[stili.pillTesto, { color: COLORE_STATO[v.stato] }]}>{v.stato}</Text>
                </View>
              </View>
              <Text style={stili.cardTesto}>{v.testo}</Text>
            </View>
          ))}
        </View>

        <View style={stili.blocoBeta}>
          <BadgeBeta />
          <Text style={stili.testoBeta}>
            Questa è una beta. L’app cresce ogni settimana, e le priorità le decidono gli
            studenti che la usano: dimmi cosa ti manca.
          </Text>
          <Pressable style={stili.bottoneFeedback} onPress={() => Linking.openURL(CANALE_FEEDBACK)}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colori.accento} />
            <Text style={stili.testoFeedback}>Mandami un feedback</Text>
          </Pressable>
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
  sottotitolo: { color: colori.testoSecondario, fontSize: 14, lineHeight: 21 },
  lista: { gap: spazi.md },
  card: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
    gap: spazi.sm,
  },
  cardTesta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spazi.sm,
  },
  cardTitolo: { flex: 1, color: colori.testo, fontSize: 16, fontWeight: '700' },
  pill: {
    borderWidth: 1,
    borderRadius: raggi.pieno,
    paddingHorizontal: spazi.sm,
    paddingVertical: 2,
  },
  pillTesto: { fontSize: 11, fontWeight: '700' },
  cardTesto: { color: colori.testoSecondario, fontSize: 14, lineHeight: 21 },
  blocoBeta: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    gap: spazi.sm,
  },
  testoBeta: { color: colori.testo, fontSize: 15, lineHeight: 22 },
  bottoneFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.sm,
    marginTop: spazi.xs,
    paddingVertical: spazi.md,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  testoFeedback: { color: colori.accento, fontSize: 15, fontWeight: '700' },
});
