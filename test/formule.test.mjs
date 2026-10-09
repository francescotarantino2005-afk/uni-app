// Le formule leggibili (chat/formule.ts): ^ e * non arrivano allo studente.
// Nella prova dal vivo del 9 ottobre 2026 il modello scriveva ancora x^(3/2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formuleLeggibili as f } from '../supabase/functions/chat/formule.ts';
import { istruzioniTecniche, testoRisposta } from '../supabase/functions/chat/logica.ts';

test('formule: esponenti con ^ diventano apici', () => {
  assert.equal(f('x^2 + x^10'), 'x² + x¹⁰');
  assert.equal(f('x^(1/2) e x^(3/2)'), 'x¹⁄² e x³⁄²');
  assert.equal(f('D(x^n) = n·x^(n−1)'), 'D(xⁿ) = n·xⁿ⁻¹');
  assert.equal(f('e^x, x^-1, x^2y'), 'eˣ, x⁻¹, x²y');
  assert.equal(f('e^(x²)'), 'e^(x²)', 'quello che non ha apice resta com\'è');
});

test('formule: * tra numeri e variabili diventa ·, il markdown no', () => {
  assert.equal(f('3x^3 + 2x*sqrt(x)'), '3x³ + 2x·sqrt(x)');
  assert.equal(f('2 * 3 = 6'), '2 · 3 = 6');
  assert.equal(f('le soluzioni sono **x = 2** e **x = 3**'), 'le soluzioni sono **x = 2** e **x = 3**');
  assert.equal(f('**Lunedì 13**: limiti'), '**Lunedì 13**: limiti');
  assert.equal(f('*corsivo* resta'), '*corsivo* resta');
  assert.equal(f('parola* nota'), 'parola* nota');
});

test('formule: il codice tra backtick non si tocca', () => {
  assert.equal(f('usa `a ^ b * c`'), 'usa `a ^ b * c`');
  assert.equal(f('```\nx = a*b\ny = x^2\n```'), '```\nx = a*b\ny = x^2\n```');
});

test('formule: la risposta della chat passa sempre dalla conversione', () => {
  assert.equal(testoRisposta({ content: [{ type: 'text', text: 'f(x) = x^(3/2)' }] }), 'f(x) = x³⁄²');
});

test('formato: esponenti frazionari spiegati in entrambi i formati; i messaggi lunghi hanno blocchi con etichetta', () => {
  for (const formato of ['testo', 'markdown']) assert.match(istruzioniTecniche(formato), /x\^\(3\/2\) si scrive x√x/);
  assert.match(istruzioniTecniche('testo'), /Ogni blocco su una riga sua che comincia con la sua etichetta/);
  assert.match(istruzioniTecniche('markdown'), /COMINCIA con il giorno in grassetto/);
});

test('cache da un\'ora: i blocchi stabili hanno ttl 1h e la scrittura da un\'ora costa il doppio dell\'input', async () => {
  const { CACHE_STABILE, costoUSD } = await import('../supabase/functions/chat/logica.ts');
  assert.deepEqual(CACHE_STABILE, { type: 'ephemeral', ttl: '1h' });
  // prova dal vivo del 9 ottobre: 9.702 token scritti con ttl 1h
  const scrittura = { input_tokens: 25, output_tokens: 100, cache_creation_input_tokens: 9702, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 9702 } };
  assert.equal(Number(costoUSD('claude-sonnet-5-5', scrittura).toFixed(6)), Number(((25 * 2 + 100 * 10 + 9702 * 4) / 1e6).toFixed(6)));
});
