import { Image, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colori, raggi, spazi } from '@/lib/theme';

// Testa intera della mascotte col cappello, sfondo trasparente (726x702).
const MASCOTTE = require('@/assets/images/lode-bot-testa.png');
const RAPPORTO = 702 / 726; // altezza/larghezza dell'immagine

export const CHAT_FAB_DIAMETRO = 56;
const LARG_IMG = 52; // ~93% del pulsante: la testa riempie il cerchio
const ALT_IMG = LARG_IMG * RAPPORTO;

/**
 * Pulsante flottante che apre la Chat. Va messo sulle schermate a contenuto
 * (Oggi, Orario, Scadenze, Libretto), MAI dentro la Chat. Posizionato in basso
 * a destra, sopra la tab bar. L'immagine non è specchiata né ruotata.
 */
export function BottoneChat() {
  return (
    <Pressable
      onPress={() => router.navigate('/chat')}
      accessibilityRole="button"
      accessibilityLabel="Apri la chat con Lode"
      style={stili.bottone}
      hitSlop={8}
    >
      <Image source={MASCOTTE} style={stili.immagine} resizeMode="contain" />
    </Pressable>
  );
}

const stili = StyleSheet.create({
  bottone: {
    position: 'absolute',
    right: spazi.md,
    bottom: spazi.md,
    width: CHAT_FAB_DIAMETRO,
    height: CHAT_FAB_DIAMETRO,
    borderRadius: raggi.pieno,
    backgroundColor: colori.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // il cappello sborda oltre il bordo superiore
    shadowColor: colori.testo,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  immagine: {
    width: LARG_IMG,
    height: ALT_IMG,
    // sposta l'immagine in su di poco: la faccia resta centrata e leggibile,
    // il cappello sborda leggermente oltre il bordo superiore del cerchio.
    transform: [{ translateY: -4 }],
  },
});
