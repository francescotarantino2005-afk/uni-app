import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaStorico, inviaMessaggioChat } from '@/lib/chatDb';
import { MessaggioChat } from '@/lib/tipi';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

const SUGGERIMENTI = [
  'Come sto messo col libretto?',
  'Cosa ho da fare questa settimana?',
  'Che scadenze ho in arrivo?',
];

export default function SchermataChat() {
  const [messaggi, setMessaggi] = useState<MessaggioChat[]>([]);
  const [testo, setTesto] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const listaRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      setMessaggi(await caricaStorico());
      setCaricamento(false);
    })();
  }, []);

  // La lista è invertita (pattern standard delle chat): il messaggio più
  // recente resta sempre in fondo senza dipendere da scrollToEnd, che con la
  // virtualizzazione lasciava gli ultimi messaggi fuori dal render.
  const messaggiInvertiti = [...messaggi].reverse();

  const invia = async (contenuto: string) => {
    const msg = contenuto.trim();
    if (!msg || invio) return;
    setErrore(null);
    setTesto('');

    // messaggio dell'utente subito a schermo (ottimista)
    const provvisorio: MessaggioChat = { id: `local-${Date.now()}`, ruolo: 'user', contenuto: msg };
    setMessaggi((prima) => [...prima, provvisorio]);
    setInvio(true);

    const esito = await inviaMessaggioChat(msg);
    setInvio(false);

    if (esito.tipo === 'cap') {
      router.push('/cap-raggiunto');
      return;
    }
    if (esito.tipo === 'errore') {
      setErrore(esito.messaggio);
      return;
    }
    setMessaggi((prima) => [
      ...prima,
      { id: `local-a-${Date.now()}`, ruolo: 'assistant', contenuto: esito.risposta },
    ]);
  };

  const bolla = (m: MessaggioChat) => {
    const mio = m.ruolo === 'user';
    return (
      <View style={[stili.bolla, mio ? stili.bollaMia : stili.bollaAI]}>
        <Text style={[stili.testoBolla, mio && stili.testoBollaMia]}>{m.contenuto}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={stili.schermo} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {caricamento ? (
          <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
        ) : messaggi.length === 0 ? (
          <View style={stili.vuoto}>
            <View style={stili.cerchioIcona}>
              <Ionicons name="chatbubble-ellipses-outline" size={34} color={colori.accento} />
            </View>
            <Text style={stili.titoloVuoto}>Chiedimi quello che vuoi</Text>
            <Text style={stili.sottoVuoto}>
              Conosco il tuo orario, le tue scadenze e il tuo libretto. Prova con:
            </Text>
            <View style={stili.suggerimenti}>
              {SUGGERIMENTI.map((s) => (
                <Pressable key={s} style={stili.chipSugg} onPress={() => invia(s)}>
                  <Text style={stili.testoSugg}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listaRef}
            data={messaggiInvertiti}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={stili.lista}
            renderItem={({ item }) => bolla(item)}
          />
        )}

        {invio ? (
          <View style={stili.scrivendo}>
            <ActivityIndicator size="small" color={colori.testoSecondario} />
            <Text style={stili.testoScrivendo}>L'assistente sta scrivendo…</Text>
          </View>
        ) : null}

        <View style={stili.barraInput}>
          <MessaggioErrore messaggio={errore} />
          <View style={stili.rigaInput}>
            <TextInput
              style={stili.input}
              value={testo}
              onChangeText={setTesto}
              placeholder="Scrivi un messaggio…"
              placeholderTextColor={colori.testoSecondario}
              multiline
              editable={!invio}
            />
            <Pressable
              style={[stili.bottoneInvia, (!testo.trim() || invio) && stili.bottoneInviaOff]}
              onPress={() => invia(testo)}
              disabled={!testo.trim() || invio}
            >
              <Ionicons name="arrow-up" size={22} color="#0D0F14" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  vuoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spazi.xl,
    gap: spazi.sm,
  },
  cerchioIcona: {
    width: 76,
    height: 76,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spazi.sm,
  },
  titoloVuoto: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '800',
  },
  sottoVuoto: {
    color: colori.testoSecondario,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  suggerimenti: {
    gap: spazi.sm,
    marginTop: spazi.md,
    alignSelf: 'stretch',
  },
  chipSugg: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  testoSugg: {
    color: colori.testo,
    fontSize: 14,
    fontWeight: '500',
  },
  lista: {
    padding: spazi.md,
    gap: spazi.sm,
  },
  bolla: {
    maxWidth: '85%',
    borderRadius: raggi.lg,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  bollaMia: {
    alignSelf: 'flex-end',
    backgroundColor: colori.accento,
    borderBottomRightRadius: raggi.sm,
  },
  bollaAI: {
    alignSelf: 'flex-start',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderBottomLeftRadius: raggi.sm,
  },
  testoBolla: {
    color: colori.testo,
    fontSize: 15,
    lineHeight: 21,
  },
  testoBollaMia: {
    color: '#0D0F14',
    fontWeight: '500',
  },
  scrivendo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingHorizontal: spazi.md,
    paddingBottom: spazi.xs,
  },
  testoScrivendo: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  barraInput: {
    padding: spazi.md,
    paddingTop: spazi.sm,
    borderTopColor: colori.bordo,
    borderTopWidth: 1,
    gap: spazi.sm,
  },
  rigaInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spazi.sm,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
    color: colori.testo,
    fontSize: 15,
  },
  bottoneInvia: {
    width: 44,
    height: 44,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottoneInviaOff: {
    opacity: 0.4,
  },
});
