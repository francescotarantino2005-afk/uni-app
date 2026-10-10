// Gli spazi per esame nella barra laterale della chat. Logica PURA (testata):
// dalle conversazioni e dagli esami del libretto ai gruppi da mostrare.
// In cima la "Generale"; poi un gruppo per ogni esame ancora da sostenere (anche
// senza conversazioni, così si può aprire la prima) e per ogni esame che ha
// conversazioni; in fondo "Altre chat" (conversazioni senza esame).

export type Conversazione = {
  id: string;
  exam_id: string | null;
  titolo: string;
  generale: boolean;
  aggiornata_il: string;
};

export type EsameBarra = { id: string; materia: string; superato: boolean };

export type Gruppo = {
  /** id dell'esame, null per "Altre chat" */
  examId: string | null;
  titolo: string;
  conversazioni: Conversazione[];
};

export const TITOLO_ALTRE = 'Altre chat';

const piuRecenti = (a: Conversazione, b: Conversazione) => b.aggiornata_il.localeCompare(a.aggiornata_il);

export function gruppiBarra(
  conversazioni: Conversazione[],
  esami: EsameBarra[]
): { generale: Conversazione | null; gruppi: Gruppo[] } {
  const generale = conversazioni.find((c) => c.generale) ?? null;
  const altre = conversazioni.filter((c) => !c.generale);
  const perEsame = new Map<string, Conversazione[]>();
  const senzaEsame: Conversazione[] = [];
  const idEsami = new Set(esami.map((e) => e.id));
  for (const c of altre) {
    if (c.exam_id && idEsami.has(c.exam_id)) perEsame.set(c.exam_id, [...(perEsame.get(c.exam_id) ?? []), c]);
    else senzaEsame.push(c);
  }
  const gruppi: Gruppo[] = esami
    .filter((e) => !e.superato || perEsame.has(e.id))
    .sort((a, b) => Number(a.superato) - Number(b.superato) || a.materia.localeCompare(b.materia, 'it'))
    .map((e) => ({ examId: e.id, titolo: e.materia, conversazioni: (perEsame.get(e.id) ?? []).sort(piuRecenti) }));
  if (senzaEsame.length) gruppi.push({ examId: null, titolo: TITOLO_ALTRE, conversazioni: senzaEsame.sort(piuRecenti) });
  return { generale, gruppi };
}

/** Un titolo valido per la rinomina: spazi ripuliti, 1-80 caratteri; null se vuoto. */
export function titoloValido(testo: string): string | null {
  const t = testo.replace(/\s+/g, ' ').trim().slice(0, 80);
  return t ? t : null;
}

// --- Chat nuove: non si salvano finché lo studente non scrive ---

/** Il titolo di default di una chat nuova (lo stesso della function chat). */
export const TITOLO_NUOVA = 'Nuova chat';
const MAX_TITOLO = 30;

/**
 * Una chat nuova ancora da salvare: esiste solo sullo schermo (id vuoto). Al
 * primo messaggio diventa una riga di `conversazioni`.
 */
export function bozza(examId: string | null): Conversazione {
  return { id: '', exam_id: examId, titolo: TITOLO_NUOVA, generale: false, aggiornata_il: '' };
}

export const eBozza = (c: Conversazione | null | undefined): boolean => !!c && !c.id;

/**
 * Il titolo dal primo messaggio: la prima riga, spazi ripuliti, al massimo 30
 * caratteri; se è più lunga si taglia a parola intera e si chiude con "…".
 */
export function titoloDaMessaggio(messaggio: string): string {
  const riga = (messaggio.split('\n').find((r) => r.trim()) ?? '').replace(/\s+/g, ' ').trim();
  if (!riga) return TITOLO_NUOVA;
  if (riga.length <= MAX_TITOLO) return riga;
  let taglio = riga.slice(0, MAX_TITOLO - 1);
  const spazio = taglio.lastIndexOf(' ');
  if (spazio >= 12) taglio = taglio.slice(0, spazio);
  return `${taglio.replace(/[\s,.;:!?-]+$/, '')}…`;
}

/** Dopo quanto una chat vuota (senza messaggi) si può eliminare. */
export const VUOTA_DA_ELIMINARE_MS = 10 * 60 * 1000;

/**
 * Chat vuote: nella barra non si mostrano mai; si eliminano solo quelle create
 * da più di dieci minuti (una appena creata può avere il primo messaggio in
 * viaggio). La "Generale" resta sempre.
 */
export function separaVuote(
  elenco: (Conversazione & { messaggi: number; creata_il: string })[],
  adesso: number
): { visibili: Conversazione[]; daEliminare: string[] } {
  const visibili: Conversazione[] = [];
  const daEliminare: string[] = [];
  for (const { messaggi, creata_il, ...c } of elenco) {
    if (c.generale || messaggi > 0) {
      visibili.push(c);
      continue;
    }
    const creata = Date.parse(creata_il);
    if (Number.isFinite(creata) && adesso - creata > VUOTA_DA_ELIMINARE_MS) daEliminare.push(c.id);
  }
  return { visibili, daEliminare };
}

/** Il sottotitolo dell'intestazione: "Generale", l'esame, il titolo della chat. */
export function sottotitoloChat(c: Conversazione | null, materia: string | null): string {
  if (!c || c.generale) return 'Generale';
  if (eBozza(c)) return materia ?? TITOLO_NUOVA;
  return materia ? `${materia} · ${c.titolo}` : c.titolo;
}
