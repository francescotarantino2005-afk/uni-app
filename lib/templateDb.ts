import { supabase } from '@/lib/supabase';

const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';
const ERRORE_GENERICO = 'Qualcosa è andato storto. Riprova tra poco.';

function traduci(messaggio: string): string {
  return /network request failed|fetch failed|failed to fetch/i.test(messaggio)
    ? ERRORE_RETE
    : ERRORE_GENERICO;
}

export type TemplateScadenza = {
  id: string;
  titolo: string;
  data: string | null;
  regione: string | null;
  ateneo: string | null;
  categoria: string | null;
  spiegazione: string | null;
};

/**
 * Template rilevanti per l'utente: nazionali (regione null) + quelli della sua
 * regione, e nazionali per ateneo (ateneo null) + quelli del suo ateneo.
 * Solo scadenze future o senza data. Ordinati per data.
 */
export async function caricaTemplateConsigliati(
  regione: string | null,
  ateneo: string | null
): Promise<{ dati: TemplateScadenza[]; errore: string | null }> {
  const { data, error } = await supabase
    .from('deadline_templates')
    .select('*')
    .order('data', { nullsFirst: false });
  if (error) return { dati: [], errore: traduci(error.message) };

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const filtrati = (data as TemplateScadenza[] ?? []).filter((t) => {
    const regioneOk = t.regione == null || t.regione === regione;
    const ateneoOk = t.ateneo == null || t.ateneo === ateneo;
    // niente scadenze già passate (quelle senza data restano)
    const futura =
      t.data == null ||
      (() => {
        const [a, m, g] = t.data.split('-').map(Number);
        return new Date(a, m - 1, g) >= oggi;
      })();
    return regioneOk && ateneoOk && futura;
  });

  return { dati: filtrati, errore: null };
}

/** Copia un template tra le scadenze personali dell'utente (fonte = 'template'). */
export async function aggiungiDaTemplate(
  userId: string,
  t: TemplateScadenza
): Promise<{ errore: string | null }> {
  if (!t.data) {
    return { errore: 'Questo promemoria non ha una data: aggiungilo a mano indicando quando scade.' };
  }
  const { error } = await supabase.from('deadlines').insert({
    user_id: userId,
    titolo: t.titolo,
    data: t.data,
    categoria: t.categoria,
    spiegazione: t.spiegazione,
    fonte: 'template',
  });
  return { errore: error ? traduci(error.message) : null };
}

/** Chiavi "titolo|data" delle scadenze già presenti, per non proporle di nuovo. */
export async function chiaviScadenzeEsistenti(): Promise<Set<string>> {
  const { data } = await supabase.from('deadlines').select('titolo, data');
  const set = new Set<string>();
  for (const r of (data as { titolo: string; data: string }[]) ?? []) {
    set.add(`${r.titolo}|${r.data}`);
  }
  return set;
}
