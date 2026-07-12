import { supabase } from '@/lib/supabase';
import { EventoOrario } from '@/lib/tipi';

const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';
const ERRORE_GENERICO = 'Qualcosa è andato storto. Riprova tra poco.';

function traduci(messaggio: string): string {
  return /network request failed|fetch failed|failed to fetch/i.test(messaggio)
    ? ERRORE_RETE
    : ERRORE_GENERICO;
}

export type DatiLezione = {
  titolo: string;
  giorno: number;
  ora_inizio: string; // "HH:MM"
  ora_fine: string | null;
  aula: string | null;
  colore: string | null;
};

/** Tutte le lezioni dell'utente, ordinate per giorno e ora. */
export async function caricaLezioni(): Promise<{ dati: EventoOrario[]; errore: string | null }> {
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .order('giorno')
    .order('ora_inizio');
  if (error) return { dati: [], errore: traduci(error.message) };
  return { dati: (data as EventoOrario[]) ?? [], errore: null };
}

export async function salvaLezione(
  userId: string,
  dati: DatiLezione,
  id?: string
): Promise<{ errore: string | null }> {
  const riga = { ...dati, user_id: userId };
  const { error } = id
    ? await supabase.from('schedule_events').update(riga).eq('id', id)
    : await supabase.from('schedule_events').insert(riga);
  return { errore: error ? traduci(error.message) : null };
}

export async function eliminaLezione(id: string): Promise<{ errore: string | null }> {
  const { error } = await supabase.from('schedule_events').delete().eq('id', id);
  return { errore: error ? traduci(error.message) : null };
}
