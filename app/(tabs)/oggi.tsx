import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { EventoOrario, Scadenza } from '@/lib/tipi';
import { dataLungaItaliana, giornoOggi } from '@/lib/date';
import { useAppStore } from '@/store/useAppStore';
import { RigaLezione } from '@/components/RigaLezione';
import { RigaScadenza } from '@/components/RigaScadenza';
import { StatoVuoto } from '@/components/StatoVuoto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function SchermataOggi() {
  const esci = useAppStore((s) => s.esci);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [lezioniOggi, setLezioniOggi] = useState<EventoOrario[]>([]);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [aggiornamento, setAggiornamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    const [lezioni, prossime, brief] = await Promise.all([
      caricaLezioni(),
      caricaProssimeScadenze(5),
      caricaBriefingOggi(),
    ]);
    setLezioniOggi(lezioni.dati.filter((l) => l.giorno === giornoOggi()));
    setScadenze(prossime.dati);
    setBriefing(brief?.contenuto ?? null);
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

  const gestisciUscita = async () => {
    await esci();
    router.replace('/auth');
  };

  return (
    <ScrollView
      style={stili.schermo}
      contentContainerStyle={stili.contenuto}
      refreshControl={
        <RefreshControl refreshing={aggiornamento} onRefresh={aggiorna} tintColor={colori.accento} />
      }
    >
      <View style={stili.intestazione}>
        <Text style={stili.data}>{dataLungaItaliana()}</Text>
        <Pressable onPress={() => router.push('/preferenze')} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <MessaggioErrore messaggio={errore} />

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <>
          {briefing ? (
            <View style={stili.cardBriefing}>
              <View style={stili.intestazioneBriefing}>
                <Ionicons name="sunny" size={18} color={colori.accento} />
                <Text style={stili.etichettaBriefing}>Il tuo briefing</Text>
              </View>
              <Text style={stili.testoBriefing}>{briefing}</Text>
            </View>
          ) : (
            <Pressable style={stili.cardBriefingVuota} onPress={() => router.push('/preferenze')}>
              <Ionicons name="sunny-outline" size={20} color={colori.accento} />
              <Text style={stili.testoBriefingVuoto}>
                Il briefing del mattino arriva ogni giorno all'ora che scegli. Impostala qui →
              </Text>
            </Pressable>
          )}

          <Text style={stili.titoloSezione}>Lezioni di oggi</Text>
          {lezioniOggi.length === 0 ? (
            <StatoVuoto
              titolo="Nessuna lezione oggi 🎉"
              suggerimento="Goditi la giornata, o recupera quella scadenza che rimandi da un po'…"
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
              suggerimento="Aggiungi ISEE, tasse o esami dalla tab Scadenze: al resto pensiamo noi."
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

      <Pressable onPress={gestisciUscita} style={stili.bottoneEsci}>
        <Text style={stili.testoEsci}>Esci dall'account</Text>
      </Pressable>
    </ScrollView>
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
    paddingBottom: spazi.xl,
  },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  data: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
  },
  cardBriefing: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.md,
    gap: spazi.sm,
  },
  intestazioneBriefing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
  },
  etichettaBriefing: {
    color: colori.accento,
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
  bottoneEsci: {
    alignSelf: 'center',
    paddingVertical: spazi.md,
  },
  testoEsci: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
  },
});
