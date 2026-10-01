import type { ChiaveProfiloStudio, DomandaInCoda, ProfiloStudio } from '@/lib/tipi';

// Logica PURA del dialogo di accoglienza (niente rete, niente Supabase: è
// quella coperta dai test). Dialogo di accoglienza: cinque domande a intenzione fissa, una alla volta.
// L'ordine NON va cambiato: le prime tre bastano a costruire un piano, le
// altre due lo migliorano.

export const NUMERO_DOMANDE = 5;

export const CHIAVI_DIALOGO: ChiaveProfiloStudio[] = [
  'esame_target',
  'quando',
  'avanzamento',
  'tempo_al_giorno',
  'ostacolo',
];

/** Testi fissi, una frase ciascuno (gli stessi della function): fallback se la function non risponde, e testo in coda per le domande saltate. */
export const DOMANDE_FISSE = [
  'Qual è il primo esame che devi dare?',
  'Quando lo devi dare, anche a grandi linee?',
  'A che punto sei con la preparazione?',
  'Quanto tempo riesci a dedicare allo studio in una giornata normale?',
  'Cosa va storto di solito quando ti metti a studiare?',
];

export function apertura(nomeBot: string): string {
  return `Ciao, sono ${nomeBot}. Partiamo dal concreto: qual è il primo esame che devi dare?`;
}

export function chiusuraFissa(nomeEsame: string | null): string {
  return nomeEsame
    ? `Ora so da dove partire: ${nomeEsame}. Ci vediamo dentro.`
    : 'Ora so da dove partire. Ci vediamo dentro.';
}

export type MessaggioDialogo = { ruolo: 'user' | 'assistant'; contenuto: string };

export type RiassuntoLibretto = {
  media: number | null;
  cfu: number;
  da_sostenere: { id: string; materia: string }[];
};

// --- logica pura sul profilo ---

/** Completa la forma di profilo_studio (sul database parte da {}). */
export function profiloStudioCompleto(p: Partial<ProfiloStudio> | null | undefined): ProfiloStudio {
  return {
    esame_target: { nome: p?.esame_target?.nome ?? null, id: p?.esame_target?.id ?? null },
    quando: { testo: p?.quando?.testo ?? null, data: p?.quando?.data ?? null },
    avanzamento: p?.avanzamento ?? null,
    tempo_al_giorno: {
      testo: p?.tempo_al_giorno?.testo ?? null,
      minuti: p?.tempo_al_giorno?.minuti ?? null,
    },
    ostacolo: p?.ostacolo ?? null,
    note_libere: Array.isArray(p?.note_libere) ? p!.note_libere! : [],
  };
}

const NON_RISPOSTA = /^(boh+|bo|mah+|non (lo )?so|non saprei|niente|nulla|nessuno|vedremo|[?.\-\s]+)[\s.!?]*$/i;

/**
 * Valore da salvare quando la function non ha risposto: niente estrazione,
 * solo le parole dello studente dove il campo è testo. Mai un valore dedotto.
 */
export function valoreDiRipiego(numero: number, risposta: string): unknown {
  const testo = risposta.trim();
  if (!testo || NON_RISPOSTA.test(testo)) return null;
  switch (numero) {
    case 2:
      return { testo, data: null };
    case 4:
      return { testo, minuti: null };
    case 5:
      return testo.slice(0, 300);
    default:
      // esame target e avanzamento non si deducono dal testo grezzo: la risposta
      // resta in note_libere e la domanda finisce in coda.
      return null;
  }
}

/** Una chiave è senza risposta se è null o se tutti i suoi campi sono null. */
export function senzaRisposta(p: ProfiloStudio, chiave: ChiaveProfiloStudio): boolean {
  const v = p[chiave];
  if (v == null) return true;
  if (typeof v === 'object') return Object.values(v).every((x) => x == null);
  return false;
}

/**
 * Registra una risposta: la nota grezza SEMPRE, il valore strutturato solo se
 * c'è (un valore null non cancella quello raccolto prima di un chiarimento).
 */
export function registraRisposta(
  p: ProfiloStudio,
  numero: number,
  domanda: string,
  risposta: string,
  valore: unknown
): ProfiloStudio {
  const chiave = CHIAVI_DIALOGO[numero - 1];
  const nuovo: ProfiloStudio = {
    ...p,
    note_libere: [...p.note_libere, { domanda, risposta, il: new Date().toISOString() }],
  };
  if (valore != null) {
    (nuovo as Record<ChiaveProfiloStudio, unknown>)[chiave] = valore;
  }
  return profiloStudioCompleto(nuovo);
}

export const DOMANDA_PROSSIMO_ESAME = 'Qual è il prossimo esame che devi dare?';

/**
 * L'esame target è stato superato: il profilo non ha più un target (e quando e
 * avanzamento, che parlavano di quell'esame, non valgono più), e la domanda
 * "qual è il prossimo?" entra in coda come prima da fare.
 */
export function dopoTargetSuperato(
  p: ProfiloStudio,
  coda: DomandaInCoda[]
): { profilo_studio: ProfiloStudio; domande_in_coda: DomandaInCoda[] } {
  const id = 'accoglienza:esame_target';
  return {
    profilo_studio: {
      ...p,
      esame_target: { nome: null, id: null },
      quando: { testo: null, data: null },
      avanzamento: null,
    },
    domande_in_coda: [
      ...coda.filter((d) => d.id !== id),
      { id, testo: DOMANDA_PROSSIMO_ESAME, chiave: 'esame_target', stato: 'da_fare', priorita: 1 },
    ],
  };
}

/** Aggiorna la coda quando si lascia una domanda: senza risposta → "da_fare", altrimenti fuori dalla coda. */
export function aggiornaCoda(
  coda: DomandaInCoda[],
  p: ProfiloStudio,
  numero: number
): DomandaInCoda[] {
  const chiave = CHIAVI_DIALOGO[numero - 1];
  const id = `accoglienza:${chiave}`;
  const senzaQuesta = coda.filter((d) => d.id !== id);
  if (!senzaRisposta(p, chiave)) return senzaQuesta;
  return [
    ...senzaQuesta,
    { id, testo: DOMANDE_FISSE[numero - 1], chiave, stato: 'da_fare', priorita: numero },
  ];
}
