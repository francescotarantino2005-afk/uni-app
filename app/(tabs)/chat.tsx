import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaMessaggio, caricaStorico, inviaMessaggioChat, mantieniImpegno } from '@/lib/chatDb';
import { apriCoda, rispostaCoda } from '@/lib/codaDomande';
import {
  PASSO_CONTROLLO_MS,
  conMessaggio,
  faseAttesa,
  impegnoInSospeso,
  testoAttesa,
} from '@/lib/impegnoAttesa';
import { leggiImpegno } from '@/lib/dialogoLogica';
import { pose } from '@/lib/pose';
import { useAppStore } from '@/store/useAppStore';
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

  const storicoCaricato = useRef(false);
  const propostaInCorso = useRef(false);

  // Coda delle domande: quando lo studente apre la chat, il bot può riproporne
  // UNA rimasta in sospeso. Se e quale lo decide il server (una al giorno, mai
  // due di fila, niente se c'è un esame entro 48 ore); qui si evita solo la
  // chiamata quando in coda non c'è niente da fare.
  const proponiDomanda = useCallback(async () => {
    if (propostaInCorso.current || invioInCorso.current) return;
    // Prima la promessa di fine accoglienza: finché è in sospeso nessuna domanda.
    if (impegnoInSospeso(useAppStore.getState().profilo?.profilo_studio)) return;
    const coda = useAppStore.getState().profilo?.domande_in_coda;
    if (!Array.isArray(coda) || !coda.some((d) => d.stato === 'da_fare' && !d.in_attesa)) return;
    propostaInCorso.current = true;
    const domanda = await apriCoda();
    propostaInCorso.current = false;
    if (!domanda) return;
    setMessaggi((prima) => [...prima, { id: nuovoId(), ruolo: 'assistant', contenuto: domanda }]);
    useAppStore.getState().caricaProfilo();
  }, []);

  useEffect(() => {
    (async () => {
      setMessaggi(await caricaStorico());
      setCaricamento(false);
      storicoCaricato.current = true;
      proponiDomanda();
    })();
  }, [proponiDomanda]);

  // La tab resta montata: "aprire la chat" è ogni volta che torna in primo piano.
  useFocusEffect(
    useCallback(() => {
      if (storicoCaricato.current) proponiDomanda();
    }, [proponiDomanda])
  );

  // --- L'impegno preso a fine accoglienza ---
  // Il server scrive il messaggio che lo mantiene qualche secondo DOPO la
  // chiusura del dialogo, quando la chat può essere già aperta. Finché
  // profilo_studio.impegno è "da_mantenere" si mostra il personaggio che pensa
  // e si controlla ogni due secondi (solo in questo intervallo); dopo trenta
  // secondi l'attesa lascia il posto al bottone "Inizia".
  const profiloStudio = useAppStore((st) => st.profilo?.profilo_studio);
  const nomeBot = useAppStore((st) => st.profilo?.nome_bot) || 'Lode';
  const impegno = leggiImpegno(profiloStudio);
  const inSospeso = impegno?.stato === 'da_mantenere';
  const idMantenuto = impegno?.stato === 'mantenuto' ? impegno.messaggio_id ?? null : null;
  const [inizioAttesa, setInizioAttesa] = useState<number | null>(null);
  const [adesso, setAdesso] = useState(() => Date.now());
  const [avvioFallito, setAvvioFallito] = useState(false);
  const attesoImpegno = useRef(false);
  const fase = faseAttesa(inSospeso, inizioAttesa, adesso);

  /** Chiede alla chat di mantenere l'impegno adesso, poi rilegge il profilo. */
  const faiMantenere = useCallback(async (dalBottone: boolean) => {
    const esito = await mantieniImpegno();
    if (esito === 'in_corso') {
      // Un tentativo è già partito sul server: si torna ad aspettarlo.
      if (dalBottone) setInizioAttesa(Date.now());
      return;
    }
    await useAppStore.getState().caricaProfilo();
    if (dalBottone && esito !== 'mantenuto') setAvvioFallito(true);
  }, []);

  // Parte l'attesa: un primo tentativo subito (il server lo fa una volta sola e
  // non raddoppia quello già in corso), utile se la generazione era fallita.
  useEffect(() => {
    if (!inSospeso) {
      setInizioAttesa(null);
      return;
    }
    attesoImpegno.current = true;
    setAvvioFallito(false);
    setAdesso(Date.now());
    setInizioAttesa(Date.now());
    faiMantenere(false);
  }, [inSospeso, faiMantenere]);

  // Il controllo ogni due secondi, SOLO finché si sta aspettando.
  useEffect(() => {
    if (fase !== 'attesa') return;
    const giro = setInterval(() => {
      setAdesso(Date.now());
      useAppStore.getState().caricaProfilo();
    }, PASSO_CONTROLLO_MS);
    return () => clearInterval(giro);
  }, [fase, inizioAttesa]);

  // L'impegno è passato a "mantenuto": il messaggio compare da solo.
  useEffect(() => {
    if (!idMantenuto || !attesoImpegno.current) return;
    attesoImpegno.current = false;
    caricaMessaggio(idMantenuto).then((m) => {
      if (m) setMessaggi((prima) => conMessaggio(prima, m));
    });
  }, [idMantenuto]);

  const inizia = async () => {
    setAvvioFallito(false);
    setAdesso(Date.now());
    setInizioAttesa(Date.now()); // torna il personaggio che pensa mentre la chat scrive
    await faiMantenere(true);
  };

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

    // Se il bot aveva una domanda in sospeso, questo messaggio può esserne la
    // risposta: in quel caso la salva e conferma lui, senza passare dalla chat.
    const coda = useAppStore.getState().profilo?.domande_in_coda;
    if (Array.isArray(coda) && coda.some((d) => d.stato === 'da_fare' && d.in_attesa)) {
      const esitoCoda = await rispostaCoda(contenuto, id);
      if (esitoCoda) useAppStore.getState().caricaProfilo();
      if (esitoCoda?.tipo === 'risposta') {
        setInvio(false);
        invioInCorso.current = false;
        aggiorna(id, { statoInvio: undefined, erroreRete: undefined });
        setMessaggi((prima) => [
          ...prima,
          { id: nuovoId(), ruolo: 'assistant', contenuto: esitoCoda.risposta },
        ]);
        return;
      }
    }

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
    // Se c'era un impegno in sospeso, questa risposta può averlo mantenuto.
    if (impegnoInSospeso(useAppStore.getState().profilo?.profilo_studio)) {
      useAppStore.getState().caricaProfilo();
    }
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

        {fase === 'attesa' && impegno ? (
          <View style={stili.attesa}>
            <Image source={pose.pensa} style={stili.personaggioAttesa} resizeMode="contain" />
            <View style={stili.fumettoAttesa}>
              <ActivityIndicator size="small" color={colori.accento} />
              <Text style={stili.testoAttesa}>{testoAttesa(nomeBot, impegno.testo)}</Text>
            </View>
          </View>
        ) : fase === 'bottone' ? (
          <View style={stili.attesa}>
            <Image source={pose.guarda} style={stili.personaggioAttesa} resizeMode="contain" />
            <View style={{ flex: 1, gap: spazi.xs }}>
              {avvioFallito ? (
                <Text style={stili.testoErrore}>Non ci sono riuscito: riprova tra un attimo.</Text>
              ) : null}
              <Pressable
                style={stili.bottoneInizia}
                onPress={inizia}
                accessibilityRole="button"
                accessibilityLabel="Inizia"
              >
                <Text style={stili.testoInizia}>Inizia</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
              <Ionicons name="arrow-up" size={22} color={colori.sfondo} />
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
    color: colori.sfondo,
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
  attesa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingHorizontal: spazi.md,
    paddingBottom: spazi.sm,
  },
  personaggioAttesa: {
    width: 72,
    height: 72,
  },
  fumettoAttesa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoAttesa: {
    flex: 1,
    color: colori.testo,
    fontSize: 14,
    lineHeight: 20,
  },
  bottoneInizia: {
    alignSelf: 'flex-start',
    backgroundColor: colori.accento,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.xl,
  },
  testoInizia: {
    color: colori.sfondo,
    fontSize: 15,
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
