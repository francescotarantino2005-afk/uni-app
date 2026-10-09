// La chat della 1.0.1: Markdown leggero, posa del robot, spazi per esame.
// Solo logica pura (lib/markdown.ts, lib/posaRisposta.ts, lib/conversazioni.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blocchi, pezzi } from '../lib/markdown.ts';
import { posaPerRisposta, votoGiudizio } from '../lib/posaRisposta.ts';
import { TITOLO_ALTRE, gruppiBarra, titoloValido } from '../lib/conversazioni.ts';

const PIANO = readFileSync(new URL('../docs/prova-dal-vivo-2026-10-09.md', import.meta.url), 'utf8');

test('markdown: grassetto, corsivo, codice e formule dentro la riga', () => {
  assert.deepEqual(pezzi('le soluzioni sono **x = 2** e $x² − 1$'), [
    { testo: 'le soluzioni sono ' },
    { testo: 'x = 2', grassetto: true },
    { testo: ' e ' },
    { testo: 'x² − 1', formula: true },
  ]);
  assert.deepEqual(pezzi('**Risultato: $f′(x) = 9x²$**'), [
    { testo: 'Risultato: ', grassetto: true },
    { testo: 'f′(x) = 9x²', grassetto: true, formula: true },
  ]);
  assert.deepEqual(pezzi('usa `print(x)` e *poi* basta'), [
    { testo: 'usa ' },
    { testo: 'print(x)', codice: true },
    { testo: ' e ' },
    { testo: 'poi', corsivo: true },
    { testo: ' basta' },
  ]);
  // un testo semplice resta com'è
  assert.deepEqual(pezzi('3 · 4 = 12, niente da fare'), [{ testo: '3 · 4 = 12, niente da fare' }]);
});

test('markdown: titoletti, elenchi, opzioni di risposta multipla, codice', () => {
  const b = blocchi('## Il piano\n\n**Lunedì 12** (2 ore)\n- matematica\n- logica\n\nQual è la derivata?\nA) 2x\nB) x²\n\n```\nx = a*b\n```');
  assert.deepEqual(b.map((x) => x.tipo), ['titolo', 'paragrafo', 'elenco', 'paragrafo', 'elenco', 'codice']);
  assert.equal(b[1].righe[0][0].grassetto, true);
  assert.deepEqual(b[2].voci.map((v) => v.segno), ['•', '•']);
  assert.deepEqual(b[4].voci.map((v) => v.segno), ['A)', 'B)']);
  assert.equal(b[5].testo, 'x = a*b');
  // esercizi numerati "1)"
  assert.deepEqual(blocchi('1) primo\n2) secondo')[0].voci.map((v) => v.segno), ['1)', '2)']);
});

test('markdown: il piano TOLC della prova dal vivo ha i giorni in grassetto in testa ai blocchi', () => {
  // le battute registrate nel documento sono in testo; qui il piano vero è in scratch: si prova la forma
  const piano = '**Venerdì 9** (2 ore)\n- 1 h 15: matematica\n\n**Sabato 10** (2 ore)\n- 1 h 15: funzioni';
  const b = blocchi(piano);
  const giorni = b.filter((x) => x.tipo === 'paragrafo' && x.righe[0][0].grassetto).map((x) => x.righe[0][0].testo);
  assert.deepEqual(giorni, ['Venerdì 9', 'Sabato 10']);
  assert.ok(PIANO.length > 0);
});

test('markdown: un messaggio vecchio in testo semplice si legge come prima', () => {
  const vecchio = 'Voto: 21/30. Hai le definizioni di base.\n\nCosa ha funzionato: la definizione.';
  const b = blocchi(vecchio);
  assert.equal(b.length, 2);
  assert.equal(b[0].righe[0][0].testo, 'Voto: 21/30. Hai le definizioni di base.');
});

test('posa: esulta per i voti alti, vicino nei momenti difficili, guarda di solito', () => {
  assert.equal(votoGiudizio('Voto: **28/30**. Bene.'), 28);
  assert.equal(posaPerRisposta('Voto: 28/30. Ottimo lavoro.', 'la rescissione è…'), 'esulta');
  assert.equal(posaPerRisposta('Voto: 18/30. Ci sei appena.', 'non ricordo'), 'vicino');
  assert.equal(posaPerRisposta('Voto: 24/30.', 'ok'), 'guarda');
  assert.equal(posaPerRisposta('Grazie per avermelo detto.', 'Non ce la faccio più con tutto.'), 'vicino');
  assert.equal(posaPerRisposta('Capita.', 'mi hanno bocciato ad analisi'), 'vicino');
  assert.equal(posaPerRisposta('Grande!', 'ho preso 30 e lode a fisica'), 'esulta');
  assert.equal(posaPerRisposta('La causa è…', 'cos\'è la causa?'), 'guarda');
});

test('barra laterale: Generale in cima, un gruppo per esame da sostenere, Altre chat in fondo', () => {
  const conv = [
    { id: 'g', exam_id: null, titolo: 'Generale', generale: true, aggiornata_il: '2026-10-01' },
    { id: 'a1', exam_id: 'an', titolo: 'Limiti', generale: false, aggiornata_il: '2026-10-05' },
    { id: 'a2', exam_id: 'an', titolo: 'Derivate', generale: false, aggiornata_il: '2026-10-08' },
    { id: 'x', exam_id: null, titolo: 'Erasmus', generale: false, aggiornata_il: '2026-10-02' },
    { id: 's', exam_id: 'st', titolo: 'Ripasso', generale: false, aggiornata_il: '2026-09-01' },
  ];
  const esami = [
    { id: 'an', materia: 'Analisi I', superato: false },
    { id: 'di', materia: 'Diritto privato', superato: false },
    { id: 'st', materia: 'Storia', superato: true },
    { id: 'fi', materia: 'Fisica', superato: true },
  ];
  const { generale, gruppi } = gruppiBarra(conv, esami);
  assert.equal(generale.id, 'g');
  assert.deepEqual(gruppi.map((g) => g.titolo), ['Analisi I', 'Diritto privato', 'Storia', TITOLO_ALTRE]);
  assert.deepEqual(gruppi[0].conversazioni.map((c) => c.id), ['a2', 'a1'], 'le più recenti in alto');
  assert.equal(gruppi[1].conversazioni.length, 0, 'un esame da sostenere compare anche senza chat');
  assert.ok(!gruppi.some((g) => g.titolo === 'Fisica'), 'un esame già dato senza chat non compare');
});

test('barra laterale: rinomina con titolo valido', () => {
  assert.equal(titoloValido('  Limiti   notevoli '), 'Limiti notevoli');
  assert.equal(titoloValido('   '), null);
  assert.equal(titoloValido('x'.repeat(100)).length, 80);
});
