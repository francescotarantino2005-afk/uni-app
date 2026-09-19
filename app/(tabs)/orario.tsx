import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaLezioni } from '@/lib/orarioDb';
import { EventoOrario } from '@/lib/tipi';
import { GIORNI_BREVI, GIORNI_SETTIMANA, giornoOggi } from '@/lib/date';
import { RigaLezione } from '@/components/RigaLezione';
import { StatoVuoto } from '@/components/StatoVuoto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { BottoneChat } from '@/components/BottoneChat';
import { colori, raggi, spazi } from '@/lib/theme';

export default function SchermataOrario() {
  const [lezioni, setLezioni] = useState<EventoOrario[]>([]);
  const [giorno, setGiorno] = useState(giornoOggi());
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let attivo = true;
      (async () => {
        const { dati, errore } = await caricaLezioni();
        if (!attivo) return;
        setLezioni(dati);
        setErrore(errore);
        setCaricamento(false);
      })();
      return () => {
        attivo = false;
      };
    }, [])
  );

  const delGiorno = lezioni.filter((l) => l.giorno === giorno);

  return (
    <View style={stili.schermo}>
      <View style={stili.selettoreGiorni}>
        {GIORNI_BREVI.map((etichetta, i) => {
          const valore = i + 1;
          const attivo = giorno === valore;
          return (
            <Pressable
              key={etichetta}
              onPress={() => setGiorno(valore)}
              style={[stili.chipGiorno, attivo && stili.chipGiornoAttivo]}
            >
              <Text style={[stili.testoChip, attivo && stili.testoChipAttivo]}>{etichetta}</Text>
            </Pressable>
          );
        })}
      </View>

      <MessaggioErrore messaggio={errore} />

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <FlatList
          data={delGiorno}
          keyExtractor={(l) => l.id}
          contentContainerStyle={stili.lista}
          renderItem={({ item }) => (
            <RigaLezione lezione={item} onPress={() => router.push(`/lezione?id=${item.id}`)} />
          )}
          ListEmptyComponent={
            <StatoVuoto
              titolo={`Niente lezioni di ${GIORNI_SETTIMANA[giorno - 1].toLowerCase()}`}
              suggerimento="Aggiungine una col bottone qui sotto."
            />
          }
        />
      )}

      <View style={stili.barraAzioni}>
        <Pressable style={stili.bottoneImporta} onPress={() => router.push('/importa-orario')}>
          <Ionicons name="camera-outline" size={22} color={colori.accento} />
          <Text style={stili.testoImporta}>Importa da foto</Text>
        </Pressable>
        <Pressable
          style={stili.bottoneAggiungi}
          onPress={() => router.push(`/lezione?giorno=${giorno}`)}
        >
          <Ionicons name="add" size={26} color={colori.sfondo} />
          <Text style={stili.testoAggiungi}>Lezione</Text>
        </Pressable>
      </View>

      <BottoneChat />
    </View>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
    padding: spazi.md,
    gap: spazi.md,
  },
  selettoreGiorni: {
    flexDirection: 'row',
    gap: spazi.xs,
  },
  chipGiorno: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spazi.sm,
    borderRadius: raggi.sm,
    backgroundColor: colori.superficie,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  chipGiornoAttivo: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
  },
  testoChip: {
    color: colori.testoSecondario,
    fontSize: 12,
    fontWeight: '600',
  },
  testoChipAttivo: {
    color: colori.accento,
  },
  lista: {
    gap: spazi.sm,
    // spazio ampio: barra azioni alzata + chat FAB; l'ultima riga (anche stato vuoto) resta libera.
    paddingBottom: 150,
  },
  barraAzioni: {
    position: 'absolute',
    right: spazi.lg,
    // alzata sopra il pulsante chat flottante (56 + margine).
    bottom: 80,
    flexDirection: 'row',
    gap: spazi.sm,
  },
  bottoneImporta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    backgroundColor: colori.superficie,
    borderColor: colori.accento,
    borderWidth: 1,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoImporta: {
    color: colori.accento,
    fontSize: 14,
    fontWeight: '700',
  },
  bottoneAggiungi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    backgroundColor: colori.accento,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoAggiungi: {
    color: colori.sfondo,
    fontSize: 15,
    fontWeight: '700',
  },
});
