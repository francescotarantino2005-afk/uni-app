import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { pose } from '@/lib/pose';
import { Reazione } from '@/lib/reazioni';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

const DURATA_MS = 4500; // poi si chiude da sola
const FUORI_SCHERMO = 420; // spostamento verso il basso per entrare e uscire
const LARGHEZZA = 170;
const RAPPORTO = 702 / 726; // dell'immagine attuale; con le pose a figura intera va aggiornato qui

/**
 * Il personaggio in sovrimpressione con una battuta corta. Entra dal basso con
 * un piccolo rimbalzo, esce in basso; si chiude al tocco o da sola dopo pochi
 * secondi. Va montato UNA volta sola, nel layout radice: cosa mostrare e quando
 * lo decide lo store (mostraReazione), che applica il freno.
 */
export function ReazionePersonaggio() {
  const reazione = useAppStore((s) => s.reazione);
  const chiudiReazione = useAppStore((s) => s.chiudiReazione);
  // Copia locale: resta a schermo durante l'animazione di uscita.
  const [mostrata, setMostrata] = useState<Reazione | null>(null);
  const spostamento = useRef(new Animated.Value(FUORI_SCHERMO)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inUscita = useRef(false);

  const esci = useCallback(() => {
    if (inUscita.current) return;
    inUscita.current = true;
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(spostamento, {
      toValue: FUORI_SCHERMO,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setMostrata(null);
      chiudiReazione();
    });
  }, [chiudiReazione, spostamento]);

  useEffect(() => {
    if (!reazione) return;
    inUscita.current = false;
    setMostrata(reazione);
    spostamento.setValue(FUORI_SCHERMO);
    Animated.spring(spostamento, {
      toValue: 0,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(esci, DURATA_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reazione, esci, spostamento]);

  if (!mostrata) return null;

  const alTocco = () => {
    if (mostrata.versoChat) router.navigate('/chat');
    esci();
  };

  return (
    <View style={stili.livello} pointerEvents="box-none">
      <Animated.View style={[stili.contenitore, { transform: [{ translateY: spostamento }] }]}>
        <Pressable onPress={alTocco} style={stili.tocco} accessibilityRole="button">
          <View style={stili.fumetto}>
            <Text style={stili.battuta}>{mostrata.battuta}</Text>
          </View>
          <Image source={pose[mostrata.posa]} style={stili.personaggio} resizeMode="contain" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const stili = StyleSheet.create({
  livello: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  contenitore: {
    marginBottom: spazi.xl,
    alignItems: 'center',
  },
  tocco: {
    alignItems: 'center',
    gap: spazi.sm,
  },
  fumetto: {
    maxWidth: 300,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  battuta: {
    color: colori.testo,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  personaggio: {
    width: LARGHEZZA,
    height: LARGHEZZA * RAPPORTO,
  },
});
