import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { estraiOrarioDaFoto } from '@/lib/estrazioneOrario';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { SelettoreFotoOrario } from '@/components/SelettoreFotoOrario';
import { colori, spazi } from '@/lib/theme';

/** Import dell'orario da foto, richiamabile dalla tab Orario. */
export default function SchermataImportaOrario() {
  const fotoOrario = useAppStore((s) => s.fotoOrario);
  const impostaFotoOrario = useAppStore((s) => s.impostaFotoOrario);
  const impostaLezioniEstratte = useAppStore((s) => s.impostaLezioniEstratte);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const estrai = async () => {
    if (!fotoOrario) return;
    setErrore(null);
    setCaricamento(true);
    const { lezioni, errore: erroreEstrazione } = await estraiOrarioDaFoto(
      fotoOrario.base64,
      fotoOrario.tipo
    );
    setCaricamento(false);

    if (erroreEstrazione || !lezioni) {
      setErrore(erroreEstrazione);
      return;
    }
    impostaLezioniEstratte(lezioni);
    router.replace('/anteprima-orario?da=orario');
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Importa da foto</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={stili.contenuto}>
        <Text style={stili.descrizione}>
          Una foto o uno screenshot dell'orario delle lezioni: l'AI lo legge e ti mostra
          un'anteprima da confermare. Le lezioni si aggiungono a quelle già presenti.
        </Text>
        <SelettoreFotoOrario foto={fotoOrario} onFoto={impostaFotoOrario} />
      </ScrollView>

      <View style={stili.pie}>
        <MessaggioErrore messaggio={errore} />
        <BottonePrimario
          etichetta={caricamento ? 'Sto leggendo il tuo orario…' : 'Estrai le lezioni'}
          onPress={estrai}
          disabilitato={!fotoOrario}
          caricamento={caricamento}
        />
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '800',
  },
  contenuto: {
    padding: spazi.lg,
    paddingTop: spazi.sm,
    gap: spazi.md,
  },
  descrizione: {
    color: colori.testoSecondario,
    fontSize: 14,
    lineHeight: 21,
  },
  pie: {
    padding: spazi.lg,
    gap: spazi.md,
  },
});
