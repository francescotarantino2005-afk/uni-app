import { Pressable, StyleSheet, Text } from 'react-native';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  etichetta: string;
  onPress: () => void;
  disabilitato?: boolean;
};

export function BottonePrimario({ etichetta, onPress, disabilitato = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabilitato}
      style={({ pressed }) => [
        stili.bottone,
        pressed && stili.premuto,
        disabilitato && stili.disabilitato,
      ]}
    >
      <Text style={stili.etichetta}>{etichetta}</Text>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  bottone: {
    backgroundColor: colori.accento,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.lg,
    alignItems: 'center',
  },
  premuto: {
    opacity: 0.85,
  },
  disabilitato: {
    opacity: 0.4,
  },
  etichetta: {
    color: '#0D0F14',
    fontSize: 16,
    fontWeight: '700',
  },
});
