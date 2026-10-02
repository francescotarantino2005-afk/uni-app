// Logica PURA della coda delle domande (profiles.domande_in_coda): niente rete,
// niente Deno. La usa coda-domande/index.ts ed e' coperta dai test.
//
// Regole:
// - mai piu' di una domanda al giorno;
// - mai due domande di fila: finche' una domanda aspetta risposta non se ne
//   propone un'altra;
// - mai una domanda di contorno se c'e' un esame entro 48 ore;
// - quando lo studente risponde la domanda passa a "fatta";
// - se la ignora due volte passa a "saltata" e non torna piu';
// - finche' c'e' un impegno da mantenere (la promessa di fine accoglienza), o
//   nel giorno in cui la chat l'ha mantenuto, nessuna domanda: prima la promessa.

export type DomandaInCoda = {
  id: string;
  testo: string;
  chiave: string;
  stato: 'da_fare' | 'fatta' | 'saltata';
  priorita: number;
  /** ultimo giorno (AAAA-MM-GG, fuso italiano) in cui il bot l'ha proposta */
  proposta_il?: string | null;
  /** true da quando il bot l'ha proposta a quando lo studente scrive qualcosa */
  in_attesa?: boolean;
  /** quante volte lo studente ha scritto altro invece di rispondere */
  ignorata?: number;
};

export const MAX_IGNORATE = 2;

/** Legge la colonna jsonb in modo difensivo: tutto cio' che non e' una domanda valida si scarta. */
export function leggiCoda(valore: unknown): DomandaInCoda[] {
  if (!Array.isArray(valore)) return [];
  return valore.filter(
    (d): d is DomandaInCoda =>
      !!d &&
      typeof d === 'object' &&
      typeof (d as DomandaInCoda).id === 'string' &&
      typeof (d as DomandaInCoda).testo === 'string' &&
      typeof (d as DomandaInCoda).chiave === 'string' &&
      ['da_fare', 'fatta', 'saltata'].includes((d as DomandaInCoda).stato)
  );
}

/** La domanda che il bot ha proposto e a cui lo studente non ha ancora reagito. */
export function inAttesa(coda: DomandaInCoda[]): DomandaInCoda | null {
  return coda.find((d) => d.stato === 'da_fare' && d.in_attesa === true) ?? null;
}

/** true se una delle date (AAAA-MM-GG) cade tra oggi e dopodomani compresi. */
export function esameEntro48Ore(dateEsami: (string | null)[], oggi: string): boolean {
  const giorno = (iso: string) => {
    const [a, m, g] = iso.split('-').map(Number);
    return Date.UTC(a, m - 1, g) / 86_400_000;
  };
  const base = giorno(oggi);
  return dateEsami.some((d) => {
    if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return false;
    const distanza = giorno(d.slice(0, 10)) - base;
    return distanza >= 0 && distanza <= 2;
  });
}

/** La domanda da riproporre adesso, o null se le regole dicono di tacere. */
export function daProporre(
  coda: DomandaInCoda[],
  oggi: string,
  esameVicino: boolean
): DomandaInCoda | null {
  if (esameVicino) return null; // c'e' qualcosa di piu' urgente
  if (inAttesa(coda)) return null; // mai due di fila
  if (coda.some((d) => d.proposta_il === oggi)) return null; // una al giorno
  const candidate = coda
    .filter((d) => d.stato === 'da_fare')
    .sort((a, b) => a.priorita - b.priorita);
  return candidate[0] ?? null;
}

function cambia(
  coda: DomandaInCoda[],
  id: string,
  patch: (d: DomandaInCoda) => DomandaInCoda
): DomandaInCoda[] {
  return coda.map((d) => (d.id === id ? patch(d) : d));
}

export function segnaProposta(coda: DomandaInCoda[], id: string, oggi: string): DomandaInCoda[] {
  return cambia(coda, id, (d) => ({ ...d, proposta_il: oggi, in_attesa: true }));
}

export function segnaRisposta(coda: DomandaInCoda[], id: string): DomandaInCoda[] {
  return cambia(coda, id, (d) => ({ ...d, stato: 'fatta', in_attesa: false }));
}

export function segnaIgnorata(coda: DomandaInCoda[], id: string): DomandaInCoda[] {
  return cambia(coda, id, (d) => {
    const ignorata = (d.ignorata ?? 0) + 1;
    return {
      ...d,
      ignorata,
      in_attesa: false,
      stato: ignorata >= MAX_IGNORATE ? 'saltata' : d.stato,
    };
  });
}

/**
 * La battuta con cui il bot ripropone la domanda: testo fisso, nessuna chiamata
 * AI. Non dice "non te l'ho mai chiesto": una domanda in coda puo' essere gia'
 * stata fatta nel dialogo e saltata.
 */
export function testoProposta(d: DomandaInCoda): string {
  const domanda = d.testo.trim();
  return `Una cosa che mi manca ancora: ${domanda.charAt(0).toLowerCase()}${domanda.slice(1)}`;
}

/** Cio' che serve dell'impegno di fine accoglienza (profilo_studio.impegno). */
export type ImpegnoCoda = { stato: 'da_mantenere' | 'mantenuto'; mantenuto_il?: string | null } | null;

/**
 * L'impegno ferma la coda? Si' finche' e' da mantenere, e per tutto il giorno
 * (fuso italiano) in cui e' stato mantenuto: il primo messaggio della chat sono
 * gli esercizi promessi, non una domanda di contorno subito dopo.
 */
export function impegnoFermaCoda(impegno: ImpegnoCoda, oggi: string, giornoDi: (iso: string) => string): boolean {
  if (!impegno) return false;
  if (impegno.stato === 'da_mantenere') return true;
  return !!impegno.mantenuto_il && giornoDi(impegno.mantenuto_il) === oggi;
}

/**
 * Il messaggio che mantiene l'impegno va restituito all'app perche' lo mostri?
 * Solo se e' stato scritto DOPO l'apertura della chat (meno un margine): se
 * c'era gia', l'app lo ha letto con lo storico e mostrarlo di nuovo lo
 * raddoppierebbe.
 */
export const MARGINE_STORICO_MS = 1000;
export function daMostrare(creatoIl: string | null | undefined, aperturaMs: number): boolean {
  const t = creatoIl ? Date.parse(creatoIl) : NaN;
  return Number.isFinite(t) && t >= aperturaMs - MARGINE_STORICO_MS;
}
