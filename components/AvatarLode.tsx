import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { pose, type Posa } from '@/lib/pose';
import { coloriChat } from '@/lib/theme';

const LATO = 44;
// Le pose sono a figura intera (1024x1024): si ingrandisce e si inquadra la
// testa col tocco, che sta nella parte alta dell'immagine.
const IMMAGINE = 76;
const SPOSTA_X = -16;
const SPOSTA_Y = -4;
const DISSOLVENZA_MS = 320;

/**
 * Il robot accanto alle risposte. Cambia solo posa, con una dissolvenza: la
 * nuova immagine compare sopra la vecchia. Niente altre animazioni.
 */
export function AvatarLode({ posa }: { posa: Posa }) {
  const [sotto, setSotto] = useState<Posa>(posa);
  const [sopra, setSopra] = useState<Posa>(posa);
  const opacita = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (posa === sopra) return;
    setSotto(sopra);
    setSopra(posa);
    opacita.setValue(0);
    Animated.timing(opacita, { toValue: 1, duration: DISSOLVENZA_MS, useNativeDriver: true }).start(() => setSotto(posa));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posa]);

  return (
    <View style={stili.cerchio} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.Image source={pose[sotto]} style={stili.immagine} resizeMode="contain" />
      <Animated.Image source={pose[sopra]} style={[stili.immagine, { opacity: opacita }]} resizeMode="contain" />
    </View>
  );
}

const stili = StyleSheet.create({
  cerchio: {
    width: LATO,
    height: LATO,
    borderRadius: LATO / 2,
    overflow: 'hidden',
    backgroundColor: coloriChat.violaTenue,
  },
  immagine: {
    position: 'absolute',
    width: IMMAGINE,
    height: IMMAGINE,
    left: SPOSTA_X,
    top: SPOSTA_Y,
  },
});
