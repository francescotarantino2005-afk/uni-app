// Gli spazi per esame: le conversazioni della chat (tabella conversazioni, RLS:
// ognuno vede e gestisce solo le sue). La logica dei gruppi sta in
// lib/conversazioni.ts.
import { supabase } from '@/lib/supabase';
import type { Conversazione, EsameBarra } from '@/lib/conversazioni';

const CAMPI = 'id, exam_id, titolo, generale, aggiornata_il';

async function utente(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Le conversazioni dello studente. Se la "Generale" non c'è ancora la crea. */
export async function caricaConversazioni(): Promise<Conversazione[]> {
  const { data } = await supabase.from('conversazioni').select(CAMPI).order('aggiornata_il', { ascending: false });
  const elenco = (data as Conversazione[] | null) ?? [];
  if (elenco.some((c) => c.generale)) return elenco;
  const id = await utente();
  if (!id) return elenco;
  await supabase.from('conversazioni').insert({ user_id: id, titolo: 'Generale', generale: true });
  // (se un'altra richiesta l'ha creata nel frattempo, l'indice unico rifiuta questa: si rilegge)
  const { data: dopo } = await supabase.from('conversazioni').select(CAMPI).order('aggiornata_il', { ascending: false });
  return (dopo as Conversazione[] | null) ?? elenco;
}

/** Gli esami del libretto per i gruppi della barra. */
export async function caricaEsamiBarra(): Promise<EsameBarra[]> {
  const { data } = await supabase.from('exams').select('id, materia, voto, idoneita');
  return ((data ?? []) as { id: string; materia: string; voto: number | null; idoneita: boolean | null }[]).map((e) => ({
    id: e.id,
    materia: e.materia,
    superato: e.voto != null || e.idoneita === true,
  }));
}

/** Una nuova conversazione, dentro un esame o senza. */
export async function nuovaConversazione(examId: string | null): Promise<Conversazione | null> {
  const id = await utente();
  if (!id) return null;
  const { data } = await supabase
    .from('conversazioni')
    .insert({ user_id: id, exam_id: examId, titolo: 'Nuova chat' })
    .select(CAMPI)
    .single();
  return (data as Conversazione | null) ?? null;
}

export async function rinominaConversazione(id: string, titolo: string): Promise<boolean> {
  const { error } = await supabase.from('conversazioni').update({ titolo }).eq('id', id);
  return !error;
}

/** Elimina la conversazione e i suoi messaggi (la "Generale" non si elimina). */
export async function eliminaConversazione(id: string): Promise<boolean> {
  const { error, count } = await supabase.from('conversazioni').delete({ count: 'exact' }).eq('id', id).eq('generale', false);
  return !error && (count ?? 0) > 0;
}
