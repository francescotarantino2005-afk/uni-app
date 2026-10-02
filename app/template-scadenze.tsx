import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  aggiungiDaTemplate,
  caricaTemplateConsigliati,
  chiaviScadenzeEsistenti,
  TemplateScadenza,
} from '@/lib/templateDb';
import { dataBreveItaliana, giorniMancanti } from '@/lib/date';
import { iconaCategoria } from '@/lib/categorie';
import { useAppStore } from '@/store/useAppStore';
import { StatoVuoto } from '@/components/StatoVuoto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function SchermataTemplateScadenze() {
  const utente = useAppStore((s) => s.utente);
  const profilo = useAppStore((s) => s.profilo);

  const [template, setTemplate] = useState<TemplateScadenza[]>([]);
  const [aggiunte, setAggiunte] = useState<Set<string>>(new Set());
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ dati, errore }, esistenti] = await Promise.all([
        caricaTemplateConsigliati(profilo?.regione ?? null, profilo?.ateneo ?? null),
        chiaviScadenzeEsistenti(),
      ]);
      setTemplate(dati);
      setAggiunte(esistenti);
      setErrore(errore);
      setCaricamento(false);
    })();
  }, [profilo?.regione, profilo?.ateneo]);

  const chiave = (t: TemplateScadenza) => `${t.titolo}|${t.data}`;

  const aggiungi = async (t: TemplateScadenza) => {
    if (!utente) {
      setErrore('Sessione scaduta: accedi di nuovo.');
      return;
    }
    setErrore(null);
    setInCorso(t.id);
    // "aggiunte" contiene tutte le scadenze già presenti: vuoto = questa è la prima.
    const eraLaPrima = aggiunte.size === 0;
    const { errore: erroreDb } = await aggiungiDaTemplate(utente.id, t);
    setInCorso(null);
    if (erroreDb) {
      setErrore(erroreDb);
      return;
    }
    setAggiunte((prima) => new Set(prima).add(chiave(t)));
    useAppStore.getState().scadenzaAggiunta(eraLaPrima);
  };

  const riga = (t: TemplateScadenza) => {
    const giaAggiunta = aggiunte.has(chiave(t));
    const giorni = t.data ? giorniMancanti(t.data) : null;
    return (
      <View key={t.id} style={stili.card}>
        <View style={stili.intestazioneCard}>
          <View style={stili.cerchioIcona}>
            <Ionicons name={iconaCategoria(t.categoria)} size={18} color={colori.testoSecondario} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={stili.titolo}>{t.titolo}</Text>
            {t.data ? (
              <Text style={stili.data}>
                {dataBreveItaliana(t.data)}
                {giorni != null && giorni >= 0 ? ` · tra ${giorni} giorni` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {t.spiegazione ? <Text style={stili.spiegazione}>{t.spiegazione}</Text> : null}

        <Pressable
          onPress={() => !giaAggiunta && aggiungi(t)}
          disabled={giaAggiunta || inCorso === t.id}
          style={[stili.bottone, giaAggiunta && stili.bottoneFatto]}
        >
          {inCorso === t.id ? (
            <ActivityIndicator size="small" color={colori.accento} />
          ) : (
            <>
              <Ionicons
                name={giaAggiunta ? 'checkmark-circle' : 'add-circle-outline'}
                size={18}
                color={giaAggiunta ? colori.successo : colori.accento}
              />
              <Text style={[stili.testoBottone, giaAggiunta && stili.testoBottoneFatto]}>
                {giaAggiunta ? 'Aggiunta alle tue scadenze' : 'Aggiungi alle mie scadenze'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <View style={{ flex: 1 }}>
          <Text style={stili.titoloPagina}>Scadenze da non perdere</Text>
          <Text style={stili.sottotitolo}>
            Le scadenze tipiche di uno studente. Aggiungi quelle che ti riguardano: le ritrovi
            nella tua lista e nel briefing del mattino.
          </Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={stili.contenuto}>
        <MessaggioErrore messaggio={errore} />
        {caricamento ? (
          <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
        ) : template.length === 0 ? (
          <StatoVuoto
            titolo="Nessuna scadenza consigliata al momento"
            suggerimento="Torneranno quando si avvicinano le finestre di ISEE, tasse e borse."
          />
        ) : (
          template.map(riga)
        )}
        <Text style={stili.notaFinale}>
          Le date sono indicative: controlla sempre il sito del tuo ateneo o dell'ente regionale.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spazi.md,
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '800',
  },
  sottotitolo: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  contenuto: {
    padding: spazi.lg,
    paddingTop: spazi.sm,
    gap: spazi.md,
  },
  card: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
    gap: spazi.sm,
  },
  intestazioneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
  },
  cerchioIcona: {
    width: 36,
    height: 36,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titolo: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '700',
  },
  data: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  spiegazione: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
  },
  bottone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.xs,
    paddingVertical: spazi.sm,
    borderRadius: raggi.sm,
    borderWidth: 1,
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  bottoneFatto: {
    borderColor: colori.bordo,
    backgroundColor: 'transparent',
  },
  testoBottone: {
    color: colori.accento,
    fontSize: 14,
    fontWeight: '700',
  },
  testoBottoneFatto: {
    color: colori.successo,
  },
  notaFinale: {
    color: colori.testoSecondario,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spazi.xs,
  },
});
