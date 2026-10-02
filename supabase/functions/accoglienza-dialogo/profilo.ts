// Il profilo di studio e la coda: la parte PURA che serve sia al dialogo
// (accoglienza-dialogo) sia alla coda delle domande (coda-domande). Niente rete,
// niente Deno. Qui sta la regola che decide se una chiave ha gia' una risposta:
// basta il testo dello studente, i campi normalizzati sono facoltativi.

/** Le chiavi che il dialogo puo' chiedere, in ordine di priorita'. */
export const CHIAVI = ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo'] as const;
export type Chiave = (typeof CHIAVI)[number];

/** Testi fissi, una frase ciascuno: usati quando il modello non c'e' o non formula una domanda valida. */
export const DOMANDE_FISSE: Record<Chiave, string> = {
  esame_target: 'Qual è il primo esame che devi dare?',
  quando: 'Quando lo devi dare, anche a grandi linee?',
  avanzamento: 'A che punto sei con la preparazione?',
  tempo_al_giorno: 'Quanto tempo riesci a dedicare allo studio in una giornata normale?',
  ostacolo: 'Cosa va storto di solito quando ti metti a studiare?',
};

export type Livello = 'non_iniziato' | 'a_meta' | 'ripasso';

export type NotaLibera = {
  domanda: string;
  risposta: string;
  il: string;
  /** la chiave che il bot stava chiedendo (manca nelle note piu' vecchie) */
  chiave?: Chiave | null;
};

/** profiles.profilo_studio. In ogni chiave "testo" sono le parole dello studente. */
export type ProfiloStudio = {
  esame_target: { testo: string | null; nome: string | null; id: string | null };
  quando: { testo: string | null; data: string | null };
  avanzamento: { testo: string | null; livello: Livello | null };
  tempo_al_giorno: { testo: string | null; minuti: number | null };
  ostacolo: string | null;
  /** lavora, pendolare, fuorisede...: si estrae se ne parla, non si chiede mai */
  contesto: string | null;
  note_libere: NotaLibera[];
};

export type Messaggio = { ruolo: 'user' | 'assistant'; contenuto: string };
export type EsameElenco = { id: string | null; materia: string };

/** Voce di profiles.domande_in_coda (stessa forma di coda-domande/logica.ts). */
export type VoceCoda = {
  id: string;
  testo: string;
  chiave: string;
  stato: 'da_fare' | 'fatta' | 'saltata';
  priorita: number;
  proposta_il?: string | null;
  in_attesa?: boolean;
  ignorata?: number;
};

// ---------- testo ----------

function stringa(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function pulisci(testo: unknown, max: number): string {
  return typeof testo === 'string' ? testo.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ---------- profilo ----------

export function oggetto(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Completa la forma di profilo_studio. Sul database parte da {} e puo' avere la
 * forma vecchia (avanzamento come stringa, esame_target senza "testo"): si
 * converte senza perdere niente.
 */
export function profiloCompleto(valore: unknown): ProfiloStudio {
  const p = oggetto(valore);
  const esame = oggetto(p.esame_target);
  const quando = oggetto(p.quando);
  const tempo = oggetto(p.tempo_al_giorno);
  const avanz = typeof p.avanzamento === 'string' ? { livello: p.avanzamento } : oggetto(p.avanzamento);
  const livello = ['non_iniziato', 'a_meta', 'ripasso'].includes(avanz.livello as string)
    ? (avanz.livello as Livello)
    : null;
  const minuti = typeof tempo.minuti === 'number' ? tempo.minuti : null;
  const nome = stringa(esame.nome);
  return {
    esame_target: {
      testo: stringa(esame.testo) ?? nome,
      nome,
      id: stringa(esame.id),
    },
    quando: { testo: stringa(quando.testo), data: stringa(quando.data) },
    avanzamento: { testo: stringa(avanz.testo), livello },
    tempo_al_giorno: { testo: stringa(tempo.testo), minuti },
    ostacolo: stringa(p.ostacolo),
    contesto: stringa(p.contesto),
    note_libere: Array.isArray(p.note_libere) ? (p.note_libere as NotaLibera[]) : [],
  };
}

/** Lo studente ha risposto a questa chiave? Basta il testo: i campi normalizzati sono facoltativi. */
export function haRisposta(p: ProfiloStudio, chiave: Chiave): boolean {
  switch (chiave) {
    case 'esame_target':
      return !!(p.esame_target.testo || p.esame_target.nome);
    case 'quando':
      return !!(p.quando.testo || p.quando.data);
    case 'avanzamento':
      return !!(p.avanzamento.testo || p.avanzamento.livello);
    case 'tempo_al_giorno':
      return !!(p.tempo_al_giorno.testo || p.tempo_al_giorno.minuti != null);
    case 'ostacolo':
      return !!p.ostacolo;
  }
}

/** Le chiavi ancora vuote, in ordine di priorita'. */
export function mancanti(p: ProfiloStudio): Chiave[] {
  return CHIAVI.filter((k) => !haRisposta(p, k));
}

// ---------- la coda ----------

const idCoda = (chiave: string) => `accoglienza:${chiave}`;

/**
 * Allinea la coda al profilo. Una chiave che ha gia' una risposta non si chiede:
 * se era in coda passa a "fatta". Con `aggiungi` (a dialogo finito) le chiavi
 * ancora vuote entrano in coda come "da_fare".
 */
export function allineaCoda<T extends VoceCoda>(coda: T[], profilo: ProfiloStudio, aggiungi: boolean): VoceCoda[] {
  const risposte = new Set<string>(CHIAVI.filter((k) => haRisposta(profilo, k)));
  const allineata: VoceCoda[] = coda.map((d) =>
    d.stato === 'da_fare' && risposte.has(d.chiave) ? { ...d, stato: 'fatta', in_attesa: false } : d
  );
  if (!aggiungi) return allineata;
  for (const chiave of mancanti(profilo)) {
    if (allineata.some((d) => d.chiave === chiave && d.stato !== 'fatta')) continue;
    allineata.push({
      id: idCoda(chiave),
      testo: DOMANDE_FISSE[chiave],
      chiave,
      stato: 'da_fare',
      priorita: CHIAVI.indexOf(chiave) + 1,
    });
  }
  // una voce "fatta" con lo stesso id di una nuova "da_fare" non serve piu'
  return allineata.filter(
    (d, i) => !(d.stato === 'fatta' && allineata.some((x, j) => j !== i && x.id === d.id && x.stato === 'da_fare'))
  );
}
