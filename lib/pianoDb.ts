import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Piano, PianoStudio } from '@/lib/tipi';

const MESSAGGI_ERRORE: Record<string, string> = {
  LIMITE_RAGGIUNTO: 'Hai già creato 5 piani questo mese: riprova più avanti, o modifica un piano che hai già.',
  TIMEOUT: 'La generazione sta tardando: riprova tra qualche secondo.',
  SERVIZIO_NON_DISPONIBILE: 'Il servizio è occupato in questo momento: riprova tra poco.',
  DATA_PASSATA: 'La data dell\'esame dev\'essere nel futuro.',
  ORE_NON_VALIDE: 'Indica quante ore al giorno puoi studiare (da 1 a 14).',
  ESAME_NON_TROVATO: 'Esame non trovato: aggiungilo prima dalla tab Libretto.',
  GENERAZIONE_FALLITA: 'Non sono riuscito a creare il piano. Prova a descrivere meglio il materiale.',
};
const ERRORE_GENERICO = 'Qualcosa è andato storto. Riprova tra poco.';
const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';

export type EsitoPiano =
  | { tipo: 'ok'; piano: Piano }
  | { tipo: 'errore'; messaggio: string };

/** Chiede al server di generare il piano di studio per un esame. */
export async function generaPiano(input: {
  esame_id: string;
  data_esame: string;
  materiale: string;
  ore_al_giorno: number;
}): Promise<EsitoPiano> {
  try {
    const { data, error } = await supabase.functions.invoke('genera-piano', { body: input });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const corpo = await error.context.json().catch(() => null);
        const codice = corpo?.errore as string | undefined;
        return { tipo: 'errore', messaggio: (codice && MESSAGGI_ERRORE[codice]) || ERRORE_GENERICO };
      }
      return { tipo: 'errore', messaggio: ERRORE_RETE };
    }
    const piano = data?.piano as Piano | undefined;
    if (!piano) return { tipo: 'errore', messaggio: ERRORE_GENERICO };
    return { tipo: 'ok', piano };
  } catch {
    return { tipo: 'errore', messaggio: ERRORE_RETE };
  }
}

/** Il piano di studio più recente dell'utente (o null). */
export async function caricaPianoAttivo(): Promise<PianoStudio | null> {
  const { data } = await supabase
    .from('study_plans')
    .select('id, exam_id, piano')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PianoStudio) ?? null;
}

/** Riscrive il piano (usato dopo il ricalcolo deterministico lato app). */
export async function salvaPiano(id: string, piano: Piano): Promise<{ errore: string | null }> {
  const { error } = await supabase.from('study_plans').update({ piano }).eq('id', id);
  if (error) {
    return {
      errore: /network request failed|fetch failed/i.test(error.message) ? ERRORE_RETE : ERRORE_GENERICO,
    };
  }
  return { errore: null };
}
