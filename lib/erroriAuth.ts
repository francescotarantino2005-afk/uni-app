import { AuthError } from '@supabase/supabase-js';

/** Traduce gli errori di Supabase Auth in messaggi comprensibili in italiano. */
export function messaggioErroreAuth(errore: unknown): string {
  const msg =
    errore instanceof AuthError || errore instanceof Error ? errore.message : String(errore);
  const nome = (errore as { name?: string } | null)?.name;

  // Rete o server non raggiungibile: va riconosciuto PER PRIMO. Altrimenti un
  // timeout o un 5xx cadono nel messaggio generico e sembrano credenziali
  // sbagliate — è la confusione che ci ha fatto sbagliare diagnosi. Copre
  // offline, fetch fallita, abort/timeout e i retry di GoTrue (AuthRetryableFetchError).
  if (
    nome === 'AuthRetryableFetchError' ||
    /network request failed|fetch failed|failed to fetch|load failed|aborted|timed out|timeout/i.test(msg)
  ) {
    return 'Non riusciamo a raggiungere il server: controlla la connessione e riprova.';
  }

  // Supabase non dice se è sbagliata l'email o la password (anti-enumeration):
  // messaggio unico, con l'invito a registrarsi se è la prima volta.
  if (/invalid login credentials/i.test(msg))
    return 'Email o password non corrette. Se è la prima volta, registrati qui sotto.';
  if (/user already registered/i.test(msg)) return 'Questa email è già registrata: prova ad accedere.';
  if (/email not confirmed/i.test(msg)) return 'Devi prima confermare la mail: controlla la casella di posta.';
  if (/password should be at least/i.test(msg)) return 'La password deve avere almeno 6 caratteri.';
  if (/unable to validate email|invalid format/i.test(msg)) return 'Questa email non sembra valida.';
  if (/rate limit|too many requests/i.test(msg)) return 'Troppi tentativi: aspetta un minuto e riprova.';

  return 'Qualcosa è andato storto. Riprova tra poco.';
}
