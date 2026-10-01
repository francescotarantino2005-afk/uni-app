// Le reazioni del personaggio: logica PURA (niente React, niente immagini), così
// è coperta dai test. Elenco CHIUSO dei momenti in cui compare:
//   - voto registrato >= 28            → esultanza
//   - 30 o 30 e lode                   → esultanza massima
//   - voto registrato <= 20            → vicinanza
//   - esame non superato               → vicinanza
//   - superato l'esame che era il target → esultanza, e chiede qual è il prossimo
//   - primo libretto importato         → una sola reazione di benvenuto
// La "vicinanza" NON è tristezza: il personaggio non piange e non si dispera
// quando lo studente va male, sta vicino. La disperazione comica è ammessa solo
// quando le cose vanno BENE.

export type NomePosa = 'esulta' | 'esultaMax' | 'vicino' | 'ascolta' | 'guarda' | 'pensa';

export type Reazione = {
  posa: NomePosa;
  battuta: string;
  /** al tocco porta in chat (dove il bot chiede qual è il prossimo esame) */
  versoChat?: boolean;
};

export const VOTO_ESULTANZA = 28;
export const VOTO_VICINANZA = 20;

/** Esame superato: cosa è stato registrato e com'era prima del salvataggio. */
export type EsitoEsame = {
  materia: string;
  /** voto appena registrato (null = idoneità) */
  voto: number | null;
  lode: boolean;
  /** true se prima del salvataggio l'esame era già superato (modifica, non evento) */
  giaSuperato: boolean;
  /** true se era l'esame target del profilo di studio */
  eraTarget: boolean;
};

/**
 * Reazione per un esame appena registrato come superato, o null se non c'è
 * niente da festeggiare né da accompagnare. Mai più di una per evento: se più
 * regole valgono insieme vince la prima di questa lista.
 */
export function reazionePerEsame(e: EsitoEsame): Reazione | null {
  if (e.giaSuperato) return null; // correzione di un esame già a libretto: non è un evento

  if (e.eraTarget) {
    return {
      posa: 'esulta',
      battuta: `${e.materia}: fatto! E adesso qual è il prossimo?`,
      versoChat: true,
    };
  }
  if (e.voto == null) return null; // idoneità non target: nessuna regola nell'elenco
  if (e.voto === 30) {
    return {
      posa: 'esultaMax',
      battuta: e.lode
        ? '30 e lode. Io non reggo, datemi un attimo.'
        : 'Trenta pieno. Devo sedermi un secondo.',
    };
  }
  if (e.voto >= VOTO_ESULTANZA) {
    return { posa: 'esulta', battuta: `${e.voto}! Questo si festeggia.` };
  }
  if (e.voto <= VOTO_VICINANZA) {
    return { posa: 'vicino', battuta: 'È andato, e questo conta. Il prossimo lo prepariamo insieme.' };
  }
  return null;
}

/** Esame non superato: vicinanza, mai disperazione. */
export function reazioneNonSuperato(): Reazione {
  return { posa: 'vicino', battuta: 'Capita. Sono qui: lo riprendiamo insieme, con calma.' };
}

/** Primo libretto importato: benvenuto. */
export function reazioneBenvenuto(): Reazione {
  return { posa: 'guarda', battuta: 'Eccolo, il tuo libretto. Da qui in poi lo teniamo aggiornato insieme.' };
}

// --- il freno ---

/** Pausa minima tra la fine di una reazione e l'inizio della successiva. */
export const PAUSA_TRA_REAZIONI_MS = 8000;

export type StatoFreno = {
  /** c'è una reazione sullo schermo adesso */
  visibile: boolean;
  /** quando si è chiusa l'ultima (ms), null se non ce n'è mai stata una */
  chiusaAlle: number | null;
};

/**
 * Mai due popup di fila: niente mentre uno è a schermo, niente subito dopo.
 * (Mai all'apertura dell'app: le reazioni nascono solo da un evento, lo stato
 * non si salva e all'avvio non c'è niente da mostrare.)
 */
export function puoMostrare(freno: StatoFreno, adesso: number): boolean {
  if (freno.visibile) return false;
  if (freno.chiusaAlle != null && adesso - freno.chiusaAlle < PAUSA_TRA_REAZIONI_MS) return false;
  return true;
}

/** L'esame salvato è il target del profilo di studio? Per id, o per nome se l'id manca. */
export function eEsameTarget(
  target: { nome: string | null; id: string | null } | null | undefined,
  esame: { id?: string | null; materia: string }
): boolean {
  if (!target) return false;
  if (target.id && esame.id) return target.id === esame.id;
  if (!target.nome) return false;
  const norma = (t: string) =>
    t
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return norma(target.nome) === norma(esame.materia);
}
