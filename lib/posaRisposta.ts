// La posa del robot accanto a una risposta di Lode. Logica PURA (testata).
// Elenco chiuso, come per le reazioni (lib/reazioni.ts):
//   - mentre aspetta la risposta          → pensa (lo decide lo schermo)
//   - voto alto (28-30) nel giudizio, o lo studente racconta un voto alto → esulta
//   - momento difficile: malessere serio, voto basso (≤ 20), bocciatura   → vicino
//   - tutto il resto                      → guarda
// "Vicino" non è tristezza: il robot sta accanto, non si dispera.
import { malessereSerio } from '../supabase/functions/_shared/aiuto.ts';
import type { NomePosa } from './reazioni.ts';

export type PosaRisposta = Extract<NomePosa, 'guarda' | 'esulta' | 'vicino'>;

/** Il voto in trentesimi del giudizio finale ("Voto: 24/30"), se c'è. */
export function votoGiudizio(risposta: string): number | null {
  const m = risposta.match(/\bvoto\b\W{0,6}(1[0-9]|2\d|30)\s*(?:\/|su)\s*30\b/i);
  return m ? Number(m[1]) : null;
}

const VOTO_ALTO_STUDENTE = /\bho preso (?:un |il )?(2[89]|30)\b|\b30 e lode\b|\btrenta e lode\b/i;
const VOTO_BASSO_STUDENTE = /\bho preso (?:un |il )?(1[0-9]|20)\b/i;
const MOMENTO_DIFFICILE = /\bbocciat[oa]\b|\bmi hanno bocciat|\bnon (?:l'ho |ho )?passat[oa]\b|\b(?:è|e') andat[oa] (?:male|malissimo|da schifo)\b|\bho fallito\b|\bmi sento un fallito\b|\brespint[oa]\b/i;

export function posaPerRisposta(risposta: string, messaggioStudente: string | null): PosaRisposta {
  const studente = messaggioStudente ?? '';
  if (malessereSerio(studente)) return 'vicino';
  const voto = votoGiudizio(risposta);
  if (voto != null) return voto >= 28 ? 'esulta' : voto <= 20 ? 'vicino' : 'guarda';
  if (MOMENTO_DIFFICILE.test(studente) || VOTO_BASSO_STUDENTE.test(studente)) return 'vicino';
  if (VOTO_ALTO_STUDENTE.test(studente)) return 'esulta';
  return 'guarda';
}
