import { create } from 'zustand';
import * as Linking from 'expo-linking';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profilo } from '@/lib/tipi';
import { LezioneEstratta } from '@/lib/estrazioneOrario';
import type { EsameEstratto } from '@/lib/estrazioneLibretto';
import { Reazione, puoMostrare } from '@/lib/reazioni';
import { daProporreNotifiche } from '@/lib/notifiche';
import { dopoTargetSuperato, profiloCompleto } from '@/lib/dialogoLogica';

type TokenRecupero = { access_token: string; refresh_token: string };

/**
 * Estrae i token da un deep link di recupero password.
 * - null     → non è un link di recupero
 * - 'errore' → è un link di recupero ma scaduto/invalido (niente token usabili)
 */
function leggiLinkRecupero(url: string): TokenRecupero | 'errore' | null {
  const hIndex = url.indexOf('#');
  const qIndex = url.indexOf('?');
  const frammento = hIndex >= 0 ? url.slice(hIndex + 1) : '';
  const query = qIndex >= 0 ? url.slice(qIndex + 1, hIndex >= 0 ? hIndex : undefined) : '';
  const p = new URLSearchParams([frammento, query].filter(Boolean).join('&'));

  const isRecupero = p.get('type') === 'recovery' || url.includes('reset-password');
  if (!isRecupero) return null;
  if (p.get('error')) return 'errore';

  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token');
  if (access_token && refresh_token) return { access_token, refresh_token };
  return 'errore';
}

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

  /**
   * Flag di recupero password. SOLO in memoria (lo store non ha persist): a ogni
   * avvio riparte da false. Non deve MAI essere persistito, altrimenti un percorso
   * abbandonato inchioderebbe l'utente su /reset-password per sempre.
   */
  recupero: boolean;

  // dati raccolti durante l'onboarding / import (solo in memoria)
  ateneoSelezionato: string | null;
  fotoOrario: FotoOrario | null;
  lezioniEstratte: LezioneEstratta[] | null;
  /** foto del libretto in attesa di lettura (più pagine, una chiamata sola) */
  fotoLibretto: FotoOrario[];
  /** esami letti dalle foto, NON ancora salvati: si salvano solo dopo la conferma */
  esamiEstratti: EsameEstratto[] | null;

  /**
   * Reazione del personaggio a schermo (solo in memoria: all'avvio non c'è mai
   * niente da mostrare, compare solo se è appena successo qualcosa).
   */
  reazione: Reazione | null;
  reazioneChiusaAlle: number | null;
  /** Mostra una reazione se il freno lo permette. Ritorna true se è partita. */
  mostraReazione: (reazione: Reazione | null) => boolean;
  chiudiReazione: () => void;
  /** true mentre il bot sta spiegando perché servono le notifiche (prima scadenza aggiunta). */
  richiestaNotifiche: boolean;
  /**
   * Da chiamare dopo aver aggiunto una scadenza: se era la PRIMA e il permesso
   * non è mai stato chiesto, fa comparire la spiegazione del bot. Mai prima.
   */
  scadenzaAggiunta: (eraLaPrima: boolean) => Promise<void>;
  chiudiRichiestaNotifiche: () => void;
  /** L'esame target è stato superato: azzera il target e mette in coda "qual è il prossimo?". */
  segnaTargetSuperato: () => Promise<void>;

  avvia: () => Promise<void>;
  caricaProfilo: () => Promise<void>;
  impostaAteneo: (ateneo: string) => void;
  impostaFotoOrario: (foto: FotoOrario | null) => void;
  impostaLezioniEstratte: (lezioni: LezioneEstratta[] | null) => void;
  impostaFotoLibretto: (foto: FotoOrario[]) => void;
  impostaEsamiEstratti: (esami: EsameEstratto[] | null) => void;
  /** Crea/aggiorna la riga profiles durante l'accoglienza (salvataggio progressivo). */
  aggiornaAccoglienza: (patch: Partial<Profilo>) => Promise<string | null>;
  /** Segna l'accoglienza come completata. Ritorna un messaggio d'errore o null. */
  completaOnboarding: () => Promise<string | null>;
  /** Aggiorna l'ora del briefing in profiles. Ritorna un messaggio d'errore o null. */
  aggiornaOraBriefing: (oraHHMM: string) => Promise<string | null>;
  /** Entra in modalità recupero da un deep link. Ritorna true se era un link di recupero. */
  entraInRecupero: (url: string) => Promise<boolean>;
  /** Chiude il recupero dopo updateUser riuscito: sblocca e porta dentro l'app. */
  completaRecupero: () => Promise<void>;
  /** Annulla il recupero: esce dalla sessione e torna al login. */
  annullaRecupero: () => Promise<void>;
  esci: () => Promise<void>;
};

export const useAppStore = create<StatoApp>((set, get) => ({
  pronto: false,
  utente: null,
  profilo: null,
  recupero: false,
  ateneoSelezionato: null,
  fotoOrario: null,
  lezioniEstratte: null,
  fotoLibretto: [],
  esamiEstratti: null,
  reazione: null,
  reazioneChiusaAlle: null,

  mostraReazione: (reazione) => {
    if (!reazione) return false;
    const { reazione: attuale, reazioneChiusaAlle } = get();
    if (!puoMostrare({ visibile: attuale != null, chiusaAlle: reazioneChiusaAlle }, Date.now())) {
      return false;
    }
    set({ reazione });
    return true;
  },
  chiudiReazione: () => set({ reazione: null, reazioneChiusaAlle: Date.now() }),

  richiestaNotifiche: false,
  scadenzaAggiunta: async (eraLaPrima) => {
    if (!eraLaPrima) return;
    if (await daProporreNotifiche()) set({ richiestaNotifiche: true });
  },
  chiudiRichiestaNotifiche: () => set({ richiestaNotifiche: false }),

  segnaTargetSuperato: async () => {
    const profilo = get().profilo;
    if (!profilo) return;
    await get().aggiornaAccoglienza(
      dopoTargetSuperato(
        profiloCompleto(profilo.profilo_studio),
        Array.isArray(profilo.domande_in_coda) ? profilo.domande_in_coda : []
      )
    );
  },

  avvia: async () => {
    try {
      // PRECEDENZA ASSOLUTA: se l'app è aperta da un link di recupero, entra in
      // modalità recupero PRIMA di validare qualsiasi sessione. Così, anche se in
      // cache c'è una sessione valida (di recupero o vecchia), getUser() non può
      // mandare l'utente dentro l'app senza aver impostato una nuova password.
      const urlIniziale = await Linking.getInitialURL();
      const inRecupero = urlIniziale ? await get().entraInRecupero(urlIniziale) : false;

      if (!inRecupero) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          // Valida la sessione col server. Se l'utente è stato eliminato (es. "Elimina
          // account" riuscito ma il client è caduto prima dell'uscita), il server
          // risponde con un errore di auth → sessione ORFANA: pulisci e vai al login.
          // Un errore di rete (offline) NON è motivo di logout: si riparte dalla cache.
          let orfano = false;
          let utenteValido = session.user;
          try {
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser();
            if (user) {
              utenteValido = user;
            } else if (error && (error.status ?? 0) >= 400) {
              orfano = true;
            }
            // errore di rete (status 0) o eccezione → si resta con session.user (offline)
          } catch {
            // offline: si tiene la sessione in cache
          }

          if (orfano) {
            await supabase.auth.signOut();
            set({ utente: null });
          } else {
            set({ utente: utenteValido });
            await get().caricaProfilo();
            // Segna l'attività (difesa costi: il cron salta chi è inattivo da 14+ giorni).
            // Best effort, non blocca l'avvio.
            supabase
              .from('profiles')
              .update({ ultimo_accesso: new Date().toISOString() })
              .eq('id', utenteValido.id)
              .then(() => {});
          }
        } else {
          set({ utente: null });
        }
      }
    } catch {
      // offline all'avvio: si riparte dalla schermata di accesso
    } finally {
      set({ pronto: true });
    }

    // Solo aggiornamenti di stato qui dentro: chiamate a Supabase in questo
    // callback possono bloccarsi (limite documentato di supabase-js).
    supabase.auth.onAuthStateChange((evento, sessione) => {
      // PASSWORD_RECOVERY (percorso web, dove detectSessionInUrl può emetterlo):
      // congela il routing invece di trattarlo come un login normale.
      if (evento === 'PASSWORD_RECOVERY') {
        set({ recupero: true, utente: null });
        return;
      }
      // Durante il recupero la sessione serve solo a updateUser: il routing resta
      // inchiodato su /reset-password finché non si completa o si annulla.
      if (get().recupero) return;
      set({ utente: sessione?.user ?? null });
      if (!sessione?.user) {
        set({
          profilo: null,
          ateneoSelezionato: null,
          fotoOrario: null,
          lezioniEstratte: null,
          fotoLibretto: [],
          esamiEstratti: null,
        });
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
  impostaFotoLibretto: (foto) => set({ fotoLibretto: foto }),
  impostaEsamiEstratti: (esami) => set({ esamiEstratti: esami }),

  aggiornaAccoglienza: async (patch) => {
    const { utente } = get();
    if (!utente) return 'Sessione scaduta: accedi di nuovo.';

    // upsert sull'id (primary key): crea la riga al primo passo (ateneo) e la
    // aggiorna ai passi successivi, senza toccare le colonne non passate.
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: utente.id, ...patch })
      .select()
      .single();

    if (error) {
      if (/network request failed|fetch failed/i.test(error.message)) {
        return 'Sembra che tu sia offline: controlla la connessione e riprova.';
      }
      return 'Non siamo riusciti a salvare. Riprova tra poco.';
    }

    set({ profilo: data as Profilo });
    return null;
  },

  completaOnboarding: async () => get().aggiornaAccoglienza({ accoglienza_stato: 'completata' }),

  aggiornaOraBriefing: async (oraHHMM) => {
    const { utente, profilo } = get();
    if (!utente) return 'Sessione scaduta: accedi di nuovo.';

    const { data, error } = await supabase
      .from('profiles')
      .update({ ora_briefing: `${oraHHMM}:00` })
      .eq('id', utente.id)
      .select()
      .single();

    if (error) {
      if (/network request failed|fetch failed/i.test(error.message)) {
        return 'Sembra che tu sia offline: controlla la connessione e riprova.';
      }
      return 'Non siamo riusciti a salvare l\'orario. Riprova tra poco.';
    }
    set({ profilo: (data as Profilo) ?? profilo });
    return null;
  },

  entraInRecupero: async (url) => {
    const esito = leggiLinkRecupero(url);
    if (esito === null) return false;
    // Pin immediato: da qui il guard inchioda l'utente su /reset-password.
    // utente/profilo restano fuori dal routing finché la password non è impostata.
    set({ recupero: true, utente: null, profilo: null });
    if (esito !== 'errore') {
      // Sessione stabilita coi token DEL LINK (non con quella eventualmente in
      // cache): updateUser agirà sull'account che ha chiesto il reset. Se i token
      // sono scaduti setSession fallisce: la schermata reset mostrerà "link scaduto".
      await supabase.auth.setSession(esito);
    }
    return true;
  },

  completaRecupero: async () => {
    // La sessione di recupero è piena: dopo updateUser l'utente entra già loggato.
    const { data } = await supabase.auth.getUser();
    set({ recupero: false, utente: data.user ?? null });
    await get().caricaProfilo();
  },

  annullaRecupero: async () => {
    set({ recupero: false });
    await supabase.auth.signOut();
    // utente/profilo azzerati da onAuthStateChange (ora che recupero è false)
  },

  esci: async () => {
    await supabase.auth.signOut();
    // lo stato viene azzerato da onAuthStateChange
  },
}));
