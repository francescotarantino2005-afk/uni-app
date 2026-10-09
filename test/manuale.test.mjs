// Il manuale del professore, il tipo d'esame e la memoria dello studente: solo
// logica pura, niente rete. Le risposte vere del modello (diritto privato,
// storia, inglese, analisi, brutto voto, malessere) sono in manuale-prove.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MANUALE } from '../supabase/functions/_shared/manuale-testo.ts';
import { manualeCompleto, sezioniManuale } from '../supabase/functions/_shared/manuale.ts';
import { nomeEsameCorretto, profiloCompleto, richiestaModello, systemDialogo } from '../supabase/functions/accoglienza-dialogo/logica.ts';
import {
  ISTRUZIONI_TECNICHE,
  bloccoNote,
  esameInLavorazione,
  estraiTipoEsame,
  formattaContesto,
  istruzioneEsame,
  istruzioneImpegno,
  istruzioniSistema,
  richiestaChat,
  tipoDaSalvare,
} from '../supabase/functions/chat/logica.ts';
import {
  MAX_NOTE_TENUTE,
  NOTE_VIETATE,
  applicaAzioni,
  leggiOperazioni,
  pianoMemoria,
  quandoAggiornare,
  richiestaMemoria,
} from '../supabase/functions/chat/memoria.ts';

const FILE_MD = new URL('../supabase/functions/_shared/manuale-del-professore.md', import.meta.url);
const ESAMI = [
  { id: 'a', materia: 'Analisi 1', cfu: 9, voto: null, lode: null, idoneita: false, data_esame: null, tipo_esame: 'scritto' },
  { id: 'd', materia: 'Diritto Privato', cfu: 12, voto: null, lode: null, idoneita: false, data_esame: null, tipo_esame: null },
  { id: 'f', materia: 'Fisica', cfu: 6, voto: 18, lode: false, idoneita: false, data_esame: '2026-09-10', tipo_esame: null },
];

// ---------- il manuale ----------

test('manuale: il testo nel codice è identico al file, carattere per carattere', () => {
  assert.equal(MANUALE, readFileSync(FILE_MD, 'utf8').replace(/\r\n/g, '\n'));
  assert.match(MANUALE, /^# Manuale del professore — come insegna Lode\n\nVersione 1.2 · 9 ottobre 2026/);
});

test('manuale: {nome_bot} diventa il nome del bot, e senza nome resta Lode', () => {
  assert.ok(MANUALE.includes('{nome_bot}'));
  assert.ok(manualeCompleto('Gigi').includes('Sei Gigi, il tutor dello studente'));
  assert.ok(!manualeCompleto('Gigi').includes('{nome_bot}'));
  assert.ok(manualeCompleto(null).includes('Sei Lode, il tutor'));
  assert.ok(manualeCompleto('  ').includes('Sei Lode, il tutor'));
});

test('chat: il manuale è nel blocco in cache, le istruzioni tecniche vengono dopo e hanno la precedenza', () => {
  const r = richiestaChat({ testo: 'Oggi è venerdì.', senzaVoti: false, nomeBot: 'Gigi' }, [], [], 'ciao');
  const blocco = r.system[0];
  assert.deepEqual(blocco.cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.ok(blocco.text.startsWith(manualeCompleto('Gigi')));
  assert.ok(blocco.text.indexOf('Sei Gigi') < blocco.text.indexOf('ISTRUZIONI TECNICHE DELL\'APP'));
  assert.ok(blocco.text.endsWith(ISTRUZIONI_TECNICHE));
  assert.match(ISTRUZIONI_TECNICHE, /PRECEDENZA sul manuale/);
  assert.equal(istruzioniSistema('Gigi'), blocco.text);
  // niente più "Come parli" generico: le regole di comportamento sono quelle del manuale
  assert.ok(!blocco.text.includes('Come parli:'));
  // le istruzioni tecniche di prima restano: formato, impegni, zero invenzioni sui dati
  assert.match(blocco.text, /NIENTE markdown|Niente markdown/i);
  assert.match(blocco.text, /Una promessa fatta in un messaggio precedente/);
  assert.match(blocco.text, /<dati_reali_utente>/);
  assert.match(blocco.text, /Telefono Amico/);
});

test('accoglienza-dialogo: solo le sezioni 1, 7 e 8 del manuale, e il nome del bot', () => {
  const sezioni = sezioniManuale([1, 7, 8], 'Gigi');
  assert.deepEqual([...sezioni.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1])), [1, 7, 8]);
  assert.ok(sezioni.includes('Sei Gigi'));
  const sistema = systemDialogo('Gigi');
  assert.ok(sistema.startsWith('## 1. Chi è Lode'));
  assert.ok(sistema.includes('## 7. Il lato umano') && sistema.includes('## 8. Onestà'));
  for (const n of [2, 3, 4, 5, 6, 9]) assert.ok(!new RegExp(`^## ${n}\\. `, 'm').test(sistema), `sezione ${n} non dovrebbe esserci`);
  assert.match(sistema, /ISTRUZIONI DEL DIALOGO \(hanno la precedenza/);
  // la richiesta del dialogo usa il nome del bot dell'input
  const input = { nomeBot: 'Gigi', oggi: '2026-10-03', conversazione: [], profilo: profiloCompleto({}), chieste: [], esami: [], libretto: { media: null, cfu: 0 } };
  assert.ok(richiestaModello(input).system.includes('Sei Gigi'));
});

test('sigle CISIA: TOLC-SPS si scrive TOLC-SPS, senza toccare le altre', () => {
  assert.equal(nomeEsameCorretto('tolc sps'), 'TOLC-SPS');
  assert.equal(nomeEsameCorretto('Tolc-sps'), 'TOLC-SPS');
  assert.equal(nomeEsameCorretto('TOLC SPS'), 'TOLC-SPS');
  assert.equal(nomeEsameCorretto('tolc s'), 'TOLC-S');
  assert.equal(nomeEsameCorretto('tolc su'), 'TOLC-SU');
  assert.equal(nomeEsameCorretto('tolc psi'), 'TOLC-PSI');
  assert.equal(nomeEsameCorretto('tolc i'), 'TOLC-I');
  assert.match(MANUALE, /TOLC-SPS/);
});

// ---------- il tipo d'esame ----------

test('esame in lavorazione: lo si riconosce dal messaggio, dallo storico, dall\'accoglienza', () => {
  assert.equal(esameInLavorazione(ESAMI, ['fammi un esercizio su analisi 1'])?.id, 'a');
  assert.equal(esameInLavorazione(ESAMI, ['interrogami sul diritto privato'])?.id, 'd');
  // l'ultimo messaggio vince sui precedenti
  assert.equal(esameInLavorazione(ESAMI, ['ripassiamo diritto privato', 'prima parlavamo di analisi 1'])?.id, 'd');
  // nessun nome nel messaggio: i precedenti, poi l'esame dell'accoglienza
  assert.equal(esameInLavorazione(ESAMI, ['non ho capito', 'torniamo ad analisi 1'])?.id, 'a');
  assert.equal(esameInLavorazione(ESAMI, ['ok'], 'Diritto Privato')?.id, 'd');
  // se è già dato (Fisica 18) si riconosce comunque, ma un esame da sostenere ha la precedenza a parità
  assert.equal(esameInLavorazione(ESAMI, ['ho preso 18 a fisica'])?.id, 'f');
  // niente da indovinare: più esami da sostenere e nessun nome = nessuno
  assert.equal(esameInLavorazione(ESAMI, ['ciao']), null);
  // un solo esame da sostenere: è quello
  assert.equal(esameInLavorazione([ESAMI[1], ESAMI[2]], ['ciao'])?.id, 'd');
  assert.equal(esameInLavorazione([], ['analisi 1']), null);
  // "Fisica" per "Fisica 1": vale solo se, tolto il numero, nessun altro esame ha lo stesso nome
  const doppi = [
    { ...ESAMI[2], id: 'f1', materia: 'Fisica 1' },
    { ...ESAMI[0], id: 'am1', materia: 'Analisi Matematica 1' },
    { ...ESAMI[0], id: 'am2', materia: 'Analisi Matematica 2' },
  ];
  assert.equal(esameInLavorazione(doppi, ['ho preso 18 a Fisica'])?.id, 'f1');
  assert.equal(esameInLavorazione(doppi, ['analisi matematica 2, limiti'])?.id, 'am2');
  assert.equal(esameInLavorazione(doppi, ['parliamo di analisi matematica']), null, 'due esami con lo stesso nome: non si indovina');
});

test('tipo d\'esame: se è noto lo si passa alla chat, se manca la chat lo chiede una volta', () => {
  assert.match(istruzioneEsame(ESAMI[0]), /Analisi 1.*Tipo d'esame: scritto.*non chiederlo/);
  assert.match(istruzioneEsame(ESAMI[1]), /Diritto Privato.*NON è noto.*UNA volta.*\[\[tipo_esame:/);
  assert.equal(istruzioneEsame(null), '');
  // finisce nel blocco del momento, DOPO il segno di cache, e non rompe i due blocchi in cache
  const r = richiestaChat({ testo: 'x', senzaVoti: false, esame: ESAMI[0] }, [], [], 'ciao', 'EXTRA');
  assert.equal(r.system.length, 3);
  assert.equal(r.system[2].cache_control, undefined);
  assert.match(r.system[2].text, /Tipo d'esame: scritto[\s\S]*EXTRA/);
  assert.equal(richiestaChat({ testo: 'x', senzaVoti: false }, [], [], 'ciao').system.length, 2);
});

test('tipo d\'esame: nei dati dello studente compare accanto agli esami', () => {
  const { testo } = formattaContesto({
    oggi: '2026-10-03', giorno: 6, profilo: { nome: 'Marta' }, lezioni: [], scadenze: [], esami: ESAMI,
  });
  assert.match(testo, /Esami da sostenere: Analisi 1 \(scritto\), Diritto Privato\./);
  assert.match(testo, /- Fisica: 18 \(6 CFU\), sostenuto il 2026-09-10/);
});

test('tipo d\'esame: il segno [[tipo_esame:...]] non arriva mai allo studente', () => {
  assert.deepEqual(estraiTipoEsame('Va bene, partiamo dai contratti.\n[[tipo_esame:orale]]'), { testo: 'Va bene, partiamo dai contratti.', tipo: 'orale' });
  assert.deepEqual(estraiTipoEsame('Ok [[ tipo_esame : Scritto ]] ciao'), { testo: 'Ok ciao', tipo: 'scritto' });
  // valore sconosciuto: il segno si toglie lo stesso, il tipo no
  assert.deepEqual(estraiTipoEsame('Ciao\n[[tipo_esame:boh]]'), { testo: 'Ciao', tipo: null });
  assert.deepEqual(estraiTipoEsame('Nessun segno.'), { testo: 'Nessun segno.', tipo: null });
});

test('tipo d\'esame: si salva solo se l\'ha detto lo studente, l\'esame c\'è e non ha già un tipo', () => {
  assert.equal(tipoDaSalvare('orale', ESAMI[1], 'è un esame orale'), 'orale');
  assert.equal(tipoDaSalvare('orale', ESAMI[1], 'interrogami sui contratti'), null, 'una richiesta non e una dichiarazione');
  assert.equal(tipoDaSalvare('entrambi', ESAMI[1], "sia lo scritto sia l'orale"), 'entrambi');
  assert.equal(tipoDaSalvare('scritto', ESAMI[1], 'boh, credo di sì'), null, 'mai indovinare');
  assert.equal(tipoDaSalvare('orale', ESAMI[0], 'orale'), null, 'non sovrascrive un tipo già presente');
  assert.equal(tipoDaSalvare('orale', null, 'orale'), null, 'esame fuori dal libretto: nessun salvataggio');
  assert.equal(tipoDaSalvare(null, ESAMI[1], 'orale'), null);
});

test('impegno: se emerge un malessere serio la promessa passa in secondo piano', () => {
  assert.match(istruzioneImpegno('Ti preparo 5 esercizi', true), /malessere serio[\s\S]*niente esercizi/);
});

// ---------- la memoria ----------

const nota = (id, categoria, contenuto, importanza = 2, updated_at = '2026-09-01T10:00:00Z') => ({ id, categoria, contenuto, importanza, updated_at });

test('memoria: il blocco note è raggruppato e chiede di non elencarle', () => {
  const b = bloccoNote([nota('1', 'ostacoli', 'Errore: dimentica le condizioni di esistenza'), nota('2', 'metodo_studio', 'Capisce con un esempio svolto')]);
  assert.match(b, /Errori ricorrenti, punti deboli, ostacoli:\n- Errore: dimentica/);
  assert.match(b, /Metodo che gli funziona:\n- Capisce/);
  assert.match(b, /non elencarli mai/);
  assert.equal(bloccoNote([]), '');
});

test('memoria: quando si aggiorna — ogni 3 messaggi, messaggio lungo, ritorno dopo una pausa', () => {
  const adesso = Date.parse('2026-10-03T12:00:00Z');
  const q = (o) => quandoAggiornare({ testo: 'ciao', messaggiStudente: 1, ultimoPrimaIl: '2026-10-03T11:55:00Z', adessoMs: adesso, ...o });
  assert.equal(q({}).aggiorna, false);
  assert.deepEqual(q({ messaggiStudente: 3 }), { aggiorna: true, motivo: 'ogni_n' });
  assert.equal(q({ messaggiStudente: 6 }).aggiorna, true);
  assert.equal(q({ messaggiStudente: 4 }).aggiorna, false);
  assert.deepEqual(q({ testo: 'x'.repeat(121) }), { aggiorna: true, motivo: 'lungo' });
  // tornato dopo un'ora: la conversazione di prima è finita, se ne tira la somma
  assert.deepEqual(q({ ultimoPrimaIl: '2026-10-03T10:30:00Z' }), { aggiorna: true, motivo: 'fine_conversazione' });
  assert.equal(q({ ultimoPrimaIl: null }).aggiorna, false);
});

test('memoria: la richiesta all\'estrattore chiede errori, punti solidi e deboli, metodo, contesto umano, ordine', () => {
  const r = richiestaMemoria('Studente: ciao', [nota('1', 'contesto', 'Lavora la mattina')]);
  assert.equal(r.model, 'claude-haiku-4-5');
  assert.equal(r.tool_choice.name, 'memoria');
  for (const parola of ['Errore: ', 'Debole: ', 'Solido: ', 'metodo che ha funzionato', 'contesto umano', 'al massimo 20', 'fondi']) {
    assert.ok(r.system.includes(parola), `manca: ${parola}`);
  }
  assert.match(r.messages[0].content, /id=1 \[contesto\] \(importanza 2\) Lavora la mattina/);
});

test('memoria: le operazioni del modello passano dai controlli, le note vietate no', () => {
  const esistenti = [nota('1', 'obiettivi', 'Vuole dare Analisi 1 a gennaio'), nota('2', 'ostacoli', 'Si distrae col telefono')];
  const azioni = pianoMemoria(
    [
      { tipo: 'aggiungi', categoria: 'ostacoli', contenuto: 'Errore: nei limiti dimentica le condizioni di esistenza', importanza: 3 },
      { tipo: 'aggiungi', categoria: 'inventata', contenuto: 'x' },
      { tipo: 'aggiungi', categoria: 'contesto', contenuto: 'Va dallo psicologo il giovedì' },
      { tipo: 'aggiungi', categoria: 'contesto', contenuto: 'x'.repeat(301) },
      { tipo: 'aggiorna', id: '1', contenuto: 'Vuole dare Analisi 1 a febbraio' },
      { tipo: 'aggiorna', id: 'non-esiste', contenuto: 'zzz' },
      { tipo: 'archivia', id: '2' },
      { tipo: 'archivia', id: '2' },
    ],
    esistenti
  );
  assert.deepEqual(azioni.map((a) => a.tipo), ['inserisci', 'aggiorna', 'archivia']);
  const dopo = applicaAzioni(esistenti, azioni);
  assert.deepEqual(dopo.map((n) => n.contenuto).sort(), ['Errore: nei limiti dimentica le condizioni di esistenza', 'Vuole dare Analisi 1 a febbraio']);
  assert.ok(NOTE_VIETATE.test('Va dallo psicologo'));
  assert.ok(!NOTE_VIETATE.test('Studia Psicologia a Roma Tre'));
  assert.deepEqual(leggiOperazioni({ content: [{ type: 'tool_use', input: { operazioni: [{ tipo: 'archivia', id: '1' }] } }] }), [{ tipo: 'archivia', id: '1' }]);
  assert.deepEqual(leggiOperazioni({ content: [] }), []);
});

test('memoria: mai più di una ventina di note attive, si archiviano le meno importanti e le più vecchie', () => {
  const molte = Array.from({ length: 24 }, (_, i) =>
    nota(`n${i}`, 'metodo_studio', `nota ${i}`, i < 4 ? 1 : 2, `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
  );
  const azioni = pianoMemoria([{ tipo: 'aggiungi', categoria: 'contesto', contenuto: 'Lavora la mattina', importanza: 3 }], molte);
  const dopo = applicaAzioni(molte, azioni);
  assert.equal(dopo.length, MAX_NOTE_TENUTE);
  assert.ok(dopo.some((n) => n.contenuto === 'Lavora la mattina'), 'la nota nuova resta');
  // le archiviate sono le 5 meno importanti/più vecchie: le prime quattro (importanza 1) e la più vecchia delle altre
  const archiviate = azioni.filter((a) => a.tipo === 'archivia').map((a) => a.id).sort();
  assert.deepEqual(archiviate, ['n0', 'n1', 'n2', 'n3', 'n4']);
  // sotto il tetto non si archivia niente da soli
  assert.deepEqual(pianoMemoria([], molte.slice(0, 10)), []);
});

test('memoria: l\'estrattore riassume quando le note crescono (fonde con aggiorna + archivia)', () => {
  const diciotto = Array.from({ length: 18 }, (_, i) => nota(`n${i}`, 'ostacoli', `Si distrae col telefono (${i})`));
  const r = richiestaMemoria('Studente: ciao', diciotto);
  assert.match(r.messages[0].content, /\(18 attive\)/);
  const azioni = pianoMemoria(
    [{ tipo: 'aggiorna', id: 'n0', contenuto: 'Si distrae col telefono' }, ...Array.from({ length: 17 }, (_, i) => ({ tipo: 'archivia', id: `n${i + 1}` }))],
    diciotto
  );
  assert.deepEqual(applicaAzioni(diciotto, azioni).map((n) => n.contenuto), ['Si distrae col telefono']);
});
