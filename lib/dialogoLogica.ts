// Il dialogo di accoglienza lato app. Le regole stanno in UN posto solo, il file
// puro condiviso con la Edge Function: qui lo si riesporta e si aggiungono le
// poche cose che servono solo allo schermo.
import {
  DOMANDE_FISSE,
  type ProfiloStudio,
  type VoceCoda,
} from '../supabase/functions/accoglienza-dialogo/logica';

export * from '../supabase/functions/accoglienza-dialogo/logica';

/** La prima battuta, sempre questa: chiede l'esame. */
export function apertura(nomeBot: string): string {
  return `Ciao, sono ${nomeBot}. Partiamo dal concreto: qual è il primo esame che devi dare?`;
}

export type RiassuntoLibretto = {
  media: number | null;
  cfu: number;
  da_sostenere: { id: string; materia: string }[];
};

export const DOMANDA_PROSSIMO_ESAME = 'Qual è il prossimo esame che devi dare?';

/**
 * L'esame target è stato superato: il profilo non ha più un target (e quando e
 * avanzamento, che parlavano di quell'esame, non valgono più), e la domanda
 * "qual è il prossimo?" entra in coda come prima da fare.
 */
export function dopoTargetSuperato<T extends VoceCoda>(
  p: ProfiloStudio,
  coda: T[]
): { profilo_studio: ProfiloStudio; domande_in_coda: VoceCoda[] } {
  const id = 'accoglienza:esame_target';
  return {
    profilo_studio: {
      ...p,
      esame_target: { testo: null, nome: null, id: null },
      quando: { testo: null, data: null },
      avanzamento: { testo: null, livello: null },
    },
    domande_in_coda: [
      ...coda.filter((d) => d.id !== id),
      { id, testo: DOMANDA_PROSSIMO_ESAME, chiave: 'esame_target', stato: 'da_fare', priorita: 1 },
    ],
  };
}

// Solo per riferimento nei testi dell'app.
export { DOMANDE_FISSE as DOMANDE_DEL_DIALOGO };
