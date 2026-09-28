// Nomi d'esame "molto simili" nella conferma dell'import del libretto.
// Regola: si UNISCE solo per nome identico dopo la normalizzazione (lo fa
// estrai-libretto). Qui non si unisce niente: si SEGNALA la somiglianza e lo
// studente decide se sono lo stesso esame (e ne toglie uno) o due diversi.

const ROMANI: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

/** Stessa normalizzazione di estrai-libretto: minuscole, niente accenti né punteggiatura. */
export function normalizzaNomeEsame(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Separa il testo dai numeri d'ordine (arabi o romani): "analisi i" → "analisi" + [1]. */
function scomponi(normalizzato: string): { testo: string; numeri: number[] } {
  const parole: string[] = [];
  const numeri: number[] = [];
  for (const p of normalizzato.split(' ')) {
    if (/^\d{1,2}$/.test(p)) numeri.push(Number(p));
    else if (ROMANI[p] != null) numeri.push(ROMANI[p]);
    else parole.push(p);
  }
  return { testo: parole.join(' '), numeri };
}

function distanza(a: string, b: string): number {
  let prima = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const riga = [i];
    for (let j = 1; j <= b.length; j++) {
      riga[j] = Math.min(
        prima[j] + 1,
        riga[j - 1] + 1,
        prima[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prima = riga;
  }
  return prima[b.length];
}

const SOGLIA = 0.85;

/**
 * true se due nomi sembrano lo stesso esame: identici dopo la normalizzazione
 * (nella conferma possono ricomparire se lo studente aggiunge o corregge una
 * riga a mano) oppure scritti in due modi
 * ("Analisi Matematica I" / "Analisi Matematica 1", "Programazione" /
 * "Programmazione", "Fisica generale" / "Fisica generale I").
 * Numeri d'ordine diversi = esami diversi: "Analisi I" / "Analisi II" NON si segnalano.
 */
export function nomiSimili(a: string, b: string): boolean {
  const na = normalizzaNomeEsame(a);
  const nb = normalizzaNomeEsame(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const sa = scomponi(na);
  const sb = scomponi(nb);
  const numeriDiversi =
    sa.numeri.length > 0 &&
    sb.numeri.length > 0 &&
    sa.numeri.join(',') !== sb.numeri.join(',');
  if (numeriDiversi) return false;
  if (sa.testo && sa.testo === sb.testo) return true;

  const lunghezza = Math.max(sa.testo.length, sb.testo.length);
  if (lunghezza === 0) return false;
  return 1 - distanza(sa.testo, sb.testo) / lunghezza >= SOGLIA;
}

/** Per ogni id, gli id delle altre righe con un nome molto simile. */
export function trovaSimili<T extends { id: number; materia: string }>(
  righe: T[]
): Map<number, number[]> {
  const simili = new Map<number, number[]>();
  for (let i = 0; i < righe.length; i++) {
    for (let j = i + 1; j < righe.length; j++) {
      if (!nomiSimili(righe[i].materia, righe[j].materia)) continue;
      simili.set(righe[i].id, [...(simili.get(righe[i].id) ?? []), righe[j].id]);
      simili.set(righe[j].id, [...(simili.get(righe[j].id) ?? []), righe[i].id]);
    }
  }
  return simili;
}
