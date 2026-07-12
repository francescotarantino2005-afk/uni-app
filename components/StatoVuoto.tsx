import { StyleSheet, Text, View } from 'react-native';
import { colori, spazi } from '@/lib/theme';

type Props = {
  titolo: string;
  suggerimento?: string;
};

/** Stato vuoto curato per liste senza contenuti. */
export function StatoVuoto({ titolo, suggerimento }: Props) {
  return (
    <View style={stili.contenitore}>
      <Text style={stili.titolo}>{titolo}</Text>
      {suggerimento ? <Text style={stili.suggerimento}>{suggerimento}</Text> : null}
    </View>
  );
}

const stili = StyleSheet.create({
  contenitore: {
    alignItems: 'center',
    paddingVertical: spazi.xl,
    paddingHorizontal: spazi.lg,
    gap: spazi.xs,
  },
  titolo: {
    color: colori.testo,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  suggerimento: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
