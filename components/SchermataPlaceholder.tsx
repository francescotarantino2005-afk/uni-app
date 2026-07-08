import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  icona: keyof typeof Ionicons.glyphMap;
  titolo: string;
  descrizione: string;
  sprint?: string;
};

/** Schermata vuota ma curata, usata come segnaposto finché la feature non viene costruita. */
export function SchermataPlaceholder({ icona, titolo, descrizione, sprint }: Props) {
  return (
    <View style={stili.contenitore}>
      <View style={stili.cerchioIcona}>
        <Ionicons name={icona} size={36} color={colori.accento} />
      </View>
      <Text style={stili.titolo}>{titolo}</Text>
      <Text style={stili.descrizione}>{descrizione}</Text>
      {sprint ? (
        <View style={stili.badge}>
          <Text style={stili.testoBadge}>{sprint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const stili = StyleSheet.create({
  contenitore: {
    flex: 1,
    backgroundColor: colori.sfondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spazi.xl,
    gap: spazi.md,
  },
  cerchioIcona: {
    width: 84,
    height: 84,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titolo: {
    color: colori.testo,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  descrizione: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  badge: {
    marginTop: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.xs,
    paddingHorizontal: spazi.md,
  },
  testoBadge: {
    color: colori.testoSecondario,
    fontSize: 12,
    fontWeight: '600',
  },
});
