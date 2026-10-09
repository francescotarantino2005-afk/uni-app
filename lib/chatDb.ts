import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { MessaggioChat } from '@/lib/tipi';

const MESSAGGI_ERRORE: Record<string, string> = {
  TIMEOUT: 'La risposta sta tardando: riprova tra qualche secondo.',
  SERVIZIO_NON_DISPONIBILE: 'L\'assistente è momentaneamente occupato: riprova tra poco.',
  MESSAGGIO_TROPPO_LUNGO: 'Messaggio troppo lungo: prova a essere più sintetico.',
  NON_AUTORIZZATO: 'Sessione scaduta: esci e accedi di nuovo.',
};
const ERRORE_GENERICO = 'Qualcosa è andato storto. Riprova tra poco.';
const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';

/**
 * Carica lo storico di una conversazione (ordine cronologico). Nella "Generale"
 * ci sono anche i messaggi senza conversazione (accoglienza, domande in coda,
 * il messaggio che mantiene l'impegno).
 */
export async function caricaStorico(conversazione?: { id: string; generale: boolean } | null): Promise<MessaggioChat[]> {
  let q = supabase.from('chat_messages').select('id, ruolo, contenuto');
  if (conversazione) {
    q = conversazione.generale
      ? q.or(`conversazione_id.eq.${conversazione.id},conversazione_id.is.null`)
      : q.eq('conversazione_id', conversazione.id);
  }
  const { data } = await q.order('created_at', { ascending: true });
  return (data as MessaggioChat[]) ?? [];
}

export type EsitoInvio =
  | { tipo: 'ok'; risposta: string }
  | { tipo: 'cap' } // cap giornaliero raggiunto → upsell
  | { tipo: 'conversazione_sparita' } // eliminata da un altro dispositivo
  | { tipo: 'errore'; messaggio: string };

/**
 * Invia un messaggio alla chat AI.
 * `id` è generato una sola volta alla composizione e riusato nel retry: il server
 * lo usa come chiave di idempotenza, così un reinvio non duplica il messaggio.
 */
export async function inviaMessaggioChat(messaggio: string, id: string, conversazioneId?: string | null): Promise<EsitoInvio> {
  try {
    // Dalla 1.0.1 l'app mostra il Markdown leggero e ha le conversazioni.
    const { data, error } = await supabase.functions.invoke('chat', {
      body: { messaggio, id, formato: 'markdown', ...(conversazioneId ? { conversazione_id: conversazioneId } : {}) },
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const corpo = await error.context.json().catch(() => null);
        const codice = corpo?.errore as string | undefined;
        if (codice === 'CAP_RAGGIUNTO') return { tipo: 'cap' };
        if (codice === 'CONVERSAZIONE_NON_TROVATA') return { tipo: 'conversazione_sparita' };
        return { tipo: 'errore', messaggio: (codice && MESSAGGI_ERRORE[codice]) || ERRORE_GENERICO };
      }
      return { tipo: 'errore', messaggio: ERRORE_RETE };
    }

    const risposta = data?.risposta as string | undefined;
    if (!risposta) return { tipo: 'errore', messaggio: ERRORE_GENERICO };
    return { tipo: 'ok', risposta };
  } catch {
    return { tipo: 'errore', messaggio: ERRORE_RETE };
  }
}

export type EsitoImpegno = 'mantenuto' | 'in_corso' | 'da_mantenere' | 'nessuno' | 'errore';

/**
 * Chiede alla chat di mantenere ADESSO l'impegno preso a fine accoglienza. Il
 * server lo fa una volta sola: se è già fatto risponde "mantenuto", se un
 * tentativo è in corso "in_corso". Il messaggio si legge poi da chat_messages.
 */
export async function mantieniImpegno(): Promise<EsitoImpegno> {
  try {
    const { data, error } = await supabase.functions.invoke('chat', { body: { azione: 'mantieni_impegno' } });
    if (error) return 'errore';
    const stato = data?.stato;
    return stato === 'mantenuto' || stato === 'in_corso' || stato === 'da_mantenere' || stato === 'nessuno'
      ? stato
      : 'errore';
  } catch {
    return 'errore';
  }
}

/** Un messaggio della chat per id (quello che mantiene l'impegno). */
export async function caricaMessaggio(id: string): Promise<MessaggioChat | null> {
  const { data } = await supabase.from('chat_messages').select('id, ruolo, contenuto').eq('id', id).maybeSingle();
  return (data as MessaggioChat) ?? null;
}

/** Traccia un evento (es. interesse Plus / referral). Best effort. */
export async function registraEvento(evento: string, meta?: Record<string, unknown>): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from('analytics').insert({ user_id: data.user.id, evento, meta: meta ?? null });
  } catch {
    // best effort
  }
}
