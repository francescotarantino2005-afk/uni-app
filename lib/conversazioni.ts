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
