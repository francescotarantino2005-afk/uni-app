import { supabase } from '@/lib/supabase';

/**
 * Avvia l'eliminazione dell'account. Il client non può cancellare sé stesso:
 * chiama la Edge Function `elimina-account`, che verifica il JWT e cancella
 * l'utente (e a cascata tutti i suoi dati) con la service role lato server.
 * Ritorna null se andata a buon fine, altrimenti un messaggio d'errore in italiano.
 */
export async function eliminaAccount(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('elimina-account');
    if (error || !data?.ok) {
      return 'Non siamo riusciti a eliminare l\'account. Controlla la connessione e riprova.';
    }
    return null;
  } catch {
    return 'Non siamo riusciti a eliminare l\'account. Controlla la connessione e riprova.';
  }
}
