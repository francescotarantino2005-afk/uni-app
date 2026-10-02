// L'attesa dell'impegno in chat: la parte PURA (niente rete, niente React),
// coperta dai test. Quando il dialogo di accoglienza chiude con una promessa
// ("ti preparo degli esercizi…") il server scrive il messaggio che la mantiene
// qualche secondo dopo: nel frattempo la chat mostra il personaggio che pensa e
// controlla ogni due secondi. Dopo trenta secondi l'attesa lascia il posto a un
// bottone "Inizia": la promessa non resta mai appesa.
import { type Impegno, leggiImpegno } from '../supabase/functions/accoglienza-dialogo/profilo.ts';

/** Ogni quanto si controlla se il messaggio è arrivato, SOLO mentre l'impegno è in sospeso. */
export const PASSO_CONTROLLO_MS = 2000;
/** Dopo quanto l'attesa lascia il posto al bottone "Inizia". */
export const ATTESA_MASSIMA_MS = 30_000;

export type FaseAttesa = 'niente' | 'attesa' | 'bottone';

/** L'impegno ancora da mantenere, o null. */
export function impegnoInSospeso(profiloStudio: unknown): Impegno | null {
  const i = leggiImpegno(profiloStudio);
  return i && i.stato === 'da_mantenere' ? i : null;
}

/** Cosa mostra la chat: niente, l'attesa col personaggio, o il bottone "Inizia". */
export function faseAttesa(inSospeso: boolean, inizioMs: number | null, adessoMs: number): FaseAttesa {
  if (!inSospeso || inizioMs == null) return 'niente';
  return adessoMs - inizioMs >= ATTESA_MASSIMA_MS ? 'bottone' : 'attesa';
}

/** La scritta sotto il personaggio, adatta a ciò che è stato promesso. */
export function testoAttesa(nomeBot: string, testoImpegno: string): string {
  const nome = nomeBot.trim() || 'Lode';
  const t = testoImpegno.toLowerCase();
  const cosa = /eserciz/.test(t)
    ? 'i tuoi esercizi'
    : /schema|riassunt|mappa/.test(t)
      ? 'il tuo schema'
      : /piano|programma|organizz/.test(t)
        ? 'il tuo piano'
        : /spieg/.test(t)
          ? 'la spiegazione'
          : 'quello che ti ha promesso';
  return `${nome} sta preparando ${cosa}…`;
}

type Bolla = { id: string; ruolo: string; contenuto: string };

/**
 * Aggiunge alla lista il messaggio che mantiene l'impegno, una volta sola: se
 * c'è già (stesso id, o stesso testo del bot arrivato da un'altra strada) la
 * lista resta com'è.
 */
export function conMessaggio<T extends Bolla>(messaggi: T[], nuovo: T): T[] {
  const giaCe = messaggi.some(
    (m) => m.id === nuovo.id || (m.ruolo === 'assistant' && m.contenuto === nuovo.contenuto)
  );
  return giaCe ? messaggi : [...messaggi, nuovo];
}
