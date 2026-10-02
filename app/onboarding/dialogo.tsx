import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaEsami } from '@/lib/esamiDb';
import { calcolaLibretto, sostenuto } from '@/lib/libretto';
import { turnoDialogo } from '@/lib/dialogoAccoglienza';
import {
  Chiave,
  DOMANDE_FISSE,
  EsitoTurno,
  MAX_DOMANDE,
  Messaggio,
  ProfiloStudio,
  RiassuntoLibretto,
  allineaCoda,
  apertura,
  chiesteDalleNote,
  conversazioneDalleNote,
  profiloCompleto,
  prossimaChiave,
  turnoDiRipiego,
  turnoSaltato,
} from '@/lib/dialogoLogica';
import { pose } from '@/lib/pose';
import { AccoglienzaStato, DomandaInCoda } from '@/lib/tipi';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

const LARGHEZZA_PERSONAGGIO = 210;
const PAUSA_CHIUSURA_MS = 3200;

function dataOggi(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Da dove riparte il dialogo: dall'apertura, o dalla prima cosa che manca ancora. */
function inizio(profilo: ProfiloStudio, nomeBot: string): { chieste: Chiave[]; testo: string | null } {
  if (profilo.note_libere.length === 0) {
    return { chieste: ['esame_target'], testo: apertura(nomeBot) };
  }
  const gia = chiesteDalleNote(profilo);
  const prossima = prossimaChiave(profilo, gia);
  return prossima
    ? { chieste: [...gia, prossima], testo: `Rieccoci. ${DOMANDE_FISSE[prossima]}` }
    : { chieste: gia, testo: null }; // non manca niente da chiedere: il dialogo è finito
}

/**
 * Il dialogo di accoglienza. Non è un questionario: da ogni risposta si prende
 * tutto quello che contiene, si chiede solo ciò che manca, e si chiude appena
 * non manca niente (o se lo studente chiede aiuto). Le regole stanno nella
 * logica condivisa con la Edge Function; qui c'è lo schermo.
 * Si salva dopo OGNI risposta (stato in profiles.accoglienza_stato, "dialogo:N"
 * poi "completata"). Non si blocca mai: se la function non risponde si usa il
 * ripiego a testi fissi e le parole dello studente restano nel profilo.
 */
export default function Dialogo() {
  const profiloUtente = useAppStore((s) => s.profilo);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const nomeBot = profiloUtente?.nome_bot || 'Lode';

  // Stato accumulato in memoria: ogni salvataggio manda tutto, così un
  // salvataggio fallito si recupera da solo al successivo.
  const profilo = useRef<ProfiloStudio>(profiloCompleto(profiloUtente?.profilo_studio));
  const partenza = useRef(inizio(profilo.current, nomeBot)).current;
  const chieste = useRef<Chiave[]>(partenza.chieste);
  const coda = useRef<DomandaInCoda[]>(
    Array.isArray(profiloUtente?.domande_in_coda) ? profiloUtente!.domande_in_coda : []
  );
  // Battute mostrate ma non ancora scritte in chat (il client non può scriverle):
  // partono con la prossima chiamata riuscita.
  const arretrati = useRef<Messaggio[]>(
    partenza.testo ? [{ ruolo: 'assistant', contenuto: partenza.testo }] : []
  );
  const libretto = useRef<RiassuntoLibretto>({ media: null, cfu: 0, da_sostenere: [] });

  const [nChieste, setNChieste] = useState(partenza.chieste.length);
  const [testoBot, setTestoBot] = useState(partenza.testo ?? '');
  const [testo, setTesto] = useState('');
  const [inAttesa, setInAttesa] = useState(false);
  // null = dialogo in corso; poi la destinazione a dialogo finito
  const [uscita, setUscita] = useState<'/oggi' | '/chat' | null>(null);
  const opacita = useRef(new Animated.Value(1)).current;

  /** Salva profilo, coda e stato. L'esito non ferma il dialogo: si riprova al turno dopo. */
  const salva = async (fine: boolean) => {
    coda.current = allineaCoda(coda.current, profilo.current, fine) as DomandaInCoda[];
    const stato: AccoglienzaStato = fine
      ? 'completata'
      : (`dialogo:${Math.min(MAX_DOMANDE, Math.max(1, chieste.current.length))}` as AccoglienzaStato);
    await aggiornaAccoglienza({
      profilo_studio: profilo.current,
      domande_in_coda: coda.current,
      accoglienza_stato: stato,
    });
  };

  useEffect(() => {
    // Chi arriva da uno stato che non esiste più ("orario", "notifiche") entra nel
    // dialogo: lo si scrive subito, la function lo richiede.
    const stato = useAppStore.getState().profilo?.accoglienza_stato;
    if (partenza.testo === null) {
      // Ripreso un dialogo a cui non mancava più niente: si chiude senza altre domande.
      salva(true).then(() => router.replace('/oggi'));
    } else if (!String(stato ?? '').startsWith('dialogo:')) {
      aggiornaAccoglienza({ accoglienza_stato: 'dialogo:1' });
    }
    caricaEsami().then(({ dati }) => {
      const s = calcolaLibretto(dati);
      libretto.current = {
        media: s.media,
        cfu: s.cfuAcquisiti,
        da_sostenere: dati.filter((e) => !sostenuto(e)).map((e) => ({ id: e.id, materia: e.materia })),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La fine: nessuna schermata di traguardo. Il bot chiude e l'app compare; se
  // lo studente ha chiesto aiuto si apre direttamente la chat, già su quello.
  useEffect(() => {
    if (!uscita) return;
    const attesa = setTimeout(() => {
      Animated.timing(opacita, { toValue: 0, duration: 600, useNativeDriver: true }).start(() =>
        router.replace(uscita)
      );
    }, PAUSA_CHIUSURA_MS);
    return () => clearTimeout(attesa);
  }, [uscita, opacita]);

  /** Applica l'esito di un turno (dal modello, dal ripiego o da un salto) e salva. */
  const applica = async (esito: EsitoTurno) => {
    profilo.current = esito.profilo;
    chieste.current = esito.chieste;
    await salva(esito.fine);
    setNChieste(esito.chieste.length);
    setTestoBot(esito.risposta_bot);
    setInAttesa(false);
    if (esito.fine) setUscita(esito.aiuto ? '/chat' : '/oggi');
  };

  const invia = async () => {
    const risposta = testo.trim();
    if (!risposta || inAttesa || uscita) return;
    setTesto('');
    setInAttesa(true);

    const input = {
      nomeBot,
      oggi: dataOggi(),
      conversazione: [
        ...conversazioneDalleNote(profilo.current),
        { ruolo: 'assistant' as const, contenuto: testoBot },
        { ruolo: 'user' as const, contenuto: risposta },
      ],
      profilo: profilo.current,
      chieste: chieste.current,
      esami: libretto.current.da_sostenere,
      libretto: { media: libretto.current.media, cfu: libretto.current.cfu },
    };

    const turno = await turnoDialogo(input, arretrati.current);
    if (turno) {
      const scambio: Messaggio[] = [
        { ruolo: 'user', contenuto: risposta },
        { ruolo: 'assistant', contenuto: turno.esito.risposta_bot },
      ];
      arretrati.current = turno.messaggi_salvati ? [] : [...arretrati.current, ...scambio];
      await applica(turno.esito);
      return;
    }

    // La function non ha risposto: testi fissi, le parole dello studente restano.
    const esito = turnoDiRipiego(input);
    arretrati.current = [
      ...arretrati.current,
      { ruolo: 'user', contenuto: risposta },
      { ruolo: 'assistant', contenuto: esito.risposta_bot },
    ];
    await applica(esito);
  };

  /** Domanda saltata: nessuna chiamata, resta vuota e finirà in coda. */
  const salta = async () => {
    if (inAttesa || uscita) return;
    setTesto('');
    setInAttesa(true);
    const esito = turnoSaltato(profilo.current, chieste.current);
    arretrati.current = [...arretrati.current, { ruolo: 'assistant', contenuto: esito.risposta_bot }];
    await applica(esito);
  };

  return (
    <Animated.View style={[stili.schermo, { opacity: opacita }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={stili.indicatore}>
            {Array.from({ length: MAX_DOMANDE }, (_, i) => (
              <View key={i} style={[stili.puntino, i < nChieste && stili.puntinoAttivo]} />
            ))}
          </View>

          <ScrollView contentContainerStyle={stili.contenuto} keyboardShouldPersistTaps="handled">
            <Image
              source={inAttesa ? pose.pensa : pose.ascolta}
              style={stili.personaggio}
              resizeMode="contain"
            />
            <View style={stili.fumetto}>
              {inAttesa ? (
                <ActivityIndicator color={colori.accento} />
              ) : (
                <Text style={stili.testoBot}>{testoBot}</Text>
              )}
            </View>
          </ScrollView>

          {!uscita ? (
            <View style={stili.pie}>
              <View style={stili.rigaInput}>
                <TextInput
                  style={stili.campo}
                  value={testo}
                  onChangeText={setTesto}
                  placeholder="Scrivi come ti viene…"
                  placeholderTextColor={colori.testoSecondario}
                  multiline
                  maxLength={1000}
                  editable={!inAttesa}
                />
                <Pressable
                  onPress={invia}
                  disabled={!testo.trim() || inAttesa}
                  style={[stili.invia, (!testo.trim() || inAttesa) && stili.inviaDisabilitato]}
                  accessibilityRole="button"
                  accessibilityLabel="Invia la risposta"
                >
                  <Ionicons name="arrow-up" size={22} color={colori.sfondo} />
                </Pressable>
              </View>
              <Pressable onPress={salta} disabled={inAttesa} hitSlop={8}>
                <Text style={stili.salta}>Salta questa domanda</Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  indicatore: {
    flexDirection: 'row',
    gap: spazi.sm,
    justifyContent: 'center',
    paddingVertical: spazi.md,
  },
  puntino: {
    width: 28,
    height: 4,
    borderRadius: raggi.pieno,
    backgroundColor: colori.bordo,
  },
  puntinoAttivo: {
    backgroundColor: colori.accento,
  },
  contenuto: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spazi.lg,
    gap: spazi.md,
  },
  personaggio: {
    // le pose sono quadrate (1024x1024) e allineate tra loro
    width: LARGHEZZA_PERSONAGGIO,
    height: LARGHEZZA_PERSONAGGIO,
  },
  fumetto: {
    alignSelf: 'stretch',
    minHeight: 96,
    justifyContent: 'center',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
  },
  testoBot: {
    color: colori.testo,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  pie: {
    paddingHorizontal: spazi.lg,
    paddingBottom: spazi.lg,
    paddingTop: spazi.sm,
    gap: spazi.md,
  },
  rigaInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spazi.sm,
  },
  campo: {
    flex: 1,
    minHeight: 52,
    maxHeight: 130,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingHorizontal: spazi.md,
    paddingVertical: spazi.md,
    color: colori.testo,
    fontSize: 16,
  },
  invia: {
    width: 52,
    height: 52,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviaDisabilitato: {
    opacity: 0.4,
  },
  salta: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
