import { StyleSheet, Text, View } from 'react-native';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  messaggio: string | null;
  /** true per messaggi informativi (non errori), es. "controlla la mail" */
  informativo?: boolean;
};

/** Riquadro di errore/avviso visibile, da mostrare vicino all'azione fallita. */
export function MessaggioErrore({ messaggio, informativo = false }: Props) {
  if (!messaggio) return null;
  return (
    <View style={[stili.riquadro, informativo && stili.riquadroInfo]}>
      <Text style={[stili.testo, informativo && stili.testoInfo]}>{messaggio}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  riquadro: {
    // La tinta rossa non è un token: box neutro con bordo/testo d'errore (leggibile come errore).
    backgroundColor: colori.superficie,
    borderColor: colori.errore,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  // Messaggio informativo (non toccabile): niente viola decorativo, resta neutro.
  riquadroInfo: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
  },
  testo: {
    color: colori.errore,
    fontSize: 14,
    lineHeight: 20,
  },
  testoInfo: {
    color: colori.testo,
  },
});
