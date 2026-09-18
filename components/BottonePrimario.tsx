import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  etichetta: string;
  onPress: () => void;
  disabilitato?: boolean;
  caricamento?: boolean;
};

export function BottonePrimario({
  etichetta,
  onPress,
  disabilitato = false,
  caricamento = false,
}: Props) {
  const inattivo = disabilitato || caricamento;
  return (
    <Pressable
      onPress={onPress}
      disabled={inattivo}
      style={({ pressed }) => [
        stili.bottone,
        pressed && stili.premuto,
        inattivo && stili.disabilitato,
      ]}
    >
      {caricamento ? (
        <ActivityIndicator color={colori.sfondo} />
      ) : (
        <Text style={stili.etichetta}>{etichetta}</Text>
      )}
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
    minHeight: 52,
    justifyContent: 'center',
  },
  premuto: {
    opacity: 0.85,
  },
  disabilitato: {
    opacity: 0.4,
  },
  etichetta: {
    color: colori.sfondo,
    fontSize: 16,
    fontWeight: '700',
  },
});
