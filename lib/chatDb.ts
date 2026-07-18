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

/** Carica lo storico della chat (ordine cronologico). */
export async function caricaStorico(): Promise<MessaggioChat[]> {
  const { data } = await supabase
    .from('chat_messages')
    .select('id, ruolo, contenuto')
    .order('created_at', { ascending: true });
  return (data as MessaggioChat[]) ?? [];
}

export type EsitoInvio =
  | { tipo: 'ok'; risposta: string }
  | { tipo: 'cap' } // cap giornaliero raggiunto → upsell
  | { tipo: 'errore'; messaggio: string };

/** Invia un messaggio alla chat AI. */
export async function inviaMessaggioChat(messaggio: string): Promise<EsitoInvio> {
  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: { messaggio },
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const corpo = await error.context.json().catch(() => null);
        const codice = corpo?.errore as string | undefined;
        if (codice === 'CAP_RAGGIUNTO') return { tipo: 'cap' };
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
