import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaEsami } from '@/lib/esamiDb';
import { generaPiano } from '@/lib/pianoDb';
import { Esame } from '@/lib/tipi';
import { dataBreveItaliana, giorniMancanti } from '@/lib/date';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { StatoVuoto } from '@/components/StatoVuoto';
import { colori, raggi, spazi } from '@/lib/theme';

const ORE = [1, 2, 3, 4, 5, 6];

export default function SchermataNuovoPiano() {
  const [esami, setEsami] = useState<Esame[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [esameId, setEsameId] = useState<string | null>(null);
  const [materiale, setMateriale] = useState('');
  const [ore, setOre] = useState(2);
  const [generazione, setGenerazione] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { dati } = await caricaEsami();
      // solo esami ancora da sostenere e con una data nel futuro
      const futuri = dati.filter((e) => e.data_esame && giorniMancanti(e.data_esame) >= 1);
      setEsami(futuri);
      if (futuri.length === 1) setEsameId(futuri[0].id);
      setCaricamento(false);
    })();
  }, []);

  const esameScelto = esami.find((e) => e.id === esameId) ?? null;

  const genera = async () => {
    setErrore(null);
    if (!esameScelto || !esameScelto.data_esame) {
      setErrore('Scegli l\'esame per cui preparare il piano.');
      return;
    }
    if (materiale.trim().length < 3) {
      setErrore('Descrivi in due parole cosa devi studiare (es. "capitoli 1-8 del libro").');
      return;
    }

    setGenerazione(true);
    const esito = await generaPiano({
      esame_id: esameScelto.id,
      data_esame: esameScelto.data_esame,
      materiale: materiale.trim(),
      ore_al_giorno: ore,
    });
    setGenerazione(false);

    if (esito.tipo === 'errore') {
      setErrore(esito.messaggio);
      return;
    }
    router.replace('/piano');
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Nuovo piano di studio</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : esami.length === 0 ? (
        <View style={stili.vuoto}>
          <StatoVuoto
            titolo="Nessun esame in programma"
            suggerimento="Aggiungi un esame con la sua data dalla tab Libretto: poi torno qui e ti costruisco il piano a ritroso dall'esame."
          />
          <BottonePrimario etichetta="Vai al Libretto" onPress={() => router.replace('/libretto')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={stili.modulo} keyboardShouldPersistTaps="handled">
          <Text style={stili.introInfo}>
            Ti preparo un piano giorno per giorno che parte dall'esame e torna indietro, mettendo lo
            studio solo nelle ore che hai davvero libere.
          </Text>

          <View style={stili.gruppo}>
            <Text style={stili.etichettaGruppo}>Per quale esame</Text>
            <View style={stili.listaEsami}>
              {esami.map((e) => {
                const attivo = e.id === esameId;
                const giorni = e.data_esame ? giorniMancanti(e.data_esame) : 0;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => setEsameId(e.id)}
                    style={[stili.cardEsame, attivo && stili.cardEsameAttiva]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[stili.materiaEsame, attivo && stili.testoAttivo]}>
                        {e.materia}
                      </Text>
                      <Text style={stili.dataEsame}>
                        {e.data_esame ? dataBreveItaliana(e.data_esame) : ''} · tra {giorni}{' '}
                        {giorni === 1 ? 'giorno' : 'giorni'}
                      </Text>
                    </View>
                    <Ionicons
                      name={attivo ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={attivo ? colori.accento : colori.testoSecondario}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <CampoTesto
            etichetta="Cosa devi studiare"
            value={materiale}
            onChangeText={setMateriale}
            placeholder="Capitoli 1-8 del libro, appunti, esercizi svolti"
            multiline
            numberOfLines={3}
            style={stili.campoLungo}
          />

          <View style={stili.gruppo}>
            <Text style={stili.etichettaGruppo}>Ore di studio al giorno</Text>
            <View style={stili.rigaChip}>
              {ORE.map((o) => {
                const attivo = ore === o;
                return (
                  <Pressable
                    key={o}
                    onPress={() => setOre(o)}
                    style={[stili.chipOra, attivo && stili.chipOraAttiva]}
                  >
                    <Text style={[stili.testoChipOra, attivo && stili.testoAttivo]}>{o}h</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={stili.notaOre}>
              È il massimo che ti chiederò in un giorno: se hai lezione, ci lavoro intorno.
            </Text>
          </View>

          <MessaggioErrore messaggio={errore} />

          {generazione ? (
            <View style={stili.attesa}>
              <ActivityIndicator color={colori.accento} />
              <Text style={stili.testoAttesa}>Sto costruendo il piano attorno al tuo orario…</Text>
            </View>
          ) : (
            <BottonePrimario etichetta="Crea il piano" onPress={genera} />
          )}
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
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: { color: colori.testo, fontSize: 20, fontWeight: '800' },
  vuoto: { padding: spazi.lg, gap: spazi.md },
  modulo: { padding: spazi.lg, paddingTop: spazi.sm, gap: spazi.lg },
  introInfo: { color: colori.testoSecondario, fontSize: 14, lineHeight: 21 },
  gruppo: { gap: spazi.sm },
  etichettaGruppo: { color: colori.testoSecondario, fontSize: 13, fontWeight: '600' },
  listaEsami: { gap: spazi.sm },
  cardEsame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  cardEsameAttiva: { borderColor: colori.accento, backgroundColor: colori.accentoTenue },
  materiaEsame: { color: colori.testo, fontSize: 16, fontWeight: '700' },
  testoAttivo: { color: colori.accento },
  dataEsame: { color: colori.testoSecondario, fontSize: 13, marginTop: 2 },
  campoLungo: { minHeight: 80, textAlignVertical: 'top' },
  rigaChip: { flexDirection: 'row', flexWrap: 'wrap', gap: spazi.sm },
  chipOra: {
    width: 52,
    paddingVertical: spazi.sm,
    borderRadius: raggi.sm,
    backgroundColor: colori.superficie,
    borderWidth: 1,
    borderColor: colori.bordo,
    alignItems: 'center',
  },
  chipOraAttiva: { backgroundColor: colori.accentoTenue, borderColor: colori.accento },
  testoChipOra: { color: colori.testoSecondario, fontSize: 15, fontWeight: '700' },
  notaOre: { color: colori.testoSecondario, fontSize: 12, lineHeight: 17 },
  attesa: { alignItems: 'center', gap: spazi.sm, paddingVertical: spazi.md },
  testoAttesa: { color: colori.testoSecondario, fontSize: 13 },
});
