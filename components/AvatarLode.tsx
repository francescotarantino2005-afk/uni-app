import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { pose, type Posa } from '@/lib/pose';

// Le pose sono a figura intera (1024x1024, allineate tra loro): la testa col
// tocco sta in un quadrato di circa 600 px con il centro in (518, 380). Si
// ingrandisce l'immagine e si inquadra solo quel quadrato.
const QUADRATO = 600;
const CENTRO_X = 518;
const CENTRO_Y = 380;
const DISSOLVENZA_MS = 320;

/**
 * La testa del robot: nell'intestazione (32) e sopra l'ultima risposta (48).
 * Cambia solo posa, con una dissolvenza incrociata: la vecchia sfuma mentre la
 * nuova compare, e alla fine resta UNA sola immagine (le pose hanno lo sfondo
 * trasparente: due pose sovrapposte si vedrebbero entrambe).
 */
export function AvatarLode({ posa, lato = 48 }: { posa: Posa; lato?: number }) {
  const [vecchia, setVecchia] = useState<Posa | null>(null);
  const [attuale, setAttuale] = useState<Posa>(posa);
  const entra = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (posa === attuale) return;
    entra.stopAnimation();
    setVecchia(attuale);
    setAttuale(posa);
    entra.setValue(0);
    Animated.timing(entra, { toValue: 1, duration: DISSOLVENZA_MS, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setVecchia(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posa]);

  const scala = lato / QUADRATO;
  const immagine = {
    position: 'absolute' as const,
    width: 1024 * scala,
    height: 1024 * scala,
    left: -(CENTRO_X - QUADRATO / 2) * scala,
    top: -(CENTRO_Y - QUADRATO / 2) * scala,
  };
  const esce = entra.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View
      style={[stili.riquadro, { width: lato, height: lato }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {vecchia ? <Animated.Image source={pose[vecchia]} style={[immagine, { opacity: esce }]} resizeMode="contain" /> : null}
      <Animated.Image source={pose[attuale]} style={[immagine, { opacity: entra }]} resizeMode="contain" />
    </View>
  );
}

const stili = StyleSheet.create({
  riquadro: {
    overflow: 'hidden',
  },
});
