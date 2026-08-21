import { useEffect, useRef, useState } from 'react';
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
import { nuovoId } from '@/lib/id';
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
  const listaRef = useRef<FlatList>(null);
  // Guardia contro il doppio invio mentre una richiesta è già in corso.
  const invioInCorso = useRef(false);

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

  const aggiorna = (id: string, patch: Partial<MessaggioChat>) =>
    setMessaggi((prima) => prima.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // Routine di invio condivisa da primo invio e retry: usa SEMPRE lo stesso id.
  const esegui = async (id: string, contenuto: string) => {
    if (invioInCorso.current) return;
    invioInCorso.current = true;
    setInvio(true);

    const esito = await inviaMessaggioChat(contenuto, id);

    setInvio(false);
    invioInCorso.current = false;

    if (esito.tipo === 'cap') {
      aggiorna(id, { statoInvio: undefined, erroreRete: undefined });
      router.push('/cap-raggiunto');
      return;
    }
    if (esito.tipo === 'errore') {
      // L'errore vive in uno stato separato SOTTO la bolla, mai dentro `contenuto`.
      aggiorna(id, { statoInvio: 'errore', erroreRete: esito.messaggio });
      return;
    }
    aggiorna(id, { statoInvio: undefined, erroreRete: undefined });
    setMessaggi((prima) => [
      ...prima,
      { id: nuovoId(), ruolo: 'assistant', contenuto: esito.risposta },
    ]);
  };

  const invia = (contenuto: string) => {
    const msg = contenuto.trim();
    if (!msg || invioInCorso.current) return;
    setTesto('');
    // id generato UNA sola volta, alla composizione.
    const id = nuovoId();
    setMessaggi((prima) => [...prima, { id, ruolo: 'user', contenuto: msg, statoInvio: 'inviando' }]);
    esegui(id, msg);
  };

  const riprova = (id: string) => {
    if (invioInCorso.current) return;
    const m = messaggi.find((x) => x.id === id);
    if (!m) return;
    // Stesso id, stesso testo: il server upserta sulla chiave → nessun duplicato.
    aggiorna(id, { statoInvio: 'inviando', erroreRete: undefined });
    esegui(id, m.contenuto);
  };

  const renderMessaggio = (m: MessaggioChat) => {
    const mio = m.ruolo === 'user';
    return (
      <View style={mio ? stili.gruppoMio : stili.gruppoAI}>
        <View style={[stili.bolla, mio ? stili.bollaMia : stili.bollaAI]}>
          <Text style={[stili.testoBolla, mio && stili.testoBollaMia]}>{m.contenuto}</Text>
        </View>
        {mio && m.statoInvio === 'errore' ? (
          <View style={stili.rigaErrore}>
            <Ionicons name="alert-circle-outline" size={14} color={colori.errore} />
            <Text style={stili.testoErrore}>{m.erroreRete}</Text>
            <Pressable onPress={() => riprova(m.id)} hitSlop={8}>
              <Text style={stili.riprova}>Riprova</Text>
            </Pressable>
          </View>
        ) : null}
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
            renderItem={({ item }) => renderMessaggio(item)}
          />
        )}

        {invio ? (
          <View style={stili.scrivendo}>
            <ActivityIndicator size="small" color={colori.testoSecondario} />
            <Text style={stili.testoScrivendo}>L'assistente sta scrivendo…</Text>
          </View>
        ) : null}

        <View style={stili.barraInput}>
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
  gruppoMio: {
    alignItems: 'flex-end',
    gap: spazi.xs,
  },
  gruppoAI: {
    alignItems: 'flex-start',
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
  rigaErrore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    paddingHorizontal: spazi.xs,
  },
  testoErrore: {
    color: colori.errore,
    fontSize: 12,
    flexShrink: 1,
  },
  riprova: {
    color: colori.accento,
    fontSize: 12,
    fontWeight: '700',
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
