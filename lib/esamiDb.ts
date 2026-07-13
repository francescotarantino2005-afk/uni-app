import { supabase } from '@/lib/supabase';
import { Esame } from '@/lib/tipi';

const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';
const ERRORE_GENERICO = 'Qualcosa è andato storto. Riprova tra poco.';

function traduci(messaggio: string): string {
  return /network request failed|fetch failed|failed to fetch/i.test(messaggio)
    ? ERRORE_RETE
    : ERRORE_GENERICO;
}

export type DatiEsame = {
  materia: string;
  cfu: number | null;
  data_esame: string | null;
  voto: number | null;
  lode: boolean;
};

/** Tutti gli esami dell'utente. Sostenuti prima (per data), poi da sostenere. */
export async function caricaEsami(): Promise<{ dati: Esame[]; errore: string | null }> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('data_esame', { ascending: false, nullsFirst: false });
  if (error) return { dati: [], errore: traduci(error.message) };
  return { dati: (data as Esame[]) ?? [], errore: null };
}

export async function salvaEsame(
  userId: string,
  dati: DatiEsame,
  id?: string
): Promise<{ errore: string | null }> {
  const riga = { ...dati, user_id: userId };
  const { error } = id
    ? await supabase.from('exams').update(riga).eq('id', id)
    : await supabase.from('exams').insert(riga);
  return { errore: error ? traduci(error.message) : null };
}

export async function eliminaEsame(id: string): Promise<{ errore: string | null }> {
  const { error } = await supabase.from('exams').delete().eq('id', id);
  return { errore: error ? traduci(error.message) : null };
}
