import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaNote, cancellaNota, cancellaTutteLeNote } from '@/lib/noteDb';
import { CategoriaNota, NotaStudente } from '@/lib/tipi';
import { StatoVuoto } from '@/components/StatoVuoto';
import { colori, raggi, spazi } from '@/lib/theme';

const ETICHETTE: Record<CategoriaNota, string> = {
  percorso: 'Percorso di studi',
  obiettivi: 'Obiettivi',
  metodo_studio: 'Metodo di studio',
  ostacoli: 'Ostacoli',
  preferenze: 'Preferenze',
  contesto: 'Contesto',
};
const ORDINE: CategoriaNota[] = ['percorso', 'obiettivi', 'metodo_studio', 'ostacoli', 'preferenze', 'contesto'];

export default function SchermataNoteMemoria() {
  const [note, setNote] = useState<NotaStudente[]>([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    (async () => {
      setNote(await caricaNote());
      setCaricamento(false);
    })();
  }, []);

  const eliminaUna = (id: string) => {
    setNote((prima) => prima.filter((n) => n.id !== id)); // ottimista
    cancellaNota(id);
  };

  const eliminaTutte = () => {
    if (note.length === 0) return;
    Alert.alert('Cancellare tutto?', 'Lode dimenticherà tutto quello che sa di te. Non si può annullare.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Cancella tutto',
        style: 'destructive',
        onPress: () => {
          setNote([]);
          cancellaTutteLeNote();
        },
      },
    ]);
  };

  const perCategoria = (c: CategoriaNota) => note.filter((n) => n.categoria === c);

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Cosa Lode ricorda di me</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : note.length === 0 ? (
        <View style={stili.vuoto}>
          <StatoVuoto
            titolo="Lode non ricorda ancora niente di te"
            suggerimento="Man mano che parlate, qui compaiono i punti utili per aiutarti meglio: il tuo percorso, i tuoi obiettivi, come studi."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={stili.contenuto}>
          <Text style={stili.introduzione}>
            Sono i punti che Lode tiene a mente per aiutarti meglio. Puoi cancellarli quando vuoi.
          </Text>

          {ORDINE.filter((c) => perCategoria(c).length > 0).map((c) => (
            <View key={c} style={stili.sezione}>
              <Text style={stili.titoloSezione}>{ETICHETTE[c]}</Text>
              {perCategoria(c).map((n) => (
                <View key={n.id} style={stili.nota}>
                  <Text style={stili.testoNota}>{n.contenuto}</Text>
                  <Pressable onPress={() => eliminaUna(n.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colori.testoSecondario} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}

          <Pressable style={stili.bottoneCancellaTutto} onPress={eliminaTutte}>
            <Ionicons name="trash-outline" size={18} color={colori.errore} />
            <Text style={stili.testoCancellaTutto}>Cancella tutto</Text>
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
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: { color: colori.testo, fontSize: 20, fontWeight: '800', flex: 1 },
  vuoto: { flex: 1, justifyContent: 'center', padding: spazi.lg },
  contenuto: { padding: spazi.lg, paddingTop: spazi.sm, gap: spazi.lg },
  introduzione: { color: colori.testoSecondario, fontSize: 14, lineHeight: 20 },
  sezione: { gap: spazi.sm },
  titoloSezione: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  testoNota: { flex: 1, color: colori.testo, fontSize: 15, lineHeight: 21 },
  bottoneCancellaTutto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.sm,
    borderColor: colori.errore,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    marginTop: spazi.sm,
  },
  testoCancellaTutto: { color: colori.errore, fontSize: 15, fontWeight: '700' },
});
