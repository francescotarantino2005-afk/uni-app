import { StyleSheet, Text, View } from 'react-native';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  /** variante compatta, per l'header della home */
  piccolo?: boolean;
};

/** Piccolo badge testuale "Beta": segnala che l'app è in evoluzione. */
export function BadgeBeta({ piccolo = false }: Props) {
  return (
    <View style={[stili.badge, piccolo && stili.badgePiccolo]}>
      <Text style={[stili.testo, piccolo && stili.testoPiccolo]}>Beta</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  badge: {
    // Badge informativo, non toccabile: neutro, niente viola decorativo.
    alignSelf: 'flex-start',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.pieno,
    paddingHorizontal: spazi.sm,
    paddingVertical: 2,
  },
  badgePiccolo: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  testo: {
    color: colori.testoSecondario,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  testoPiccolo: {
    fontSize: 10,
  },
});
