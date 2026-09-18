import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaPianoAttivo } from '@/lib/pianoDb';
import { avanzamento, etichettaStato, prossimaSessione } from '@/lib/pianoStudio';
import { Piano } from '@/lib/tipi';
import { dataBreveItaliana } from '@/lib/date';
import { BottonePrimario } from '@/components/BottonePrimario';
import { StatoVuoto } from '@/components/StatoVuoto';
import { colori, raggi, spazi } from '@/lib/theme';

const COLORE_STATO: Record<string, string> = {
  fatta: colori.successo,
  meta: colori.avviso,
  saltata: colori.errore,
  da_fare: colori.testoSecondario,
};

export default function SchermataPiano() {
  const [piano, setPiano] = useState<Piano | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  const carica = useCallback(async () => {
    const attivo = await caricaPianoAttivo();
    setPiano(attivo?.piano ?? null);
    setCaricamento(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carica();
    }, [carica])
  );

  const prossima = piano ? prossimaSessione(piano) : null;
  const avanz = piano ? avanzamento(piano) : null;

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colori.testoSecondario} />
        </Pressable>
        <Text style={stili.titoloPagina}>Piano di studio</Text>
        <View style={{ width: 26 }} />
      </View>

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : !piano ? (
        <View style={stili.vuoto}>
          <StatoVuoto
            titolo="Non hai ancora un piano"
            suggerimento="Scegli un esame e ti preparo lo studio giorno per giorno."
          />
          <BottonePrimario etichetta="Crea un piano" onPress={() => router.replace('/nuovo-piano')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={stili.contenuto}>
          <View style={stili.testata}>
            <Text style={stili.materia}>{piano.materia}</Text>
            <Text style={stili.sottotitolo}>
              Esame il {dataBreveItaliana(piano.data_esame)} · {piano.ore_al_giorno}h al giorno
            </Text>
          </View>

          {avanz && avanz.totale > 0 ? (
            <View style={[stili.cardAvanz, avanz.inRitardo && stili.cardAvanzRitardo]}>
              <Text style={stili.avanzTitolo}>
                {avanz.fatte} di {avanz.totale} sessioni fatte
              </Text>
              <Text style={stili.avanzTesto}>
                {avanz.inRitardo
                  ? `A questo ritmo copri circa il ${avanz.percentualeRaggiungibile}% del programma. Apri la prossima sessione: puoi anche rigenerare il piano.`
                  : `Copertura stimata del programma: ${avanz.percentualeRaggiungibile}%.`}
              </Text>
            </View>
          ) : null}

          {prossima ? (
            <BottonePrimario
              etichetta="Inizia la prossima sessione"
              onPress={() => router.push('/sessione')}
            />
          ) : (
            <View style={stili.cardCompletato}>
              <Ionicons name="checkmark-circle" size={22} color={colori.successo} />
              <Text style={stili.testoCompletato}>Hai completato tutte le sessioni. In bocca al lupo!</Text>
            </View>
          )}

          <Text style={stili.titoloSezione}>Sessioni</Text>
          <View style={stili.lista}>
            {[...piano.sessioni]
              .sort((a, b) => (a.data + a.ora_inizio).localeCompare(b.data + b.ora_inizio))
              .map((s, i) => {
                const eProssima =
                  prossima != null &&
                  prossima.sessione.data === s.data &&
                  prossima.sessione.ora_inizio === s.ora_inizio;
                return (
                  <View
                    key={`${s.data}-${s.ora_inizio}-${i}`}
                    style={[stili.riga, eProssima && stili.rigaProssima]}
                  >
                    <View style={stili.rigaTesta}>
                      <Text style={stili.rigaData}>
                        {dataBreveItaliana(s.data)} · {s.ora_inizio}–{s.ora_fine}
                      </Text>
                      <Text style={[stili.badge, { color: COLORE_STATO[s.stato] }]}>
                        {etichettaStato(s.stato)}
                      </Text>
                    </View>
                    <Text style={stili.rigaArgomento}>{s.argomento}</Text>
                    {s.obiettivo ? <Text style={stili.rigaObiettivo}>{s.obiettivo}</Text> : null}
                  </View>
                );
              })}
          </View>

          {piano.ripassi.length > 0 ? (
            <>
              <Text style={stili.titoloSezione}>Ripassi</Text>
              <View style={stili.lista}>
                {piano.ripassi.map((r, i) => (
                  <View key={`${r.data}-${i}`} style={stili.rigaRipasso}>
                    <Text style={stili.rigaData}>{dataBreveItaliana(r.data)}</Text>
                    <Text style={stili.rigaArgomento}>{r.argomenti_da_ripassare}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Pressable onPress={() => router.replace('/nuovo-piano')} style={stili.linkRigenera}>
            <Ionicons name="refresh" size={16} color={colori.testoSecondario} />
            <Text style={stili.testoRigenera}>Rigenera il piano</Text>
          </Pressable>
        </ScrollView>
      )}
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
  titoloPagina: { color: colori.testo, fontSize: 18, fontWeight: '800' },
  vuoto: { padding: spazi.lg, gap: spazi.md },
  contenuto: { padding: spazi.lg, paddingTop: spazi.sm, gap: spazi.md },
  testata: { gap: spazi.xs },
  materia: { color: colori.testo, fontSize: 24, fontWeight: '800' },
  sottotitolo: { color: colori.testoSecondario, fontSize: 14 },
  cardAvanz: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
    gap: spazi.xs,
  },
  cardAvanzRitardo: { borderColor: colori.avvisoPallino, backgroundColor: colori.superficie },
  avanzTitolo: { color: colori.testo, fontSize: 15, fontWeight: '700' },
  avanzTesto: { color: colori.testoSecondario, fontSize: 13, lineHeight: 19 },
  cardCompletato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  testoCompletato: { flex: 1, color: colori.testo, fontSize: 14, fontWeight: '600' },
  titoloSezione: { color: colori.testo, fontSize: 18, fontWeight: '800', marginTop: spazi.sm },
  lista: { gap: spazi.sm },
  riga: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
    gap: spazi.xs,
  },
  rigaProssima: { borderColor: colori.accento },
  rigaTesta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rigaData: { color: colori.testoSecondario, fontSize: 12, fontWeight: '600' },
  badge: { fontSize: 12, fontWeight: '700' },
  rigaArgomento: { color: colori.testo, fontSize: 16, fontWeight: '700' },
  rigaObiettivo: { color: colori.testoSecondario, fontSize: 13, lineHeight: 19 },
  rigaRipasso: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
    gap: spazi.xs,
  },
  linkRigenera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.xs,
    paddingVertical: spazi.md,
  },
  testoRigenera: { color: colori.testoSecondario, fontSize: 14, fontWeight: '600' },
});
