import { AuthError } from '@supabase/supabase-js';

/**
 * Vero se l'errore è di rete/server non raggiungibile (offline, fetch fallita,
 * abort/timeout, retry di GoTrue). Va distinto dagli errori di credenziali:
 * un timeout non deve sembrare una password sbagliata.
 */
export function isErroreRete(errore: unknown): boolean {
  const msg = errore instanceof Error ? errore.message : String(errore);
  const nome = (errore as { name?: string } | null)?.name;
  return (
    nome === 'AuthRetryableFetchError' ||
    /network request failed|fetch failed|failed to fetch|load failed|aborted|timed out|timeout/i.test(msg)
  );
}

/** Traduce gli errori di Supabase Auth in messaggi comprensibili in italiano. */
export function messaggioErroreAuth(errore: unknown): string {
  const msg =
    errore instanceof AuthError || errore instanceof Error ? errore.message : String(errore);

  // Rete o server non raggiungibile: va riconosciuto PER PRIMO. Altrimenti un
  // timeout o un 5xx cadono nel messaggio generico e sembrano credenziali sbagliate.
  if (isErroreRete(errore)) {
    return 'Non riusciamo a raggiungere il server: controlla la connessione e riprova.';
  }

  // Supabase non dice se è sbagliata l'email o la password (anti-enumeration):
  // messaggio unico, con l'invito a registrarsi se è la prima volta.
  if (/invalid login credentials/i.test(msg))
    return 'Email o password non corrette. Se è la prima volta, registrati qui sotto.';
  if (/user already registered/i.test(msg)) return 'Questa email è già registrata: prova ad accedere.';
  if (/email not confirmed/i.test(msg)) return 'Devi prima confermare la mail: controlla la casella di posta.';
  if (/new password should be different|different from the old/i.test(msg))
    return 'La nuova password deve essere diversa dalla precedente.';
  if (/password should be at least/i.test(msg)) return 'La password deve avere almeno 6 caratteri.';
  if (/auth session missing|session_not_found|session from session_id/i.test(msg))
    return 'La sessione di recupero è scaduta: richiedi un nuovo link.';
  if (/unable to validate email|invalid format/i.test(msg)) return 'Questa email non sembra valida.';
  if (/rate limit|too many requests|email rate limit/i.test(msg))
    return 'Troppi tentativi: aspetta un minuto e riprova.';

  return 'Qualcosa è andato storto. Riprova tra poco.';
}
