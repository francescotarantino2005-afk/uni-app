import { supabase } from '@/lib/supabase';
import {
  CHIAVI,
  type Chiave,
  type EsitoTurno,
  type InputTurno,
  type Messaggio,
  profiloCompleto,
} from '@/lib/dialogoLogica';

// La parte con la rete del dialogo di accoglienza: un turno con la Edge Function
// accoglienza-dialogo. Regole e ripiego stanno in lib/dialogoLogica.ts.

const ATTESA_MASSIMA_MS = 30_000;

/**
 * Un turno con la function. Ritorna null per QUALSIASI problema (rete, timeout,
 * errore del server, risposta malformata): chi chiama passa al ripiego a testi
 * fissi, il dialogo non si blocca mai.
 */
export async function turnoDialogo(
  input: InputTurno,
  arretrati: Messaggio[]
): Promise<{ esito: EsitoTurno; messaggi_salvati: boolean } | null> {
  try {
    const chiamata = supabase.functions.invoke('accoglienza-dialogo', {
      body: {
        nome_bot: input.nomeBot,
        conversazione: input.conversazione,
        profilo_studio: input.profilo,
        chieste: input.chieste,
        libretto: { media: input.libretto.media, cfu: input.libretto.cfu, da_sostenere: input.esami },
        arretrati,
      },
    });
    const scadenza = new Promise<null>((risolvi) => setTimeout(() => risolvi(null), ATTESA_MASSIMA_MS));
    const risposta = await Promise.race([chiamata, scadenza]);
    if (!risposta || risposta.error) return null;
    const d = risposta.data as Record<string, unknown> | null;
    if (!d || typeof d.risposta_bot !== 'string' || !d.risposta_bot.trim()) return null;

    const chieste = (Array.isArray(d.chieste) ? d.chieste : []).filter((k): k is Chiave =>
      (CHIAVI as readonly unknown[]).includes(k)
    );
    const prossima = (CHIAVI as readonly unknown[]).includes(d.prossima_chiave)
      ? (d.prossima_chiave as Chiave)
      : null;
    if (chieste.length === 0) return null;
    return {
      esito: {
        risposta_bot: d.risposta_bot.trim(),
        profilo: profiloCompleto(d.profilo_studio),
        chieste,
        prossima_chiave: prossima,
        fine: d.fine === true || prossima === null,
        aiuto: d.aiuto === true,
      },
      messaggi_salvati: d.messaggi_salvati === true,
    };
  } catch {
    return null;
  }
}
