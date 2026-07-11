import { AuthError } from '@supabase/supabase-js';

/** Traduce gli errori di Supabase Auth in messaggi comprensibili in italiano. */
export function messaggioErroreAuth(errore: unknown): string {
  const msg =
    errore instanceof AuthError || errore instanceof Error ? errore.message : String(errore);

  if (/invalid login credentials/i.test(msg)) return 'Email o password sbagliate.';
  if (/user already registered/i.test(msg)) return 'Questa email è già registrata: prova ad accedere.';
  if (/email not confirmed/i.test(msg)) return 'Devi prima confermare la mail: controlla la casella di posta.';
  if (/password should be at least/i.test(msg)) return 'La password deve avere almeno 6 caratteri.';
  if (/unable to validate email|invalid format/i.test(msg)) return 'Questa email non sembra valida.';
  if (/rate limit|too many requests/i.test(msg)) return 'Troppi tentativi: aspetta un minuto e riprova.';
  if (/network request failed|fetch failed|failed to fetch/i.test(msg))
    return 'Sembra che tu sia offline: controlla la connessione e riprova.';

  return 'Qualcosa è andato storto. Riprova tra poco.';
}
