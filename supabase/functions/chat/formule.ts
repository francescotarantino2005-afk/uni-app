// Le formule leggibili: l'ultima difesa contro ^ e * nelle risposte della chat.
// Le istruzioni chiedono gia' apici Unicode e radici, ma il modello a volte
// scrive x^(3/2) o 2*x (prova dal vivo del 9 ottobre 2026). Qui si convertono
// in x³⁄², 2·x. Logica PURA: la usa chat/logica.ts (testoRisposta), la coprono
// i test. Il codice tra backtick non si tocca.

const APICI: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', k: 'ᵏ', m: 'ᵐ', t: 'ᵗ', a: 'ᵃ', b: 'ᵇ',
};
const BARRA = '⁄';

/** Il testo ad apice, o null se un carattere non ha l'apice. */
function apice(s: string): string | null {
  let r = '';
  for (const c of s.replace(/\s+/g, '')) {
    const a = APICI[c];
    if (!a) return null;
    r += a;
  }
  return r || null;
}

/** Un esponente scritto con ^ in apice: x^2 -> x², x^(n−1) -> xⁿ⁻¹, x^(3/2) -> x³⁄², x^-1 -> x⁻¹. */
function esponenti(t: string): string {
  return t
    .replace(/\^\(\s*([-−]?\d+)\s*\/\s*(\d+)\s*\)/g, (tutto, p: string, q: string) => {
      const a = apice(p);
      const b = apice(q);
      return a && b ? `${a}${BARRA}${b}` : tutto;
    })
    .replace(/\^\(([^()\n]{1,12})\)/g, (tutto, dentro: string) => apice(dentro) ?? tutto)
    .replace(/\^\{([^{}\n]{1,12})\}/g, (tutto, dentro: string) => apice(dentro) ?? tutto)
    .replace(/\^([-−]?\d+)/g, (tutto, e: string) => apice(e) ?? tutto)
    .replace(/\^([-−]?[nixk])(?![\p{L}\d])/gu, (tutto, e: string) => apice(e) ?? tutto);
}

/** Moltiplicazioni con * tra numeri, variabili e parentesi: 2*x -> 2·x. Il grassetto **…** non si tocca. */
function prodotti(t: string): string {
  // "2x*sqrt(x)", "a * b": spazio da tutti e due i lati o da nessuno (un asterisco
  // di nota, "parola* nota", resta com'e').
  return t
    .replace(/([\w)²³ⁿ√])(?<!\*)\*(?!\*)(?=[\w(√])/g, '$1·')
    .replace(/([\w)²³ⁿ√]) (?<!\*)\*(?!\*) (?=[\w(√])/g, '$1 · ');
}

/** Converte ^ e * fuori dal codice (tra backtick singoli o tripli). */
export function formuleLeggibili(testo: string): string {
  if (!/[\^*]/.test(testo)) return testo;
  return testo
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((pezzo, i) => (i % 2 === 1 ? pezzo : prodotti(esponenti(pezzo))))
    .join('');
}
