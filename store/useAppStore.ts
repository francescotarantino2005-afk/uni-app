import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profilo } from '@/lib/tipi';
import { LezioneEstratta } from '@/lib/estrazioneOrario';

export type FotoOrario = {
  uri: string;
  base64: string;
  tipo: string;
};

/**
 * Stato globale dell'app.
 * La fonte di verità per "onboarding fatto" è l'esistenza della riga in profiles:
 * - utente null            → schermata di accesso
 * - utente senza profilo   → onboarding
 * - utente con profilo     → home
 */
type StatoApp = {
  /** false finché non abbiamo ripristinato sessione e profilo all'avvio */
  pronto: boolean;
  utente: User | null;
  profilo: Profilo | null;

  // dati raccolti durante l'onboarding / import (solo in memoria)
  ateneoSelezionato: string | null;
  fotoOrario: FotoOrario | null;
  lezioniEstratte: LezioneEstratta[] | null;

  avvia: () => Promise<void>;
  caricaProfilo: () => Promise<void>;
  impostaAteneo: (ateneo: string) => void;
  impostaFotoOrario: (foto: FotoOrario | null) => void;
  impostaLezioniEstratte: (lezioni: LezioneEstratta[] | null) => void;
  /** Crea la riga in profiles a fine onboarding. Ritorna un messaggio d'errore o null. */
  completaOnboarding: () => Promise<string | null>;
  esci: () => Promise<void>;
};

export const useAppStore = create<StatoApp>((set, get) => ({
  pronto: false,
  utente: null,
  profilo: null,
  ateneoSelezionato: null,
  fotoOrario: null,
  lezioniEstratte: null,

  avvia: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      set({ utente: session?.user ?? null });
      if (session?.user) {
        await get().caricaProfilo();
      }
    } catch {
      // offline all'avvio: si riparte dalla schermata di accesso
    } finally {
      set({ pronto: true });
    }

    // Solo aggiornamenti di stato qui dentro: chiamate a Supabase in questo
    // callback possono bloccarsi (limite documentato di supabase-js).
    supabase.auth.onAuthStateChange((_evento, sessione) => {
      set({ utente: sessione?.user ?? null });
      if (!sessione?.user) {
        set({ profilo: null, ateneoSelezionato: null, fotoOrario: null, lezioniEstratte: null });
      }
    });
  },

  caricaProfilo: async () => {
    const utente = get().utente ?? (await supabase.auth.getUser()).data.user;
    if (!utente) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', utente.id)
      .maybeSingle();
    if (!error) {
      set({ profilo: (data as Profilo) ?? null });
    }
  },

  impostaAteneo: (ateneo) => set({ ateneoSelezionato: ateneo }),
  impostaFotoOrario: (foto) => set({ fotoOrario: foto }),
  impostaLezioniEstratte: (lezioni) => set({ lezioniEstratte: lezioni }),

  completaOnboarding: async () => {
    const { utente, ateneoSelezionato } = get();
    if (!utente) return 'Sessione scaduta: accedi di nuovo.';

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: utente.id, ateneo: ateneoSelezionato })
      .select()
      .single();

    if (error) {
      if (/network request failed|fetch failed/i.test(error.message)) {
        return 'Sembra che tu sia offline: controlla la connessione e riprova.';
      }
      return 'Non siamo riusciti a salvare il profilo. Riprova tra poco.';
    }

    set({ profilo: data as Profilo });
    return null;
  },

  esci: async () => {
    await supabase.auth.signOut();
    // lo stato viene azzerato da onAuthStateChange
  },
}));
