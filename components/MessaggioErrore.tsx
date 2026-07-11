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
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: colori.errore,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  riquadroInfo: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
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
