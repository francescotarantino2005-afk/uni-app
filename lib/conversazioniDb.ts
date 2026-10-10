// Gli spazi per esame: le conversazioni della chat (tabella conversazioni, RLS:
// ognuno vede e gestisce solo le sue). La logica dei gruppi sta in
// lib/conversazioni.ts.
import { supabase } from '@/lib/supabase';
import { separaVuote, type Conversazione, type EsameBarra } from '@/lib/conversazioni';

const CAMPI = 'id, exam_id, titolo, generale, aggiornata_il';
// Per la barra: in più quando è nata e quanti messaggi ha (le vuote non si mostrano).
const CAMPI_BARRA = `${CAMPI}, creata_il, chat_messages(count)`;

type RigaBarra = Conversazione & { creata_il: string; chat_messages: { count: number }[] | null };

async function utente(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function leggiBarra(): Promise<Conversazione[] | null> {
  const { data, error } = await supabase.from('conversazioni').select(CAMPI_BARRA).order('aggiornata_il', { ascending: false });
  if (error || !data) {
    // Ripiego: senza il conteggio si mostrano tutte, come prima.
    const { data: semplici, error: e2 } = await supabase.from('conversazioni').select(CAMPI).order('aggiornata_il', { ascending: false });
    return e2 || !semplici ? null : (semplici as Conversazione[]);
  }
  const { visibili, daEliminare } = separaVuote(
    (data as unknown as RigaBarra[]).map(({ chat_messages, ...c }) => ({ ...c, messaggi: chat_messages?.[0]?.count ?? 0 })),
    Date.now()
  );
  // Le chat vuote rimaste da prima (fino alla build 21 si salvavano subito): via.
  if (daEliminare.length) {
    supabase.from('conversazioni').delete().in('id', daEliminare).eq('generale', false).then(() => undefined);
  }
  return visibili;
}

/** Le conversazioni dello studente (senza quelle vuote). Se la "Generale" non c'è ancora la crea. */
export async function caricaConversazioni(): Promise<Conversazione[]> {
  const letto = await leggiBarra();
  if (!letto) return []; // rete giù: niente da creare alla cieca
  const elenco = letto;
  if (elenco.some((c) => c.generale)) return elenco;
  const id = await utente();
  if (!id) return elenco;
  await supabase.from('conversazioni').insert({ user_id: id, titolo: 'Generale', generale: true });
  // (se un'altra richiesta l'ha creata nel frattempo, l'indice unico rifiuta questa: si rilegge)
  return (await leggiBarra()) ?? elenco;
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

/**
 * Salva una conversazione nuova, dentro un esame o senza. Si chiama SOLO al
 * primo messaggio, con il titolo già ricavato dal messaggio (lib/conversazioni.ts).
 */
export async function nuovaConversazione(examId: string | null, titolo: string): Promise<Conversazione | null> {
  const id = await utente();
  if (!id) return null;
  const { data } = await supabase
    .from('conversazioni')
    .insert({ user_id: id, exam_id: examId, titolo })
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
