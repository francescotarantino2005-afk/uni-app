import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useNavigation } from 'expo-router';
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
import { pose, type Posa } from '@/lib/pose';
import { posaPerRisposta } from '@/lib/posaRisposta';
import {
  bozza,
  eBozza,
  sottotitoloChat,
  titoloDaMessaggio,
  type Conversazione,
  type EsameBarra,
} from '@/lib/conversazioni';
import {
  caricaConversazioni,
  caricaEsamiBarra,
  eliminaConversazione,
  nuovaConversazione,
  rinominaConversazione,
} from '@/lib/conversazioniDb';
import { useAppStore } from '@/store/useAppStore';
import { MessaggioChat } from '@/lib/tipi';
import { nuovoId } from '@/lib/id';
import { coloriChat, fontChat, spazi } from '@/lib/theme';
import { TestoMessaggio } from '@/components/TestoMessaggio';
import { AvatarLode } from '@/components/AvatarLode';
import { BarraConversazioni } from '@/components/BarraConversazioni';

const SUGGERIMENTI = [
  'Come sto messo col libretto?',
  'Cosa ho da fare questa settimana?',
  'Che scadenze ho in arrivo?',
];
const suggerimentiEsame = (materia: string) => [
  `Interrogami su ${materia}`,
  'Fammi tre esercizi per cominciare',
  'Mi fai un piano fino all\'esame?',
];

/** Un messaggio sullo schermo: in più, la risposta che si sta aspettando. */
type Riga = MessaggioChat & { inAttesa?: boolean };

/** Margine laterale della pagina: le risposte di Lode si leggono come un foglio. */
const MARGINE = 20;
/** Spazio verticale tra un messaggio e l'altro. */
const SPAZIO_MESSAGGI = 16;
const ENTRATA_MS = 220;

/**
 * Un messaggio appena arrivato entra con una breve dissolvenza. SOLO i messaggi
 * nuovi di questa sessione, e una volta sola: la FlatList smonta e rimonta le
 * righe che escono e rientrano nello schermo, e chi rientra non deve
 * riapparire sbiadito. L'id si toglie dall'elenco appena l'animazione parte.
 */
function Entrata({ id, daAnimare, children }: { id: string; daAnimare: Set<string>; children: React.ReactNode }) {
  const [anima] = useState(() => daAnimare.has(id));
  const opacita = useRef(new Animated.Value(anima ? 0 : 1)).current;
  useEffect(() => {
    if (!anima) return;
    daAnimare.delete(id);
    Animated.timing(opacita, { toValue: 1, duration: ENTRATA_MS, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!anima) return <>{children}</>;
  return <Animated.View style={{ opacity: opacita }}>{children}</Animated.View>;
}

export default function SchermataChat() {
  const navigation = useNavigation();
  const { width: larghezzaSchermo } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [messaggi, setMessaggi] = useState<Riga[]>([]);
  // Gli id dei messaggi nati in questa sessione che devono ancora fare l'entrata.
  const daAnimare = useRef(new Set<string>()).current;
  const [testo, setTesto] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [invio, setInvio] = useState(false);
  const listaRef = useRef<FlatList>(null);
  // Guardia contro il doppio invio mentre una richiesta è già in corso.
  const invioInCorso = useRef(false);

  const storicoCaricato = useRef(false);
  const propostaInCorso = useRef(false);

  // --- Spazi per esame: conversazioni e barra laterale ---
  const [conversazioni, setConversazioni] = useState<Conversazione[]>([]);
  const [esami, setEsami] = useState<EsameBarra[]>([]);
  const [corrente, setCorrente] = useState<Conversazione | null>(null);
  const [barraAperta, setBarraAperta] = useState(false);
  const correnteRef = useRef<Conversazione | null>(null);
  correnteRef.current = corrente;
  // Le cose della "Generale" (domande in coda, impegno di fine accoglienza)
  // succedono solo lì. Una chat nuova non ancora salvata (bozza) non è la Generale.
  const inGenerale = !corrente || corrente.generale;
  const inGeneraleRef = useRef(inGenerale);
  inGeneraleRef.current = inGenerale;
  const esameCorrente = corrente?.exam_id ? esami.find((e) => e.id === corrente.exam_id) ?? null : null;

  const ricaricaBarra = useCallback(async () => {
    const [c, e] = await Promise.all([caricaConversazioni(), caricaEsamiBarra()]);
    setConversazioni(c);
    setEsami(e);
    return c;
  }, []);

  // Coda delle domande: quando lo studente apre la chat, il bot può riproporne
  // UNA rimasta in sospeso. Se e quale lo decide il server (una al giorno, mai
  // due di fila, niente se c'è un esame entro 48 ore); qui si evita solo la
  // chiamata quando in coda non c'è niente da fare. Solo nella "Generale".
  const proponiDomanda = useCallback(async () => {
    if (propostaInCorso.current || invioInCorso.current || !inGeneraleRef.current) return;
    // Prima la promessa di fine accoglienza: finché è in sospeso nessuna domanda.
    if (impegnoInSospeso(useAppStore.getState().profilo?.profilo_studio)) return;
    const coda = useAppStore.getState().profilo?.domande_in_coda;
    if (!Array.isArray(coda) || !coda.some((d) => d.stato === 'da_fare' && !d.in_attesa)) return;
    propostaInCorso.current = true;
    const domanda = await apriCoda();
    propostaInCorso.current = false;
    if (!domanda || !inGeneraleRef.current) return;
    const idDomanda = nuovoId();
    daAnimare.add(idDomanda);
    setMessaggi((prima) => [...prima, { id: idDomanda, ruolo: 'assistant', contenuto: domanda }]);
    useAppStore.getState().caricaProfilo();
  }, [daAnimare]);

  // All'avvio: le conversazioni, poi la "Generale".
  useEffect(() => {
    (async () => {
      const c = await ricaricaBarra();
      const generale = c.find((x) => x.generale) ?? null;
      setCorrente(generale);
      setMessaggi(await caricaStorico(generale));
      setCaricamento(false);
      storicoCaricato.current = true;
      proponiDomanda();
    })();
  }, [proponiDomanda, ricaricaBarra]);

  // La tab resta montata: "aprire la chat" è ogni volta che torna in primo piano.
  useFocusEffect(
    useCallback(() => {
      if (storicoCaricato.current) {
        proponiDomanda();
        ricaricaBarra();
      }
    }, [proponiDomanda, ricaricaBarra])
  );

  const apri = useCallback(async (c: Conversazione) => {
    setBarraAperta(false);
    if (c.id === correnteRef.current?.id) return;
    daAnimare.clear();
    setCorrente(c);
    setCaricamento(true);
    setMessaggi(await caricaStorico(c));
    setCaricamento(false);
    if (c.generale) proponiDomanda();
  }, [proponiDomanda, daAnimare]);

  // "Nuova chat" apre una bozza: si salva solo al primo messaggio (in `esegui`),
  // così nella barra non restano chat vuote.
  const nuova = useCallback((examId: string | null) => {
    setBarraAperta(false);
    const c = correnteRef.current;
    if (eBozza(c) && c?.exam_id === examId) return;
    daAnimare.clear();
    setCorrente(bozza(examId));
    setMessaggi([]);
    setCaricamento(false);
  }, [daAnimare]);

  const rinomina = useCallback(async (c: Conversazione, titolo: string) => {
    const ok = await rinominaConversazione(c.id, titolo);
    if (ok) {
      await ricaricaBarra();
      if (correnteRef.current?.id === c.id) setCorrente({ ...c, titolo });
    }
    return ok;
  }, [ricaricaBarra]);

  const elimina = useCallback(async (c: Conversazione) => {
    const ok = await eliminaConversazione(c.id);
    if (!ok) return false;
    const elenco = await ricaricaBarra();
    if (correnteRef.current?.id === c.id) {
      const generale = elenco.find((x) => x.generale);
      if (generale) {
        setCorrente(generale);
        setMessaggi(await caricaStorico(generale));
      }
    }
    return true;
  }, [ricaricaBarra]);

  // Scorrendo dal bordo sinistro si apre la barra.
  const bordo = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 40) setBarraAperta(true);
      },
    })
  ).current;

  // --- L'impegno preso a fine accoglienza (solo nella "Generale") ---
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

  // L'impegno è passato a "mantenuto": il messaggio compare da solo (nella Generale).
  useEffect(() => {
    if (!idMantenuto || !attesoImpegno.current) return;
    attesoImpegno.current = false;
    caricaMessaggio(idMantenuto).then((m) => {
      if (!m || !inGeneraleRef.current) return;
      daAnimare.add(m.id);
      setMessaggi((prima) => conMessaggio(prima, m));
    });
  }, [idMantenuto, daAnimare]);

  const inizia = async () => {
    setAvvioFallito(false);
    setAdesso(Date.now());
    setInizioAttesa(Date.now()); // torna il personaggio che pensa mentre la chat scrive
    await faiMantenere(true);
  };

  // La lista è invertita (pattern standard delle chat): il messaggio più
  // recente resta sempre in fondo senza dipendere da scrollToEnd, che con la
  // virtualizzazione lasciava gli ultimi messaggi fuori dal render.
  const messaggiInvertiti = useMemo(() => [...messaggi].reverse(), [messaggi]);
  // Il robot sta accanto all'ultima risposta (o a quella che si sta aspettando).
  const idUltimaRisposta = messaggiInvertiti.find((m) => m.ruolo === 'assistant')?.id ?? null;

  /** La posa per una risposta: guarda, esulta per i voti alti, vicino nei momenti difficili. */
  const posaDi = (m: Riga): Posa => {
    if (m.inAttesa) return 'pensa';
    const i = messaggi.findIndex((x) => x.id === m.id);
    const domanda = [...messaggi.slice(0, i)].reverse().find((x) => x.ruolo === 'user')?.contenuto ?? null;
    return posaPerRisposta(m.contenuto, domanda);
  };

  // La posa dell'intestazione: pensa mentre aspetta (una risposta o l'impegno),
  // altrimenti quella dell'ultima risposta; a riposo guarda.
  const ultimaRisposta = messaggiInvertiti.find((m) => m.ruolo === 'assistant') ?? null;
  const posaIntestazione: Posa =
    (inGenerale && fase === 'attesa') || ultimaRisposta?.inAttesa
      ? 'pensa'
      : ultimaRisposta
        ? posaDi(ultimaRisposta)
        : 'guarda';

  // Intestazione: la barra si apre dall'icona; al centro la testa del robot, il
  // nome del bot e la conversazione aperta; a destra "nuova chat".
  const sottotitolo = sottotitoloChat(corrente, esameCorrente?.materia ?? null);
  const posaHeader = posaIntestazione;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: coloriChat.sfondo },
      headerTitleAlign: 'left',
      headerTitle: () => <IntestazioneChat posa={posaHeader} nome={nomeBot} sottotitolo={sottotitolo} />,
      headerLeft: () => (
        <Pressable
          onPress={() => setBarraAperta(true)}
          hitSlop={10}
          style={{ paddingHorizontal: spazi.md }}
          accessibilityRole="button"
          accessibilityLabel="Le tue chat"
        >
          <Ionicons name="menu" size={24} color={coloriChat.testo} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => nuova(correnteRef.current?.exam_id ?? null)}
          hitSlop={10}
          style={{ paddingHorizontal: spazi.md }}
          accessibilityRole="button"
          accessibilityLabel="Nuova chat"
        >
          <Ionicons name="create-outline" size={23} color={coloriChat.viola} />
        </Pressable>
      ),
    });
  }, [navigation, nuova, posaHeader, nomeBot, sottotitolo]);

  const aggiorna = (id: string, patch: Partial<Riga>) =>
    setMessaggi((prima) => prima.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const togli = (id: string) => setMessaggi((prima) => prima.filter((m) => m.id !== id));

  // Routine di invio condivisa da primo invio e retry: usa SEMPRE lo stesso id.
  const esegui = async (id: string, contenuto: string) => {
    if (invioInCorso.current) return;
    invioInCorso.current = true;
    setInvio(true);
    let conv = correnteRef.current;

    // Chat nuova: si salva adesso, al primo messaggio, col titolo preso dal messaggio.
    if (conv && eBozza(conv)) {
      const salvata = await nuovaConversazione(conv.exam_id, titoloDaMessaggio(contenuto));
      if (!salvata) {
        setInvio(false);
        invioInCorso.current = false;
        aggiorna(id, { statoInvio: 'errore', erroreRete: 'Non sono riuscito ad aprire la chat. Controlla la connessione e riprova.' });
        return;
      }
      if (correnteRef.current === conv) {
        correnteRef.current = salvata;
        setCorrente(salvata);
      }
      conv = salvata;
    }

    // Se il bot aveva una domanda in sospeso, questo messaggio può esserne la
    // risposta: in quel caso la salva e conferma lui, senza passare dalla chat.
    const coda = useAppStore.getState().profilo?.domande_in_coda;
    if (inGeneraleRef.current && Array.isArray(coda) && coda.some((d) => d.stato === 'da_fare' && d.in_attesa)) {
      const esitoCoda = await rispostaCoda(contenuto, id);
      if (esitoCoda) useAppStore.getState().caricaProfilo();
      if (esitoCoda?.tipo === 'risposta') {
        setInvio(false);
        invioInCorso.current = false;
        aggiorna(id, { statoInvio: undefined, erroreRete: undefined });
        const idRispostaCoda = nuovoId();
        daAnimare.add(idRispostaCoda);
        setMessaggi((prima) => [...prima, { id: idRispostaCoda, ruolo: 'assistant', contenuto: esitoCoda.risposta }]);
        return;
      }
    }

    // La risposta attesa ha già il suo posto (e il suo id): il robot "pensa" lì
    // e, quando arriva, cambia posa con una dissolvenza.
    const idRisposta = nuovoId();
    daAnimare.add(idRisposta);
    setMessaggi((prima) => [...prima, { id: idRisposta, ruolo: 'assistant', contenuto: '', inAttesa: true }]);

    const esito = await inviaMessaggioChat(contenuto, id, conv?.id ?? null);

    setInvio(false);
    invioInCorso.current = false;

    if (esito.tipo === 'ok') {
      aggiorna(id, { statoInvio: undefined, erroreRete: undefined });
      aggiorna(idRisposta, { contenuto: esito.risposta, inAttesa: false });
      ricaricaBarra(); // la conversazione sale in cima, e prende il titolo al primo messaggio
      // Se c'era un impegno in sospeso, questa risposta può averlo mantenuto.
      if (impegnoInSospeso(useAppStore.getState().profilo?.profilo_studio)) {
        useAppStore.getState().caricaProfilo();
      }
      return;
    }
    togli(idRisposta);
    if (esito.tipo === 'cap') {
      aggiorna(id, { statoInvio: undefined, erroreRete: undefined });
      router.push('/cap-raggiunto');
      return;
    }
    if (esito.tipo === 'conversazione_sparita') {
      aggiorna(id, { statoInvio: 'errore', erroreRete: 'Questa chat è stata eliminata.' });
      const elenco = await ricaricaBarra();
      const generale = elenco.find((x) => x.generale);
      if (generale) apri(generale);
      return;
    }
    // L'errore vive in uno stato separato SOTTO la bolla, mai dentro `contenuto`.
    aggiorna(id, { statoInvio: 'errore', erroreRete: esito.messaggio });
  };

  const invia = (contenuto: string) => {
    const msg = contenuto.trim();
    if (!msg || invioInCorso.current) return;
    setTesto('');
    // id generato UNA sola volta, alla composizione.
    const id = nuovoId();
    daAnimare.add(id);
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

  const larghezzaBolla = Math.round(larghezzaSchermo * 0.85);

  const renderMessaggio = (m: Riga) => {
    if (m.ruolo === 'user') {
      return (
        <View style={stili.gruppoMio}>
          <View style={[stili.bollaMia, { maxWidth: larghezzaBolla }]}>
            <Text style={stili.testoMio} selectable>
              {m.contenuto}
            </Text>
          </View>
          {m.statoInvio === 'errore' ? (
            <View style={stili.rigaErrore}>
              <Ionicons name="alert-circle-outline" size={14} color={coloriChat.errore} />
              <Text style={stili.testoErrore}>{m.erroreRete}</Text>
              <Pressable onPress={() => riprova(m.id)} hitSlop={8}>
                <Text style={stili.riprova}>Riprova</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    }
    // Le risposte di Lode non stanno in una bolla: sono testo sulla pagina, a
    // tutta larghezza. Sopra l'ultima, il robot (48) nella posa del momento.
    const conRobot = m.id === idUltimaRisposta;
    return (
      <View style={stili.gruppoLode}>
        {conRobot ? <AvatarLode posa={posaDi(m)} lato={48} /> : null}
        {m.inAttesa ? (
          <View style={stili.pensa}>
            <ActivityIndicator size="small" color={coloriChat.viola} />
            <Text style={stili.testoPensa}>{nomeBot} sta pensando…</Text>
          </View>
        ) : (
          <TestoMessaggio testo={m.contenuto} />
        )}
      </View>
    );
  };

  const suggerimenti = esameCorrente ? suggerimentiEsame(esameCorrente.materia) : SUGGERIMENTI;

  return (
    <SafeAreaView style={stili.schermo} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + (Platform.OS === 'ios' ? 44 : 56)}
      >
        {caricamento ? (
          <ActivityIndicator color={coloriChat.viola} style={{ marginTop: spazi.xl }} />
        ) : messaggi.length === 0 ? (
          <View style={stili.vuoto}>
            <Image source={pose.guarda} style={stili.robotVuoto} resizeMode="contain" />
            <Text style={stili.titoloVuoto}>
              {esameCorrente ? `Lavoriamo su ${esameCorrente.materia}` : 'Chiedimi quello che vuoi'}
            </Text>
            <Text style={stili.sottoVuoto}>
              {esameCorrente
                ? 'Questa chat è dedicata a questo esame. Mi ricordo quello che so di te anche qui.'
                : 'Conosco il tuo orario, le tue scadenze e il tuo libretto. Prova con:'}
            </Text>
            <View style={stili.suggerimenti}>
              {suggerimenti.map((s) => (
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
            ItemSeparatorComponent={Separatore}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Entrata id={item.id} daAnimare={daAnimare}>
                {renderMessaggio(item)}
              </Entrata>
            )}
          />
        )}

        {inGenerale && fase === 'attesa' && impegno ? (
          <View style={stili.attesa}>
            <Image source={pose.pensa} style={stili.personaggioAttesa} resizeMode="contain" />
            <View style={stili.fumettoAttesa}>
              <ActivityIndicator size="small" color={coloriChat.viola} />
              <Text style={stili.testoAttesa}>{testoAttesa(nomeBot, impegno.testo)}</Text>
            </View>
          </View>
        ) : inGenerale && fase === 'bottone' ? (
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

        <View style={stili.barraInput}>
          <View style={stili.rigaInput}>
            <TextInput
              style={stili.input}
              value={testo}
              onChangeText={setTesto}
              placeholder="Scrivi un messaggio…"
              placeholderTextColor={coloriChat.testoSecondario}
              multiline
              editable={!invio}
            />
            <Pressable
              style={[stili.bottoneInvia, (!testo.trim() || invio) && stili.bottoneInviaOff]}
              onPress={() => invia(testo)}
              disabled={!testo.trim() || invio}
              accessibilityRole="button"
              accessibilityLabel="Invia"
            >
              <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Il bordo sinistro: scorrendo verso destra si aprono le chat. */}
      <View style={stili.bordoSinistro} {...bordo.panHandlers} />

      <BarraConversazioni
        visibile={barraAperta}
        onChiudi={() => setBarraAperta(false)}
        conversazioni={conversazioni}
        esami={esami}
        correnteId={corrente?.id ?? null}
        onScegli={apri}
        onNuova={nuova}
        onRinomina={rinomina}
        onElimina={elimina}
      />
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: coloriChat.sfondo,
  },
  vuoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spazi.xl,
    gap: spazi.sm,
  },
  robotVuoto: {
    width: 132,
    height: 132,
    marginBottom: spazi.xs,
  },
  titoloVuoto: {
    color: coloriChat.testo,
    fontFamily: fontChat.grassetto,
    fontSize: 24,
    textAlign: 'center',
  },
  sottoVuoto: {
    color: coloriChat.testoSecondario,
    fontFamily: fontChat.testo,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 320,
  },
  suggerimenti: {
    gap: spazi.sm,
    marginTop: spazi.md,
    alignSelf: 'stretch',
  },
  chipSugg: {
    backgroundColor: coloriChat.superficie,
    borderColor: coloriChat.bordo,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  testoSugg: {
    color: coloriChat.testo,
    fontFamily: fontChat.testo,
    fontSize: 17,
  },
  lista: {
    paddingHorizontal: MARGINE,
    paddingVertical: SPAZIO_MESSAGGI,
  },
  separatore: {
    height: SPAZIO_MESSAGGI,
  },
  gruppoMio: {
    alignItems: 'flex-end',
    gap: spazi.xs,
  },
  gruppoLode: {
    alignSelf: 'stretch',
    gap: spazi.sm,
  },
  bollaMia: {
    backgroundColor: coloriChat.bollaStudente,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  testoMio: {
    color: coloriChat.testo,
    fontFamily: fontChat.testo,
    fontSize: fontChat.dimensione,
    lineHeight: fontChat.interlinea,
  },
  pensa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: 2,
  },
  testoPensa: {
    color: coloriChat.testoSecondario,
    fontFamily: fontChat.corsivo,
    fontSize: 17,
  },
  rigaErrore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    paddingHorizontal: spazi.xs,
  },
  testoErrore: {
    color: coloriChat.errore,
    fontSize: 12,
    flexShrink: 1,
  },
  riprova: {
    color: coloriChat.viola,
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
    backgroundColor: coloriChat.superficie,
    borderColor: coloriChat.bordo,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoAttesa: {
    flex: 1,
    color: coloriChat.testo,
    fontFamily: fontChat.testo,
    fontSize: 17,
    lineHeight: 23,
  },
  bottoneInizia: {
    alignSelf: 'flex-start',
    backgroundColor: coloriChat.viola,
    borderRadius: 999,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.xl,
  },
  testoInizia: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  barraInput: {
    padding: spazi.md,
    paddingTop: spazi.sm,
    borderTopColor: coloriChat.bordo,
    borderTopWidth: 1,
    backgroundColor: coloriChat.sfondo,
  },
  rigaInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spazi.sm,
  },
  input: {
    flex: 1,
    maxHeight: 140,
    backgroundColor: coloriChat.superficie,
    borderColor: coloriChat.bordo,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: spazi.md,
    color: coloriChat.testo,
    fontFamily: fontChat.testo,
    fontSize: 18,
  },
  bottoneInvia: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: coloriChat.viola,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottoneInviaOff: {
    opacity: 0.4,
  },
  bordoSinistro: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 90,
    width: 18,
  },
});

function Separatore() {
  return <View style={stili.separatore} />;
}

/** L'intestazione della chat: la testa del robot, il nome del bot, la conversazione aperta. */
function IntestazioneChat({ posa, nome, sottotitolo }: { posa: Posa; nome: string; sottotitolo: string }) {
  return (
    <View style={stiliIntestazione.riga} accessibilityRole="header" accessibilityLabel={`${nome}, ${sottotitolo}`}>
      <AvatarLode posa={posa} lato={32} />
      <View style={stiliIntestazione.testi}>
        <Text style={stiliIntestazione.nome} numberOfLines={1}>
          {nome}
        </Text>
        <Text style={stiliIntestazione.sottotitolo} numberOfLines={1}>
          {sottotitolo}
        </Text>
      </View>
    </View>
  );
}

const stiliIntestazione = StyleSheet.create({
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    flexShrink: 1,
  },
  testi: {
    flexShrink: 1,
  },
  nome: {
    color: coloriChat.testo,
    fontFamily: fontChat.grassetto,
    fontSize: 18,
    lineHeight: 21,
  },
  sottotitolo: {
    color: coloriChat.testoSecondario,
    fontSize: 12,
    lineHeight: 15,
  },
});
