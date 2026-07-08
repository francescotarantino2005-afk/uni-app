import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottonePrimario } from '@/components/BottonePrimario';
import { colori, raggi, spazi } from '@/lib/theme';

const PASSI_TOTALI = 3;

type Props = {
  passo: number;
  icona: keyof typeof Ionicons.glyphMap;
  titolo: string;
  descrizione: string;
  etichettaBottone: string;
  onAvanti: () => void;
  children?: ReactNode;
};

/** Cornice comune dei tre passi di onboarding: indicatore, icona, testi, contenuto, bottone. */
export function PassoOnboarding({
  passo,
  icona,
  titolo,
  descrizione,
  etichettaBottone,
  onAvanti,
  children,
}: Props) {
  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.indicatore}>
        {Array.from({ length: PASSI_TOTALI }, (_, i) => (
          <View key={i} style={[stili.puntino, i < passo && stili.puntinoAttivo]} />
        ))}
      </View>

      <View style={stili.contenuto}>
        <View style={stili.cerchioIcona}>
          <Ionicons name={icona} size={40} color={colori.accento} />
        </View>
        <Text style={stili.titolo}>{titolo}</Text>
        <Text style={stili.descrizione}>{descrizione}</Text>
        {children}
      </View>

      <View style={stili.pie}>
        <BottonePrimario etichetta={etichettaBottone} onPress={onAvanti} />
      </View>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
    paddingHorizontal: spazi.lg,
  },
  indicatore: {
    flexDirection: 'row',
    gap: spazi.sm,
    justifyContent: 'center',
    paddingVertical: spazi.md,
  },
  puntino: {
    width: 28,
    height: 4,
    borderRadius: raggi.pieno,
    backgroundColor: colori.bordo,
  },
  puntinoAttivo: {
    backgroundColor: colori.accento,
  },
  contenuto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.md,
  },
  cerchioIcona: {
    width: 96,
    height: 96,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spazi.sm,
  },
  titolo: {
    color: colori.testo,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  descrizione: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  pie: {
    paddingBottom: spazi.lg,
  },
});
