import { Image, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colori, raggi, spazi } from '@/lib/theme';

// Testa intera della mascotte col cappello, sfondo trasparente (726x702).
const MASCOTTE = require('@/assets/images/lode-bot-testa.png');
const RAPPORTO = 702 / 726; // altezza/larghezza dell'immagine

export const CHAT_FAB_DIAMETRO = 56;
const LARG_IMG = 50; // la testa riempie il cerchio
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
    // anello sottile viola: stacca il cerchio bianco dalla pagina quasi bianca.
    borderWidth: 1.5,
    borderColor: colori.accento,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // solo il cappello sborda oltre il bordo superiore
    // ombra percepibile, così si legge come elemento toccabile.
    shadowColor: colori.testo,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  immagine: {
    width: LARG_IMG,
    height: ALT_IMG,
    // alzata dentro il cerchio: il mento resta interamente dentro, solo il
    // cappello sborda leggermente oltre il bordo superiore.
    transform: [{ translateY: -8 }],
  },
});
