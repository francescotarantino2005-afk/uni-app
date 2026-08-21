import { supabase } from '@/lib/supabase';
import { NotaStudente } from '@/lib/tipi';

// Note della memoria dello studente. Tutte le query passano dal client con il JWT
// dell'utente: la RLS su note_studente fa sì che si vedano/tocchino solo le proprie.

/** Carica le note NON archiviate, per importanza e poi data di aggiornamento. */
export async function caricaNote(): Promise<NotaStudente[]> {
  const { data } = await supabase
    .from('note_studente')
    .select('id, categoria, contenuto, importanza, archiviata, updated_at')
    .eq('archiviata', false)
    .order('importanza', { ascending: false })
    .order('updated_at', { ascending: false });
  return (data as NotaStudente[]) ?? [];
}

/** Cancella una singola nota (RLS: solo se è dell'utente). */
export async function cancellaNota(id: string): Promise<boolean> {
  const { error } = await supabase.from('note_studente').delete().eq('id', id);
  return !error;
}

/** Cancella tutte le note dell'utente. */
export async function cancellaTutteLeNote(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase.from('note_studente').delete().eq('user_id', data.user.id);
  return !error;
}
