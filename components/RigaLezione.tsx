import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EventoOrario } from '@/lib/tipi';
import { oraBreve } from '@/lib/date';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  lezione: EventoOrario;
  onPress?: () => void;
};

export function RigaLezione({ lezione, onPress }: Props) {
  const orario = lezione.ora_fine
    ? `${oraBreve(lezione.ora_inizio)}–${oraBreve(lezione.ora_fine)}`
    : oraBreve(lezione.ora_inizio);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [stili.riga, pressed && onPress ? stili.premuta : null]}
    >
      <View style={[stili.barraColore, { backgroundColor: lezione.colore ?? colori.accento }]} />
      <View style={stili.corpo}>
        <Text style={stili.titolo} numberOfLines={1}>
          {lezione.titolo}
        </Text>
        <Text style={stili.dettagli}>
          {orario}
          {lezione.aula ? `  ·  ${lezione.aula}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  riga: {
    flexDirection: 'row',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    overflow: 'hidden',
  },
  premuta: {
    opacity: 0.8,
  },
  barraColore: {
    width: 5,
  },
  corpo: {
    flex: 1,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
    gap: 2,
  },
  titolo: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '600',
  },
  dettagli: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
});
