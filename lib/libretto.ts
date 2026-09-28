import { Esame } from '@/lib/tipi';

// Calcoli del libretto secondo le convenzioni universitarie italiane.
// - voti da 18 a 30, più "30 e lode"
// - media PONDERATA sui CFU: somma(voto*cfu) / somma(cfu)
// - la lode conta 30 nella media (ma la contiamo a parte)
// - esame "da sostenere" (voto null) non entra nella media
// - idoneità (superato senza voto): i CFU contano, la media no

export const VOTO_MIN = 18;
export const VOTO_MAX = 30;

/** Un esame è "sostenuto" se ha un voto o è un'idoneità. */
export function sostenuto(e: Pick<Esame, 'voto' | 'idoneita'>): boolean {
  return e.voto != null || e.idoneita;
}

/** Entra nella media solo se ha voto e CFU validi (le idoneità non hanno voto). */
function validoPerMedia(e: Pick<Esame, 'voto' | 'cfu'>): boolean {
  return e.voto != null && e.cfu != null && e.cfu > 0;
}

export type StatoLibretto = {
  media: number | null;
  cfuAcquisiti: number;
  numeroLodi: number;
  numeroSostenuti: number;
  /** voto di laurea di partenza = media/30*110 (solo indicativo) */
  proiezioneLaurea: number | null;
};

/** Campi che servono ai calcoli: anche le righe non ancora salvate li hanno. */
type EsameCalcolo = Pick<Esame, 'voto' | 'lode' | 'cfu' | 'idoneita'>;

export function calcolaLibretto(esami: EsameCalcolo[]): StatoLibretto {
  let sommaPesata = 0;
  let sommaCfu = 0;
  let cfuAcquisiti = 0;
  let numeroLodi = 0;
  let numeroSostenuti = 0;

  for (const e of esami) {
    if (!sostenuto(e)) continue;
    numeroSostenuti++;
    if (e.cfu && e.cfu > 0) cfuAcquisiti += e.cfu;
    if (e.lode && e.voto === VOTO_MAX) numeroLodi++;
    if (validoPerMedia(e)) {
      sommaPesata += e.voto! * e.cfu!;
      sommaCfu += e.cfu!;
    }
  }

  const media = sommaCfu > 0 ? sommaPesata / sommaCfu : null;
  const proiezioneLaurea = media != null ? (media / 30) * 110 : null;

  return { media, cfuAcquisiti, numeroLodi, numeroSostenuti, proiezioneLaurea };
}

/** Somma pesata e CFU degli esami che entrano nella media (per il simulatore). */
function baseMedia(esami: Esame[]): { sommaPesata: number; sommaCfu: number } {
  let sommaPesata = 0;
  let sommaCfu = 0;
  for (const e of esami) {
    if (validoPerMedia(e)) {
      sommaPesata += e.voto! * e.cfu!;
      sommaCfu += e.cfu!;
    }
  }
  return { sommaPesata, sommaCfu };
}

/** Simulatore A: che media avrò prendendo `voto` a un esame da `cfu` CFU? */
export function mediaConEsame(esami: Esame[], voto: number, cfu: number): number | null {
  const { sommaPesata, sommaCfu } = baseMedia(esami);
  const sp = sommaPesata + voto * cfu;
  const sc = sommaCfu + cfu;
  return sc > 0 ? sp / sc : null;
}

export type EsitoVotoNecessario =
  | { tipo: 'ok'; voto: number } // serve almeno questo voto (18-30)
  | { tipo: 'gia_raggiunta' } // anche il 18 basta
  | { tipo: 'impossibile' }; // servirebbe più di 30: non con un solo esame

/** Simulatore B: che voto serve al prossimo esame (da `cfu` CFU) per arrivare a media `target`? */
export function votoNecessarioPerMedia(
  esami: Esame[],
  target: number,
  cfu: number
): EsitoVotoNecessario {
  const { sommaPesata, sommaCfu } = baseMedia(esami);
  const necessario = (target * (sommaCfu + cfu) - sommaPesata) / cfu;

  if (necessario <= VOTO_MIN) return { tipo: 'gia_raggiunta' };
  if (necessario > VOTO_MAX) return { tipo: 'impossibile' };
  return { tipo: 'ok', voto: Math.ceil(necessario) };
}

/** "30 e lode" | "27" | "idoneo" | "da sostenere" */
export function formattaVoto(e: Esame): string {
  if (e.voto == null) return e.idoneita ? 'idoneo' : 'da sostenere';
  if (e.lode && e.voto === VOTO_MAX) return '30 e lode';
  return String(e.voto);
}

/** Media con la virgola all'italiana, es. "27,45". */
export function formattaMedia(media: number | null): string {
  if (media == null) return '—';
  return media.toFixed(2).replace('.', ',');
}
