import { supabase } from '@/lib/supabase';

// Lato app della coda delle domande: due chiamate alla Edge Function
// coda-domande. Le regole (una al giorno, mai due di fila, niente se c'è un
// esame entro 48 ore, "fatta" / "saltata") stanno tutte lato server.
// Qualsiasi errore ritorna null: la chat prosegue come se la coda non esistesse.

/** Lo studente ha aperto la chat: il bot ha una domanda da riproporre? */
export async function apriCoda(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('coda-domande', {
      body: { azione: 'apri' },
    });
    if (error) return null;
    const messaggio = data?.messaggio;
    return typeof messaggio === 'string' && messaggio.trim() ? messaggio : null;
  } catch {
    return null;
  }
}

export type EsitoRispostaCoda =
  | { tipo: 'risposta'; risposta: string } // era la risposta: salvata, il bot conferma
  | { tipo: 'ignorata' } // non era una risposta: il messaggio va alla chat normale
  | null; // nessuna domanda in attesa, o errore: chat normale

/** Lo studente ha scritto mentre una domanda era in attesa. */
export async function rispostaCoda(messaggio: string, id: string): Promise<EsitoRispostaCoda> {
  try {
    const { data, error } = await supabase.functions.invoke('coda-domande', {
      body: { azione: 'risposta', messaggio, id },
    });
    if (error) return null;
    if (data?.tipo === 'risposta' && typeof data.risposta === 'string' && data.risposta.trim()) {
      return { tipo: 'risposta', risposta: data.risposta };
    }
    if (data?.tipo === 'ignorata') return { tipo: 'ignorata' };
    return null;
  } catch {
    return null;
  }
}
