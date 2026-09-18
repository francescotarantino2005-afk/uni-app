import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { caricaPianoAttivo, salvaPiano } from '@/lib/pianoDb';
import {
  Esito,
  applicaEsito,
  avanzamento,
  durataMinuti,
  prossimaSessione,
} from '@/lib/pianoStudio';
import { Piano, SessionePiano } from '@/lib/tipi';
import { BottonePrimario } from '@/components/BottonePrimario';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { StatoVuoto } from '@/components/StatoVuoto';
import { colori, raggi, spazi } from '@/lib/theme';

function mmss(secondi: number): string {
  const m = Math.floor(secondi / 60);
  const s = secondi % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function SchermataSessione() {
  useKeepAwake(); // lo schermo resta acceso durante lo studio

  const [pianoId, setPianoId] = useState<string | null>(null);
  const [piano, setPiano] = useState<Piano | null>(null);
  const [sessione, setSessione] = useState<SessionePiano | null>(null);
  const [indice, setIndice] = useState<number>(-1);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [secondi, setSecondi] = useState(0);
  const [inCorso, setInCorso] = useState(false);
  const intervallo = useRef<ReturnType<typeof setInterval> | null>(null);

  const fermaTimer = () => {
    if (intervallo.current) {
      clearInterval(intervallo.current);
      intervallo.current = null;
    }
  };

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      (async () => {
        const attivo = await caricaPianoAttivo();
        if (!vivo) return;
        setPianoId(attivo?.id ?? null);
        setPiano(attivo?.piano ?? null);
        const p = attivo?.piano ?? null;
        const pross = p ? prossimaSessione(p) : null;
        if (pross) {
          setSessione(pross.sessione);
          setIndice(pross.indice);
          setSecondi(durataMinuti(pross.sessione) * 60);
        }
        setCaricamento(false);
      })();
      return () => {
        vivo = false;
        fermaTimer();
      };
    }, [])
  );

  // tick del countdown
  useEffect(() => {
    if (!inCorso) return;
    intervallo.current = setInterval(() => {
      setSecondi((s) => {
        if (s <= 1) {
          fermaTimer();
          setInCorso(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return fermaTimer;
  }, [inCorso]);

  const concludi = async (esito: Esito) => {
    if (!piano || !pianoId || indice < 0) return;
    fermaTimer();
    setInCorso(false);
    setSalvataggio(true);
    setErrore(null);

    const nuovo = applicaEsito(piano, indice, esito);
    const { errore: err } = await salvaPiano(pianoId, nuovo);
    setSalvataggio(false);
    if (err) {
      setErrore(err);
      return;
    }
    router.replace('/piano');
  };

  if (caricamento) {
    return (
      <SafeAreaView style={stili.schermo}>
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      </SafeAreaView>
    );
  }

  if (!piano || !sessione) {
    return (
      <SafeAreaView style={stili.schermo}>
        <View style={stili.intestazione}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colori.testoSecondario} />
          </Pressable>
          <View style={{ width: 26 }} />
        </View>
        <View style={stili.vuoto}>
          <StatoVuoto
            titolo={piano ? 'Nessuna sessione da fare' : 'Non hai ancora un piano'}
            suggerimento={
              piano
                ? 'Hai completato tutte le sessioni in programma. Bel lavoro!'
                : 'Crea un piano di studio e ti guido sessione per sessione.'
            }
          />
          {!piano ? (
            <BottonePrimario etichetta="Crea un piano" onPress={() => router.replace('/nuovo-piano')} />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const avanz = avanzamento(piano);

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colori.testoSecondario} />
        </Pressable>
        <Text style={stili.titoloPagina}>{piano.materia}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={stili.corpo}>
        <View style={stili.blocco}>
          <Text style={stili.etichetta}>Sessione di oggi</Text>
          <Text style={stili.argomento}>{sessione.argomento}</Text>
          {sessione.obiettivo ? <Text style={stili.obiettivo}>{sessione.obiettivo}</Text> : null}
        </View>

        {avanz.inRitardo ? (
          <View style={stili.avviso}>
            <Ionicons name="warning-outline" size={18} color={colori.errore} />
            <Text style={stili.testoAvviso}>
              Sei indietro di qualche sessione: a questo ritmo copri circa il{' '}
              {avanz.percentualeRaggiungibile}% del programma. Se vuoi, rigenera il piano con le ore
              che ti restano.
            </Text>
          </View>
        ) : null}

        <View style={stili.timerBox}>
          <Text style={stili.timer}>{mmss(secondi)}</Text>
          <Pressable
            onPress={() => setInCorso((v) => !v)}
            disabled={secondi === 0}
            style={[stili.bottoneTimer, secondi === 0 && stili.bottoneTimerSpento]}
          >
            <Ionicons
              name={inCorso ? 'pause' : 'play'}
              size={22}
              color={colori.accento}
            />
            <Text style={stili.testoBottoneTimer}>
              {secondi === 0 ? 'Tempo finito' : inCorso ? 'Pausa' : 'Avvia'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={stili.fondo}>
        <MessaggioErrore messaggio={errore} />
        {salvataggio ? (
          <ActivityIndicator color={colori.accento} />
        ) : (
          <>
            <Text style={stili.etichettaEsito}>Com'è andata?</Text>
            <View style={stili.rigaEsiti}>
              <Pressable
                style={[stili.esito, stili.esitoFatto]}
                onPress={() => concludi('fatto')}
              >
                <Ionicons name="checkmark" size={20} color={colori.successo} />
                <Text style={[stili.testoEsito, { color: colori.successo }]}>Fatto</Text>
              </Pressable>
              <Pressable style={stili.esito} onPress={() => concludi('meta')}>
                <Ionicons name="contract-outline" size={20} color={colori.testoSecondario} />
                <Text style={[stili.testoEsito, { color: colori.testoSecondario }]}>A metà</Text>
              </Pressable>
              <Pressable style={stili.esito} onPress={() => concludi('saltata')}>
                <Ionicons name="close" size={20} color={colori.errore} />
                <Text style={[stili.testoEsito, { color: colori.errore }]}>Saltata</Text>
              </Pressable>
            </View>
            <Text style={stili.notaEsito}>
              Se salti o fai a metà, sposto quello che manca sulle prossime sessioni libere.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colori.sfondo },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spazi.md,
    paddingVertical: spazi.md,
  },
  titoloPagina: { color: colori.testo, fontSize: 16, fontWeight: '700' },
  vuoto: { padding: spazi.lg, gap: spazi.md },
  corpo: { flex: 1, padding: spazi.lg, gap: spazi.lg, justifyContent: 'center' },
  blocco: { gap: spazi.sm, alignItems: 'center' },
  etichetta: {
    color: colori.accento,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  argomento: { color: colori.testo, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  obiettivo: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  avviso: {
    flexDirection: 'row',
    gap: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.errore,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  testoAvviso: { flex: 1, color: colori.testo, fontSize: 13, lineHeight: 19 },
  timerBox: { alignItems: 'center', gap: spazi.md, marginTop: spazi.sm },
  timer: {
    color: colori.testo,
    fontSize: 72,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  bottoneTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.lg,
    borderRadius: raggi.pieno,
    borderWidth: 1,
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  bottoneTimerSpento: { opacity: 0.4 },
  testoBottoneTimer: { color: colori.accento, fontSize: 15, fontWeight: '700' },
  fondo: {
    padding: spazi.lg,
    gap: spazi.sm,
    borderTopColor: colori.bordo,
    borderTopWidth: 1,
  },
  etichettaEsito: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  rigaEsiti: { flexDirection: 'row', gap: spazi.sm },
  esito: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.xs,
    paddingVertical: spazi.md,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderColor: colori.bordo,
    backgroundColor: colori.superficie,
  },
  esitoFatto: { borderColor: colori.successo },
  testoEsito: { fontSize: 15, fontWeight: '700' },
  notaEsito: {
    color: colori.testoSecondario,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
