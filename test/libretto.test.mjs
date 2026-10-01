// Lettura dei voti e deduplica del libretto. Solo logica pura, niente rete.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chiave,
  deduplica,
  leggiCfu,
  leggiData,
  leggiVoto,
  normalizza,
  unisci,
} from './_estraiLibretto.mjs';
import { calcolaLibretto, formattaVoto, sostenuto } from '../lib/libretto.ts';
import { nomiSimili, trovaSimili } from '../lib/somiglianzaEsami.ts';

const riga = (o = {}) => ({
  materia: 'Analisi Matematica I',
  esito: 'voto',
  voto: '',
  lode: false,
  cfu: '',
  data: '',
  ...o,
});

test('30 e lode: voto 30 con la lode a parte, mai un voto diverso da 30', () => {
  for (const scritto of ['30', '30L', '30 e lode', '30/30L']) {
    const e = normalizza(riga({ voto: scritto, lode: true }));
    assert.equal(e.voto, 30, scritto);
    assert.equal(e.lode, true, scritto);
  }
});

test('la lode vale solo sul 30', () => {
  assert.equal(normalizza(riga({ voto: '28', lode: true })).lode, false);
});

test('idoneità: superato senza voto, anche se il modello ne scrive uno', () => {
  const e = normalizza(riga({ esito: 'idoneita', voto: '27', cfu: '3' }));
  assert.equal(e.esito, 'idoneita');
  assert.equal(e.voto, null);
  assert.equal(e.lode, false);
  assert.equal(e.cfu, 3);
});

test('voto mancante o illeggibile resta vuoto: mai indovinato', () => {
  assert.equal(normalizza(riga({ voto: '' })).voto, null);
  assert.equal(normalizza(riga({ voto: '?' })).voto, null);
  assert.equal(leggiVoto('17'), null); // sotto il 18 non è un voto valido
  assert.equal(leggiVoto('31'), null);
  assert.equal(leggiVoto('2'), null);
});

test('esame senza esito: da sostenere, non un errore di lettura', () => {
  const e = normalizza(riga({ esito: 'nessun_esito', voto: '25' }));
  assert.equal(e.esito, 'nessun_esito');
  assert.equal(e.voto, null);
});

test('CFU e date: solo valori reali, altrimenti vuoto', () => {
  assert.equal(leggiCfu('9'), 9);
  assert.equal(leggiCfu('7,5'), null);
  assert.equal(leggiCfu(''), null);
  assert.equal(leggiData('5/2/2025'), '2025-02-05');
  assert.equal(leggiData('31/02/2025'), null);
  assert.equal(leggiData('boh'), null);
});

test('riga senza nome viene scartata', () => {
  assert.equal(normalizza(riga({ materia: '   ' })), null);
});

test('deduplica: nome identico dopo la normalizzazione si unisce', () => {
  const esami = deduplica([
    riga({ materia: 'Analisi Matematica I', voto: '27', cfu: '9' }),
    riga({ materia: 'ANALISI  MATEMATICA – I', voto: '27', data: '10/01/2025' }),
    riga({ materia: 'analisi matemàtica i.' }),
  ]);
  assert.equal(esami.length, 1);
  assert.deepEqual(
    { voto: esami[0].voto, cfu: esami[0].cfu, data: esami[0].data_esame },
    { voto: 27, cfu: 9, data: '2025-01-10' }
  );
});

test('deduplica: "Analisi Matematica I" e "II" NON si uniscono mai', () => {
  assert.notEqual(chiave('Analisi Matematica I'), chiave('Analisi Matematica II'));
  const esami = deduplica([
    riga({ materia: 'Analisi Matematica I', voto: '24', cfu: '9' }),
    riga({ materia: 'Analisi Matematica II', voto: '28', cfu: '9' }),
    riga({ materia: 'Analisi Matematica II', voto: '28' }),
  ]);
  assert.deepEqual(
    esami.map((e) => [e.materia, e.voto]),
    [
      ['Analisi Matematica I', 24],
      ['Analisi Matematica II', 28],
    ]
  );
});

test('deduplica: "I" e "1" restano due righe (si uniscono solo i nomi identici)', () => {
  const esami = deduplica([
    riga({ materia: 'Analisi Matematica I', voto: '24' }),
    riga({ materia: 'Analisi Matematica 1', voto: '24' }),
  ]);
  assert.equal(esami.length, 2);
});

test('unione: due valori diversi per lo stesso campo non si scelgono, il campo resta vuoto', () => {
  const a = normalizza(riga({ voto: '27', cfu: '9' }));
  const b = normalizza(riga({ voto: '28', cfu: '6' }));
  const u = unisci(a, b);
  assert.equal(u.esito, 'voto');
  assert.equal(u.voto, null);
  assert.equal(u.cfu, null);
});

test('unione: vince il risultato più forte (voto, poi idoneità, poi da sostenere)', () => {
  const daFare = normalizza(riga({ esito: 'nessun_esito', cfu: '9' }));
  const conVoto = normalizza(riga({ voto: '30', lode: true }));
  const u = unisci(daFare, conVoto);
  assert.deepEqual([u.esito, u.voto, u.lode, u.cfu], ['voto', 30, true, 9]);
});

test('segnalazione dei nomi simili: I/1 sì, I/II mai', () => {
  assert.equal(nomiSimili('Analisi Matematica I', 'Analisi Matematica 1'), true);
  assert.equal(nomiSimili('Analisi Matematica I', 'Analisi Matematica II'), false);
  assert.equal(nomiSimili('Analisi Matematica 1', 'Analisi Matematica 2'), false);
  assert.equal(nomiSimili('Programmazione', 'Programazione'), true);
  const simili = trovaSimili([
    { id: 1, materia: 'Analisi I' },
    { id: 2, materia: 'Analisi 1' },
    { id: 3, materia: 'Analisi II' },
  ]);
  assert.deepEqual([...simili.keys()].sort(), [1, 2]);
});

test('calcoli del libretto: la lode conta 30, la idoneità dà CFU ma non entra nella media', () => {
  const esami = [
    { voto: 30, lode: true, cfu: 9, idoneita: false },
    { voto: 24, lode: false, cfu: 6, idoneita: false },
    { voto: null, lode: false, cfu: 3, idoneita: true }, // idoneità
    { voto: null, lode: false, cfu: 12, idoneita: false }, // da sostenere
  ];
  const s = calcolaLibretto(esami);
  assert.equal(s.media, (30 * 9 + 24 * 6) / 15);
  assert.equal(s.cfuAcquisiti, 18);
  assert.equal(s.numeroLodi, 1);
  assert.equal(s.numeroSostenuti, 3);
  assert.equal(sostenuto(esami[2]), true);
  assert.equal(sostenuto(esami[3]), false);
  assert.equal(formattaVoto(esami[0]), '30 e lode');
  assert.equal(formattaVoto(esami[2]), 'idoneo');
  assert.equal(formattaVoto(esami[3]), 'da sostenere');
});
