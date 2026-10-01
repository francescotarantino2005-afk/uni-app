import { supabase } from '@/lib/supabase';
import type { ChiaveProfiloStudio, ProfiloStudio } from '@/lib/tipi';
import {
  CHIAVI_DIALOGO,
  MessaggioDialogo,
  NUMERO_DOMANDE,
  RiassuntoLibretto,
} from '@/lib/dialogoLogica';

// La parte con la rete del dialogo di accoglienza. Costanti e logica pura
// stanno in lib/dialogoLogica.ts.
export * from '@/lib/dialogoLogica';

export type TurnoDialogo = {
  risposta_bot: string;
  chiave: ChiaveProfiloStudio;
  valore: unknown;
  prossima_domanda: number | null;
  messaggi_salvati: boolean;
};

const ATTESA_MASSIMA_MS = 25_000;

/**
 * Un turno con la Edge Function accoglienza-dialogo. Ritorna null per QUALSIASI
 * problema (rete, timeout, errore del server): chi chiama passa al testo fisso,
 * il dialogo non si blocca mai.
 */
export async function turnoDialogo(input: {
  nome_bot: string;
  numero: number;
  risposta: string;
  domanda_testo: string;
  chiarimento: boolean;
  profilo_studio: ProfiloStudio;
  libretto: RiassuntoLibretto;
  arretrati: MessaggioDialogo[];
}): Promise<TurnoDialogo | null> {
  try {
    const chiamata = supabase.functions.invoke('accoglienza-dialogo', { body: input });
    const scadenza = new Promise<null>((risolvi) => setTimeout(() => risolvi(null), ATTESA_MASSIMA_MS));
    const esito = await Promise.race([chiamata, scadenza]);
    if (!esito || esito.error) return null;
    const d = esito.data as Partial<TurnoDialogo> | null;
    if (!d || typeof d.risposta_bot !== 'string' || !d.risposta_bot.trim()) return null;
    const prossima = d.prossima_domanda;
    return {
      risposta_bot: d.risposta_bot.trim(),
      chiave: CHIAVI_DIALOGO[input.numero - 1],
      valore: d.valore ?? null,
      prossima_domanda:
        typeof prossima === 'number' && prossima >= input.numero && prossima <= NUMERO_DOMANDE
          ? prossima
          : null,
      messaggi_salvati: d.messaggi_salvati === true,
    };
  } catch {
    return null;
  }
}
