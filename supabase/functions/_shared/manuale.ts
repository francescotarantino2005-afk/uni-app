// Il manuale del professore (manuale-del-professore.md) nelle Edge Functions:
// il testo intero per la chat, le sole sezioni utili per il dialogo di accoglienza.
// Il testo sta in manuale-testo.ts, generato dal .md (scripts/genera-manuale.mjs).
import { MANUALE } from './manuale-testo.ts';

export const NOME_BOT_DEFAULT = 'Lode';

/** Il manuale col nome del bot al posto di {nome_bot} (profiles.nome_bot). */
export function manualeCompleto(nomeBot?: string | null): string {
  const nome = (nomeBot ?? '').trim() || NOME_BOT_DEFAULT;
  return MANUALE.split('{nome_bot}').join(nome).trimEnd();
}

/** Le sole sezioni indicate ("## 1. ...", "## 7. ..."), nell'ordine del manuale, col nome del bot. */
export function sezioniManuale(numeri: number[], nomeBot?: string | null): string {
  const pezzi = manualeCompleto(nomeBot).split(/^---$/m).join('').split(/^(?=## \d+\. )/m);
  return pezzi
    .filter((p) => {
      const n = p.match(/^## (\d+)\. /);
      return n && numeri.includes(Number(n[1]));
    })
    .map((p) => p.trim())
    .join('\n\n');
}
