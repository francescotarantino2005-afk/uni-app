// Materiali di Lode (test, esercizi, piani), cronologia per budget e correzione
// dei test calcolata dal codice (chat/materiali.ts). Il caso vero: TOLC-I del 9
// ottobre 2026, il test di 20 domande uscito dalla cronologia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUDGET_STORICO_TOKEN,
  ULTIMI_SEMPRE,
  calcolaRisultato,
  correzioneDaStorico,
  decidiCorrezione,
  estraiChiave,
  finestraStorico,
  istruzioneMateriale,
  leggiChiave,
  leggiRisposte,
  materialeAttivo,
  metadatiMateriale,
  rigaRisultato,
  tipoMateriale,
} from '../supabase/functions/chat/materiali.ts';
import { INIZIO_CRONOLOGIA, istruzioniTecniche, messaggiModello, richiestaChat, testoRisposta } from '../supabase/functions/chat/logica.ts';
import { formuleLeggibili } from '../supabase/functions/chat/formule.ts';

// Un test di 20 domande come quello del 9 ottobre (con le formule scritte male, come allora).
const DOMANDE = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  const testa = n === 1 ? 'Il valore di 3^2 - 2^3 + 5 è:' : n === 2 ? 'Le soluzioni di x^2 - 5x + 6 = 0 sono:' : `Domanda di prova numero ${n}, con un testo abbastanza lungo da pesare.`;
  return `${n}) ${testa}\nA) ${n} B) ${n + 1} C) ${n + 2} D) ${n + 3} E) ${n + 4}`;
});
const CHIAVE = 'ABCDEABCDEABCDEABCDE';
const SEGNO = `[[test formato=tolc chiave=${[...CHIAVE].map((l, i) => `${i + 1}${l}`).join(',')} senza_penalita=16-20]]`;
const TEST_GREZZO = `Ecco la mini-simulazione: 20 domande, 5 risposte ciascuna.\n\n${DOMANDE.join('\n\n')}\n\nMandami le tue risposte come lista di lettere (1-A, 2-B...).\n${SEGNO}`;

test('il segno [[test]] si toglie dal testo e diventa la chiave nei metadati', () => {
  const { testo, chiave } = estraiChiave(formuleLeggibili(TEST_GREZZO));
  assert.ok(!testo.includes('[['), 'il segno non arriva allo studente');
  assert.equal(Object.keys(chiave.chiave).length, 20);
  assert.equal(chiave.chiave['5'], 'E');
  assert.equal(chiave.formato, 'tolc');
  assert.deepEqual(chiave.senza_penalita, [16, 17, 18, 19, 20]);
  assert.equal(chiave.domande.length, 20);
  const meta = metadatiMateriale(testo, chiave);
  assert.equal(meta.materiale, 'test');
  assert.deepEqual(leggiChiave(meta), chiave);
  assert.deepEqual(estraiChiave('Ciao, nessun test.'), { testo: 'Ciao, nessun test.', chiave: null });
});

test('formule nei test: 3^2 - 2^3 e x^2 - 5x + 6 arrivano in Unicode', () => {
  const testo = testoRisposta({ content: [{ type: 'text', text: TEST_GREZZO }] });
  assert.ok(testo.includes('3² - 2³ + 5'));
  assert.ok(testo.includes('x² - 5x + 6'));
  assert.ok(!/\^/.test(testo));
  // anche il materiale vecchio rimesso nel contesto passa dalla correzione delle formule
  assert.ok(!istruzioneMateriale({ ruolo: 'assistant', contenuto: 'x' }, formuleLeggibili('1) 3^2')).includes('^'));
});

test('riconosce i materiali: test, esercizi, piano; un messaggio qualunque no', () => {
  assert.equal(tipoMateriale(TEST_GREZZO), 'test');
  assert.equal(tipoMateriale('Ecco tre esercizi:\n1) 2x + 3 = 7\n2) 3x − 1 = 8\n3) x/2 = 4\nMandami i tuoi risultati quando hai finito.'), 'esercizi');
  assert.equal(tipoMateriale('**Lunedì 12** — derivate\n\n**Martedì 13** — integrali\n\n**Mercoledì 14** — TOLC'), 'piano');
  assert.equal(tipoMateriale('Il limite notevole di sin x / x per x che tende a 0 vale 1.'), null);
});

// Il caso del 9 ottobre: test lungo, poi 6-8 messaggi, poi le risposte.
function conversazioneTolc() {
  const t0 = Date.parse('2026-10-03T17:41:51Z');
  const righe = [
    { id: 'u0', ruolo: 'user', contenuto: 'mi preparo per il tolc di ingegneria', created_at: new Date(t0 - 60_000).toISOString() },
    { id: 'a0', ruolo: 'assistant', contenuto: 'Ti preparo una mini-simulazione.', created_at: new Date(t0 - 10_000).toISOString() },
    // il test scritto dal messaggio dell'impegno: nessun messaggio dello studente subito prima
    { id: 'test', ruolo: 'assistant', contenuto: estraiChiave(TEST_GREZZO).testo, created_at: new Date(t0).toISOString(), metadati: metadatiMateriale(estraiChiave(TEST_GREZZO).testo, estraiChiave(TEST_GREZZO).chiave) },
  ];
  for (let i = 0; i < 8; i++) {
    righe.push({
      id: `m${i}`,
      ruolo: i % 2 ? 'assistant' : 'user',
      contenuto: (i % 2 ? 'Risposta lunga di Lode sul piano di studio. ' : 'Domanda dello studente sul piano. ').repeat(i % 2 ? 60 : 3),
      created_at: new Date(t0 + (i + 1) * 3_600_000).toISOString(),
    });
  }
  return righe;
}

test('cronologia per budget: gli ultimi messaggi sempre interi, il resto finché c\'è budget', () => {
  const lunghi = Array.from({ length: 30 }, (_, i) => ({ ruolo: i % 2 ? 'assistant' : 'user', contenuto: 'x'.repeat(9_000) }));
  const f = finestraStorico(lunghi);
  assert.equal(f.length, ULTIMI_SEMPRE, 'oltre il budget restano gli ultimi, interi');
  assert.ok(f.every((m) => m.contenuto.length === 9_000));
  const corti = Array.from({ length: 40 }, () => ({ ruolo: 'user', contenuto: 'ciao' }));
  assert.equal(finestraStorico(corti).length, 40, 'messaggi corti: entrano tutti');
  assert.ok(BUDGET_STORICO_TOKEN >= 8_000);
});

test('caso TOLC: test, poi 8 messaggi, poi le risposte → il modello vede il test', () => {
  const righe = conversazioneTolc();
  // anche con una finestra stretta (solo gli ultimi 8) il test resta attivo e rientra nel contesto
  const finestra = finestraStorico(righe, 0, 8);
  assert.ok(!finestra.some((m) => m.id === 'test'), 'il test è fuori dalla finestra');
  const attivo = materialeAttivo(righe, Date.parse('2026-10-09T18:14:00Z'));
  assert.equal(attivo.id, 'test');
  const extra = istruzioneMateriale(attivo, formuleLeggibili(attivo.contenuto));
  const r = richiestaChat({ testo: 'dati', senzaVoti: false }, [], finestra, '11-B 12-C 13-E', extra);
  const visto = JSON.stringify(r);
  assert.ok(visto.includes('Domanda di prova numero 20'), 'il testo del test arriva al modello');
  assert.ok(visto.includes('3² - 2³ + 5'));
  // con la finestra vera (budget) il test di 20 domande sta dentro e non serve rimetterlo
  assert.ok(finestraStorico(righe).some((m) => m.id === 'test'));
});

test('la cronologia che comincia con un messaggio di Lode non lo butta via', () => {
  const m = messaggiModello(
    [
      { ruolo: 'assistant', contenuto: 'IL TEST' },
      { ruolo: 'user', contenuto: 'ok' },
      { ruolo: 'user', contenuto: 'le risposte (dopo un "Mi sono bloccato")' },
      { ruolo: 'assistant', contenuto: 'ecco' },
    ],
    'e allora?'
  );
  assert.deepEqual(m.map((x) => x.role), ['user', 'assistant', 'user', 'assistant', 'user']);
  assert.equal(m[0].content, INIZIO_CRONOLOGIA);
  assert.equal(m[1].content, 'IL TEST');
  assert.ok(m[2].content.includes('le risposte'), 'due messaggi di fila dello studente si uniscono');
});

test('un materiale più vecchio di due settimane non è più attivo', () => {
  const righe = conversazioneTolc().slice(0, 3);
  assert.equal(materialeAttivo(righe, Date.parse('2026-10-30T00:00:00Z')), null);
});

// ---------- le risposte e il punteggio ----------

// I messaggi veri dello studente del 9 ottobre.
const RISPOSTE_20_02 =
  'scrivo in ordine solo i risultati partendo dal primo esercizio\na\nb\na\nb\nC\nb ma ho fatto a mente\nnon so di cosa stiamo parlando\nC\nb\nnon so di cosa stiamo parlando non mi ricordo lo svolgimento, mi sembra si tratti di una funzione\nb\nb, sono andato completamente a logica, senza calcoli\nC\nlunedi? ho contato tutti i giorni fino ad arrivare a cento, non so se sia il procedimento corretto\nb\nC\nC\nb';
const RISPOSTE_20_14 = '11: non so svolgerlo 12:c/ 13 e? non sono sicuro, ho fatto a mente/ 14:c/15:c/16:a/17:b/18:c/19:c/20:b';

test('legge le risposte: lista in ordine, righe con commento, righe dubbie', () => {
  const l = leggiRisposte(RISPOSTE_20_02);
  assert.equal(l.risposte['1'], 'A');
  assert.equal(l.risposte['6'], 'B', '"b ma ho fatto a mente" vale B');
  assert.equal(l.risposte['12'], 'B');
  assert.deepEqual(l.dubbie.map((d) => d.n), [7, 10, 14]);
  const l2 = leggiRisposte(RISPOSTE_20_14);
  assert.equal(l2.risposte['12'], 'C');
  assert.equal(l2.risposte['20'], 'B');
  assert.deepEqual(l2.dubbie.map((d) => d.n), [11, 13]);
  assert.deepEqual(leggiRisposte('alla domanda numero 12 ho risposto b').risposte, { 12: 'B' });
  assert.deepEqual(leggiRisposte('1-A 2-B 3-C').risposte, { 1: 'A', 2: 'B', 3: 'C' });
  assert.equal(leggiRisposte('Ho il TOLC-I il 14 ottobre, aiutami a organizzarmi').chiare, 0);
});

test('punteggio TOLC calcolato dal codice: +1, −0,25, 0; inglese senza penalità', () => {
  const chiave = estraiChiave(TEST_GREZZO).chiave;
  const risposte = {};
  for (let n = 1; n <= 20; n++) risposte[n] = CHIAVE[n - 1];
  risposte[3] = 'A'; // sbagliata, -0,25
  risposte[4] = null; // non data
  risposte[17] = 'A'; // sbagliata ma senza penalità
  const r = calcolaRisultato(chiave, risposte);
  assert.deepEqual([r.giuste, r.sbagliate, r.non_date], [17, 2, 1]);
  assert.equal(r.punteggio, 16.75);
  assert.equal(rigaRisultato(r, false).startsWith('Risultato: 16,75 su 20 — 17 giuste, 2 sbagliate, 1 non date'), true);
  assert.ok(rigaRisultato(r, true).startsWith('**Risultato: 16,75 su 20**'));
});

test('risposte ambigue: il codice chiede SOLO le righe dubbie, col numero; poi conta', () => {
  const chiave = estraiChiave(TEST_GREZZO).chiave;
  const d1 = decidiCorrezione(RISPOSTE_20_02, 'test', chiave, null, true);
  assert.equal(d1.tipo, 'conferma');
  assert.match(d1.testo, /\*\*7\)\*\* hai scritto «non so di cosa stiamo parlando»/);
  assert.match(d1.testo, /Mi mancano le risposte a: 19, 20/);
  assert.deepEqual(d1.stato.da_confermare, [7, 10, 14, 19, 20]);
  // lo studente risponde alle righe chieste
  const storico = [{ ruolo: 'assistant', metadati: { correzione: d1.stato } }];
  const d2 = decidiCorrezione('7-A 10-B 14: non data 19-D 20-E', 'test', chiave, correzioneDaStorico(storico, 'test'), true);
  assert.equal(d2.tipo, 'conferma', '"non data" su una riga sola va bene ma la 14 va confermata');
  const d3 = decidiCorrezione('contala come non data', 'test', chiave, d2.stato, true);
  assert.equal(d3.tipo, 'risultato');
  assert.equal(d3.risultato.massimo, 20);
  assert.equal(d3.stato.risposte['14'], null);
  assert.equal(d3.risultato.giuste + d3.risultato.sbagliate + d3.risultato.non_date, 20);
  // dopo il risultato: "alla 12 ho risposto b" cambia solo la 12 e ricalcola
  const d4 = decidiCorrezione('alla domanda numero 12 ho risposto b', 'test', chiave, d3.stato, true);
  assert.equal(d4.tipo, 'risultato');
  assert.equal(d4.stato.risposte['12'], 'B');
  assert.equal(d4.risultato.righe.find((x) => x.n === 12).esito, 'giusta');
  // un messaggio qualunque non è una consegna
  assert.equal(decidiCorrezione('spiegami meglio i logaritmi', 'test', chiave, d4.stato, true).tipo, 'nessuna');
});

test('istruzioni: segno del test, conteggio una volta sola, mai inventare il materiale mancante', () => {
  for (const f of ['testo', 'markdown']) {
    const t = istruzioniTecniche(f);
    assert.match(t, /\[\[test formato=tolc chiave=1A,2C,3E,\.\.\.\]\]/);
    assert.match(t, /conteggio UNA sola volta, domanda per domanda/);
    assert.match(t, /NON trovi in quello che vedi/);
  }
  const manuale = readFileSync(new URL('../supabase/functions/_shared/manuale-del-professore.md', import.meta.url), 'utf8');
  assert.match(manuale, /Versione 1\.2/);
  assert.match(manuale, /Mai fingere di ricordare/);
});
