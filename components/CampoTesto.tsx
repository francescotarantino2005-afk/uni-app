import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = TextInputProps & {
  etichetta: string;
};

export function CampoTesto({ etichetta, ...propsInput }: Props) {
  return (
    <View style={stili.contenitore}>
      <Text style={stili.etichetta}>{etichetta}</Text>
      <TextInput
        placeholderTextColor={colori.testoSecondario}
        style={stili.campo}
        {...propsInput}
      />
    </View>
  );
}

const stili = StyleSheet.create({
  contenitore: {
    gap: spazi.xs,
  },
  etichetta: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
  },
  campo: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
    color: colori.testo,
    fontSize: 16,
  },
});
