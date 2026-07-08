import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const CHIAVE_ONBOARDING = 'onboarding_completato';

type StatoApp = {
  /** false finché non abbiamo letto lo stato persistito dal dispositivo */
  pronto: boolean;
  onboardingCompletato: boolean;
  caricaStato: () => Promise<void>;
  completaOnboarding: () => Promise<void>;
  /** Solo per sviluppo: riporta l'app al primo avvio */
  azzeraOnboarding: () => Promise<void>;
};

export const useAppStore = create<StatoApp>((set) => ({
  pronto: false,
  onboardingCompletato: false,

  caricaStato: async () => {
    try {
      const valore = await SecureStore.getItemAsync(CHIAVE_ONBOARDING);
      set({ onboardingCompletato: valore === 'true', pronto: true });
    } catch {
      set({ pronto: true });
    }
  },

  completaOnboarding: async () => {
    set({ onboardingCompletato: true });
    try {
      await SecureStore.setItemAsync(CHIAVE_ONBOARDING, 'true');
    } catch {
      // Storage non disponibile (es. web): lo stato resta valido in memoria.
    }
  },

  azzeraOnboarding: async () => {
    set({ onboardingCompletato: false });
    try {
      await SecureStore.deleteItemAsync(CHIAVE_ONBOARDING);
    } catch {
      // Storage non disponibile (es. web): lo stato resta valido in memoria.
    }
  },
}));
