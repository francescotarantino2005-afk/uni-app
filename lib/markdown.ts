// Il Markdown leggero dei messaggi di Lode (dalla 1.0.1 la chat chiede al
// server il formato 'markdown'). Logica PURA: dal testo ai blocchi da disegnare;
// il disegno lo fa components/TestoMessaggio. Cosa si riconosce, e basta:
// titoletti (## …), elenchi (- …, 1) …, 1. …), opzioni di risposta multipla
// (A) …), blocchi di codice (```), separatori (---), e dentro le righe
// **grassetto**, *corsivo*, `codice` e $formule$. Tutto il resto è testo: un
// messaggio vecchio in testo semplice si legge come prima.

export type Pezzo = {
  testo: string;
  grassetto?: boolean;
  corsivo?: boolean;
  codice?: boolean;
  formula?: boolean;
};

export type Riga = Pezzo[];

export type Blocco =
  | { tipo: 'titolo'; livello: number; riga: Riga }
  | { tipo: 'paragrafo'; righe: Riga[] }
  | { tipo: 'elenco'; voci: { segno: string; riga: Riga }[] }
  | { tipo: 'codice'; testo: string }
  | { tipo: 'separatore' };

const INLINE = /(`[^`\n]+`|\$[^$\n]+\$|\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\s][^*\n]*?\*)/g;

/** I pezzi di una riga: grassetto, corsivo, codice e formule. */
export function pezzi(riga: string, base: Omit<Pezzo, 'testo'> = {}): Riga {
  const out: Riga = [];
  let ultimo = 0;
  for (const m of riga.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > ultimo) out.push({ ...base, testo: riga.slice(ultimo, i) });
    const t = m[0];
    if (t.startsWith('`')) out.push({ ...base, testo: t.slice(1, -1), codice: true });
    else if (t.startsWith('$')) out.push({ ...base, testo: t.slice(1, -1).trim(), formula: true });
    else if (t.startsWith('**') || t.startsWith('__')) out.push(...pezzi(t.slice(2, -2), { ...base, grassetto: true }));
    else out.push(...pezzi(t.slice(1, -1), { ...base, corsivo: true }));
    ultimo = i + t.length;
  }
  if (ultimo < riga.length) out.push({ ...base, testo: riga.slice(ultimo) });
  return out.filter((p) => p.testo.length > 0);
}

const TITOLO = /^(#{1,6})\s+(.*)$/;
const PUNTO = /^\s*[-*•]\s+(.*)$/;
const NUMERO = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const OPZIONE = /^\s*([A-Ea-e])\)\s+(.*)$/;
const SEPARATORE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Dal testo del messaggio ai blocchi. */
export function blocchi(testo: string): Blocco[] {
  const out: Blocco[] = [];
  const righe = testo.replace(/\r\n?/g, '\n').split('\n');
  let paragrafo: Riga[] = [];
  let elenco: { segno: string; riga: Riga }[] = [];

  const chiudiParagrafo = () => {
    if (paragrafo.length) out.push({ tipo: 'paragrafo', righe: paragrafo });
    paragrafo = [];
  };
  const chiudiElenco = () => {
    if (elenco.length) out.push({ tipo: 'elenco', voci: elenco });
    elenco = [];
  };

  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];
    if (/^\s*```/.test(r)) {
      chiudiParagrafo();
      chiudiElenco();
      const codice: string[] = [];
      i++;
      while (i < righe.length && !/^\s*```/.test(righe[i])) codice.push(righe[i++]);
      out.push({ tipo: 'codice', testo: codice.join('\n') });
      continue;
    }
    if (!r.trim()) {
      chiudiParagrafo();
      chiudiElenco();
      continue;
    }
    if (SEPARATORE.test(r)) {
      chiudiParagrafo();
      chiudiElenco();
      out.push({ tipo: 'separatore' });
      continue;
    }
    const t = r.match(TITOLO);
    if (t) {
      chiudiParagrafo();
      chiudiElenco();
      out.push({ tipo: 'titolo', livello: t[1].length, riga: pezzi(t[2].trim()) });
      continue;
    }
    const voce = r.match(PUNTO) ?? null;
    const numero = voce ? null : r.match(NUMERO);
    const opzione = voce || numero ? null : r.match(OPZIONE);
    if (voce || numero || opzione) {
      chiudiParagrafo();
      const segno = voce ? '•' : numero ? `${numero[1]})` : `${opzione![1].toUpperCase()})`;
      const contenuto = (voce?.[1] ?? numero?.[2] ?? opzione![2]).trim();
      elenco.push({ segno, riga: pezzi(contenuto) });
      continue;
    }
    // una riga che continua la voce precedente dell'elenco (rientrata)
    if (elenco.length && /^\s{2,}\S/.test(r)) {
      const v = elenco[elenco.length - 1];
      v.riga = [...v.riga, { testo: ' ' }, ...pezzi(r.trim())];
      continue;
    }
    chiudiElenco();
    paragrafo.push(pezzi(r.trimEnd()));
  }
  chiudiParagrafo();
  chiudiElenco();
  return out;
}
