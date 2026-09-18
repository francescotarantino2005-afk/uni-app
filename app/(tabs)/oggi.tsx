import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaLezioni } from '@/lib/orarioDb';
import { caricaProssimeScadenze } from '@/lib/scadenzeDb';
import { caricaBriefingOggi } from '@/lib/briefingDb';
import { caricaPianoAttivo } from '@/lib/pianoDb';
import { prossimaSessione } from '@/lib/pianoStudio';
import { EventoOrario, Scadenza } from '@/lib/tipi';
import { dataLungaItaliana, giornoOggi } from '@/lib/date';
import { RigaLezione } from '@/components/RigaLezione';
import { RigaScadenza } from '@/components/RigaScadenza';
import { BadgeBeta } from '@/components/BadgeBeta';
import { StatoVuoto } from '@/components/StatoVuoto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { BottoneChat } from '@/components/BottoneChat';
import { colori, raggi, spazi } from '@/lib/theme';

const MASCOTTE = require('@/assets/images/lode-bot-testa.png');

export default function SchermataOggi() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [suggerimento, setSuggerimento] = useState<string | null>(null);
  const [haSessione, setHaSessione] = useState(false);
  const [haPiano, setHaPiano] = useState(false);
  const [lezioniOggi, setLezioniOggi] = useState<EventoOrario[]>([]);
  const [orarioVuoto, setOrarioVuoto] = useState(false);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [aggiornamento, setAggiornamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    const [lezioni, prossime, brief, piano] = await Promise.all([
      caricaLezioni(),
      caricaProssimeScadenze(5),
      caricaBriefingOggi(),
      caricaPianoAttivo(),
    ]);
    setLezioniOggi(lezioni.dati.filter((l) => l.giorno === giornoOggi()));
    setOrarioVuoto(lezioni.dati.length === 0);
    setScadenze(prossime.dati);
    setBriefing(brief?.contenuto ?? null);
    setSuggerimento(brief?.suggerimento ?? null);
    setHaPiano(piano !== null);
    setHaSessione(piano !== null && prossimaSessione(piano.piano) !== null);
    setErrore(lezioni.errore ?? prossime.errore);
    setCaricamento(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carica();
    }, [carica])
  );

  const aggiorna = async () => {
    setAggiornamento(true);
    await carica();
    setAggiornamento(false);
  };

  return (
    <View style={stili.schermo}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stili.contenuto}
        refreshControl={
          <RefreshControl refreshing={aggiornamento} onRefresh={aggiorna} tintColor={colori.accento} />
        }
      >
        <View style={stili.marchio}>
          <View style={stili.marchioSinistra}>
            <Image source={MASCOTTE} style={stili.logoMarchio} resizeMode="contain" />
            <Text style={stili.nomeMarchio}>Lode</Text>
          </View>
          <Pressable onPress={() => router.push('/impostazioni')} hitSlop={10}>
            <Ionicons name="settings-outline" size={22} color={colori.testoSecondario} />
          </Pressable>
        </View>

        <View style={stili.intestazione}>
          <View style={stili.headerSinistra}>
            <Text style={stili.data}>{dataLungaItaliana()}</Text>
            <BadgeBeta piccolo />
          </View>
        </View>

      <MessaggioErrore messaggio={errore} />

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <>
          {briefing ? (
            <View style={stili.cardBriefing}>
              <View style={stili.intestazioneBriefing}>
                <Ionicons name="sunny" size={18} color={colori.testoSecondario} />
                <Text style={stili.etichettaBriefing}>Buongiorno</Text>
              </View>
              <Text style={stili.testoBriefing}>{briefing}</Text>
            </View>
          ) : (
            <Pressable style={stili.cardBriefingVuota} onPress={() => router.push('/preferenze')}>
              <Ionicons name="sunny-outline" size={20} color={colori.testoSecondario} />
              <Text style={stili.testoBriefingVuoto}>
                Il briefing del mattino arriva ogni giorno all'ora che scegli. Impostala qui →
              </Text>
            </Pressable>
          )}

          {haPiano ? (
            <View style={stili.cardOggi}>
              <View style={stili.intestazioneBriefing}>
                <Ionicons name="flag" size={18} color={colori.testoSecondario} />
                <Text style={stili.etichettaBriefing}>Oggi</Text>
              </View>
              <Text style={stili.testoBriefing}>
                {suggerimento ?? 'Continua il tuo piano di studio: apri la prossima sessione.'}
              </Text>
              {haSessione ? (
                <Pressable style={stili.bottoneSessione} onPress={() => router.push('/sessione')}>
                  <Ionicons name="play" size={18} color={colori.sfondo} />
                  <Text style={stili.testoBottoneSessione}>Inizia sessione</Text>
                </Pressable>
              ) : (
                <Pressable style={stili.linkPiano} onPress={() => router.push('/piano')}>
                  <Text style={stili.testoLinkPiano}>Vedi il piano →</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable style={stili.cardCreaPiano} onPress={() => router.push('/nuovo-piano')}>
              <Ionicons name="rocket-outline" size={20} color={colori.testoSecondario} />
              <View style={{ flex: 1 }}>
                <Text style={stili.titoloCreaPiano}>Prepara un esame senza ansia</Text>
                <Text style={stili.testoCreaPiano}>
                  Ti costruisco un piano giorno per giorno, attorno al tuo orario. Crea il primo →
                </Text>
              </View>
            </Pressable>
          )}

          {orarioVuoto && scadenze.length === 0 ? (
            <View style={stili.cardBenvenuto}>
              <Text style={stili.titoloBenvenuto}>Benvenuto! Partiamo da qui 👋</Text>
              <Text style={stili.testoBenvenuto}>
                Bastano due minuti per far diventare l'app tua. Aggiungi l'orario e le prime
                scadenze: poi ogni mattina trovi qui la tua giornata pronta.
              </Text>
              <Pressable style={stili.azioneBenvenuto} onPress={() => router.push('/importa-orario')}>
                <Ionicons name="camera-outline" size={18} color={colori.accento} />
                <Text style={stili.testoAzione}>Importa l'orario da una foto</Text>
              </Pressable>
              <Pressable
                style={stili.azioneBenvenuto}
                onPress={() => router.push('/template-scadenze')}
              >
                <Ionicons name="sparkles-outline" size={18} color={colori.accento} />
                <Text style={stili.testoAzione}>Aggiungi le scadenze da non perdere</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={stili.titoloSezione}>Lezioni di oggi</Text>
          {lezioniOggi.length === 0 ? (
            <StatoVuoto
              titolo={orarioVuoto ? 'Il tuo orario è ancora vuoto' : 'Nessuna lezione oggi 🎉'}
              suggerimento={
                orarioVuoto
                  ? 'Aggiungilo dalla tab Orario, anche solo con una foto: ci penso io a leggerlo.'
                  : 'Goditi la giornata, o recupera quella scadenza che rimandi da un po\'…'
              }
            />
          ) : (
            <View style={stili.lista}>
              {lezioniOggi.map((l) => (
                <RigaLezione key={l.id} lezione={l} />
              ))}
            </View>
          )}

          <Text style={stili.titoloSezione}>Prossime scadenze</Text>
          {scadenze.length === 0 ? (
            <StatoVuoto
              titolo="Nessuna scadenza in vista ✨"
              suggerimento="ISEE, tasse, borse: aggiungi le più comuni in un tap da “Scadenze da non perdere”."
            />
          ) : (
            <View style={stili.lista}>
              {scadenze.map((s) => (
                <RigaScadenza key={s.id} scadenza={s} />
              ))}
            </View>
          )}
        </>
      )}

      </ScrollView>
      <BottoneChat />
    </View>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  contenuto: {
    padding: spazi.md,
    gap: spazi.md,
    // spazio per il pulsante chat flottante: l'ultima riga resta leggibile.
    paddingBottom: 90,
  },
  marchio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marchioSinistra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
  },
  logoMarchio: {
    width: 40,
    height: 40 * (702 / 726),
  },
  nomeMarchio: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '800',
  },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSinistra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
  },
  data: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
  },
  cardBriefing: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.md,
    gap: spazi.sm,
  },
  cardOggi: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.md,
    gap: spazi.sm,
  },
  bottoneSessione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.xs,
    backgroundColor: colori.accento,
    borderRadius: raggi.md,
    paddingVertical: spazi.sm,
    marginTop: spazi.xs,
  },
  testoBottoneSessione: {
    color: colori.sfondo,
    fontSize: 15,
    fontWeight: '700',
  },
  linkPiano: {
    paddingVertical: spazi.xs,
  },
  testoLinkPiano: {
    color: colori.accento,
    fontSize: 14,
    fontWeight: '700',
  },
  cardCreaPiano: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  titoloCreaPiano: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '700',
  },
  testoCreaPiano: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  cardBenvenuto: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    gap: spazi.sm,
  },
  titoloBenvenuto: {
    color: colori.testo,
    fontSize: 18,
    fontWeight: '800',
  },
  testoBenvenuto: {
    color: colori.testoSecondario,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spazi.xs,
  },
  azioneBenvenuto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  testoAzione: {
    color: colori.accento,
    fontSize: 14,
    fontWeight: '700',
  },
  intestazioneBriefing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
  },
  etichettaBriefing: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testoBriefing: {
    color: colori.testo,
    fontSize: 16,
    lineHeight: 24,
  },
  cardBriefingVuota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  testoBriefingVuoto: {
    flex: 1,
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
  },
  titoloSezione: {
    color: colori.testo,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spazi.sm,
  },
  lista: {
    gap: spazi.sm,
  },
});
