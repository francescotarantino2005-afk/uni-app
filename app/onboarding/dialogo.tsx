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
import {
  DOMANDE_FISSE,
  MessaggioDialogo,
  NUMERO_DOMANDE,
  RiassuntoLibretto,
  aggiornaCoda,
  apertura,
  chiusuraFissa,
  profiloStudioCompleto,
  registraRisposta,
  turnoDialogo,
  valoreDiRipiego,
} from '@/lib/dialogoAccoglienza';
import { AccoglienzaStato, DomandaInCoda, ProfiloStudio } from '@/lib/tipi';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

// Solo la testa: l'immagine a corpo intero non è ancora tra gli asset (726x702).
const MASCOTTE = require('@/assets/images/lode-bot-testa.png');
const RAPPORTO = 702 / 726;
const LARGHEZZA_MASCOTTE = 190;

const PAUSA_CHIUSURA_MS = 2800;

function numeroDaStato(stato: AccoglienzaStato | null | undefined): number {
  const m = String(stato ?? '').match(/^dialogo:([1-5])$/);
  return m ? Number(m[1]) : 1;
}

/**
 * Il dialogo di accoglienza: una domanda alla volta, risposta a testo libero.
 * Si salva dopo OGNI risposta (stesso meccanismo degli altri passi: stato in
 * profiles.accoglienza_stato, "dialogo:1"…"dialogo:5" → "completata").
 * Non si blocca mai: se la function non risponde si usa il testo fisso e la
 * risposta resta grezza in note_libere.
 */
export default function Dialogo() {
  const profilo = useAppStore((s) => s.profilo);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);
  const nomeBot = profilo?.nome_bot || 'Lode';

  // Stato accumulato in memoria: ogni salvataggio manda tutto, così un
  // salvataggio fallito si recupera da solo al successivo.
  const numeroIniziale = useRef(numeroDaStato(profilo?.accoglienza_stato)).current;
  const profiloStudio = useRef<ProfiloStudio>(profiloStudioCompleto(profilo?.profilo_studio));
  const coda = useRef<DomandaInCoda[]>(
    Array.isArray(profilo?.domande_in_coda) ? profilo!.domande_in_coda : []
  );
  const testoIniziale = useRef(
    numeroIniziale === 1 ? apertura(nomeBot) : `Rieccoci. ${DOMANDE_FISSE[numeroIniziale - 1]}`
  ).current;
  // Battute mostrate ma non ancora scritte in chat (il client non può scriverle):
  // partono con la prossima chiamata riuscita.
  const arretrati = useRef<MessaggioDialogo[]>([{ ruolo: 'assistant', contenuto: testoIniziale }]);
  const libretto = useRef<RiassuntoLibretto>({ media: null, cfu: 0, da_sostenere: [] });

  const [numero, setNumero] = useState(numeroIniziale);
  const [testoBot, setTestoBot] = useState(testoIniziale);
  const [inChiarimento, setInChiarimento] = useState(false);
  const [testo, setTesto] = useState('');
  const [inAttesa, setInAttesa] = useState(false);
  const [finito, setFinito] = useState(false);
  const opacita = useRef(new Animated.Value(1)).current;

  // Chi arriva da uno stato che non esiste più ("orario", "notifiche") entra nel
  // dialogo dalla prima domanda: lo si scrive subito, la function lo richiede.
  useEffect(() => {
    const stato = useAppStore.getState().profilo?.accoglienza_stato;
    if (!String(stato ?? '').startsWith('dialogo:')) {
      aggiornaAccoglienza({ accoglienza_stato: 'dialogo:1' });
    }
  }, [aggiornaAccoglienza]);

  useEffect(() => {
    caricaEsami().then(({ dati }) => {
      const stato = calcolaLibretto(dati);
      libretto.current = {
        media: stato.media,
        cfu: stato.cfuAcquisiti,
        da_sostenere: dati.filter((e) => !sostenuto(e)).map((e) => ({ id: e.id, materia: e.materia })),
      };
    });
  }, []);

  // La fine: nessuna schermata di traguardo. Il bot chiude e l'app compare.
  useEffect(() => {
    if (!finito) return;
    const attesa = setTimeout(() => {
      Animated.timing(opacita, { toValue: 0, duration: 600, useNativeDriver: true }).start(() =>
        router.replace('/oggi')
      );
    }, PAUSA_CHIUSURA_MS);
    return () => clearTimeout(attesa);
  }, [finito, opacita]);

  /** Chiude la domanda corrente (o resta su di essa per un chiarimento) e salva. */
  const avanza = async (battuta: string, prossima: number | null, resta: boolean) => {
    if (resta) {
      setInChiarimento(true);
      await aggiornaAccoglienza({ profilo_studio: profiloStudio.current });
    } else {
      coda.current = aggiornaCoda(coda.current, profiloStudio.current, numero);
      const stato: AccoglienzaStato = prossima
        ? (`dialogo:${prossima}` as AccoglienzaStato)
        : 'completata';
      // L'esito del salvataggio non ferma il dialogo: si riprova al turno dopo.
      await aggiornaAccoglienza({
        profilo_studio: profiloStudio.current,
        domande_in_coda: coda.current,
        accoglienza_stato: stato,
      });
      setInChiarimento(false);
      if (prossima) setNumero(prossima);
      else setFinito(true);
    }
    setTestoBot(battuta);
    setInAttesa(false);
  };

  const invia = async () => {
    const risposta = testo.trim();
    if (!risposta || inAttesa || finito) return;
    setTesto('');
    setInAttesa(true);

    const turno = await turnoDialogo({
      nome_bot: nomeBot,
      numero,
      risposta,
      domanda_testo: testoBot,
      chiarimento: inChiarimento,
      profilo_studio: profiloStudio.current,
      libretto: libretto.current,
      arretrati: arretrati.current,
    });

    if (turno) {
      profiloStudio.current = registraRisposta(
        profiloStudio.current,
        numero,
        testoBot,
        risposta,
        turno.valore
      );
      const scambio: MessaggioDialogo[] = [
        { ruolo: 'user', contenuto: risposta },
        { ruolo: 'assistant', contenuto: turno.risposta_bot },
      ];
      arretrati.current = turno.messaggi_salvati ? [] : [...arretrati.current, ...scambio];
      const resta = turno.prossima_domanda === numero && !inChiarimento;
      const prossima = resta ? numero : numero < NUMERO_DOMANDE ? numero + 1 : null;
      await avanza(turno.risposta_bot, prossima, resta);
      return;
    }

    // La function non ha risposto: testo fisso, risposta grezza, si va avanti.
    profiloStudio.current = registraRisposta(
      profiloStudio.current,
      numero,
      testoBot,
      risposta,
      valoreDiRipiego(numero, risposta)
    );
    const prossima = numero < NUMERO_DOMANDE ? numero + 1 : null;
    const battuta = prossima
      ? `Ok, segnato. ${DOMANDE_FISSE[prossima - 1]}`
      : chiusuraFissa(profiloStudio.current.esame_target.nome);
    arretrati.current = [
      ...arretrati.current,
      { ruolo: 'user', contenuto: risposta },
      { ruolo: 'assistant', contenuto: battuta },
    ];
    await avanza(battuta, prossima, false);
  };

  /** Domanda saltata: nessuna chiamata, finisce in coda come "da_fare". */
  const salta = async () => {
    if (inAttesa || finito) return;
    setTesto('');
    setInAttesa(true);
    const prossima = numero < NUMERO_DOMANDE ? numero + 1 : null;
    const battuta = prossima
      ? `Nessun problema, ci torniamo. ${DOMANDE_FISSE[prossima - 1]}`
      : chiusuraFissa(profiloStudio.current.esame_target.nome);
    arretrati.current = [...arretrati.current, { ruolo: 'assistant', contenuto: battuta }];
    await avanza(battuta, prossima, false);
  };

  return (
    <Animated.View style={[stili.schermo, { opacity: opacita }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={stili.indicatore}>
            {Array.from({ length: NUMERO_DOMANDE }, (_, i) => (
              <View key={i} style={[stili.puntino, i < numero && stili.puntinoAttivo]} />
            ))}
          </View>

          <ScrollView
            contentContainerStyle={stili.contenuto}
            keyboardShouldPersistTaps="handled"
          >
            <Image source={MASCOTTE} style={stili.mascotte} resizeMode="contain" />
            <View style={stili.fumetto}>
              {inAttesa ? (
                <ActivityIndicator color={colori.accento} />
              ) : (
                <Text style={stili.testoBot}>{testoBot}</Text>
              )}
            </View>
          </ScrollView>

          {!finito ? (
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
    gap: spazi.lg,
  },
  mascotte: {
    width: LARGHEZZA_MASCOTTE,
    height: LARGHEZZA_MASCOTTE * RAPPORTO,
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
    fontSize: 19,
    lineHeight: 27,
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
