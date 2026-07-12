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
import { caricaLezioni } from '@/lib/orarioDb';
import { caricaProssimeScadenze } from '@/lib/scadenzeDb';
import { EventoOrario, Scadenza } from '@/lib/tipi';
import { dataLungaItaliana, giornoOggi } from '@/lib/date';
import { useAppStore } from '@/store/useAppStore';
import { RigaLezione } from '@/components/RigaLezione';
import { RigaScadenza } from '@/components/RigaScadenza';
import { StatoVuoto } from '@/components/StatoVuoto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, spazi } from '@/lib/theme';

export default function SchermataOggi() {
  const esci = useAppStore((s) => s.esci);
  const [lezioniOggi, setLezioniOggi] = useState<EventoOrario[]>([]);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [aggiornamento, setAggiornamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    const [lezioni, prossime] = await Promise.all([caricaLezioni(), caricaProssimeScadenze(5)]);
    setLezioniOggi(lezioni.dati.filter((l) => l.giorno === giornoOggi()));
    setScadenze(prossime.dati);
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
      <Text style={stili.data}>{dataLungaItaliana()}</Text>

      <MessaggioErrore messaggio={errore} />

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <>
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
  data: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
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
