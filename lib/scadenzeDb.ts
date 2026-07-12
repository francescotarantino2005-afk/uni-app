import { supabase } from '@/lib/supabase';
import { Scadenza } from '@/lib/tipi';
import { dataOggiIso } from '@/lib/date';

const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';
const ERRORE_GENERICO = 'Qualcosa è andato storto. Riprova tra poco.';

function traduci(messaggio: string): string {
  return /network request failed|fetch failed|failed to fetch/i.test(messaggio)
    ? ERRORE_RETE
    : ERRORE_GENERICO;
}

/** Tutte le scadenze dell'utente ordinate per data. */
export async function caricaScadenze(): Promise<{ dati: Scadenza[]; errore: string | null }> {
  const { data, error } = await supabase.from('deadlines').select('*').order('data');
  if (error) return { dati: [], errore: traduci(error.message) };
  return { dati: (data as Scadenza[]) ?? [], errore: null };
}

/** Le prossime scadenze non completate da oggi in poi (per la home). */
export async function caricaProssimeScadenze(
  limite: number
): Promise<{ dati: Scadenza[]; errore: string | null }> {
  const { data, error } = await supabase
    .from('deadlines')
    .select('*')
    .eq('completata', false)
    .gte('data', dataOggiIso())
    .order('data')
    .limit(limite);
  if (error) return { dati: [], errore: traduci(error.message) };
  return { dati: (data as Scadenza[]) ?? [], errore: null };
}

export async function aggiungiScadenza(
  userId: string,
  dati: { titolo: string; data: string; categoria: string }
): Promise<{ errore: string | null }> {
  const { error } = await supabase
    .from('deadlines')
    .insert({ ...dati, user_id: userId, fonte: 'utente' });
  return { errore: error ? traduci(error.message) : null };
}

export async function impostaCompletata(
  id: string,
  completata: boolean
): Promise<{ errore: string | null }> {
  const { error } = await supabase.from('deadlines').update({ completata }).eq('id', id);
  return { errore: error ? traduci(error.message) : null };
}
