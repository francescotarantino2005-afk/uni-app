// La macchina del dialogo: profilo, ripiego, note_libere, coda delle domande e
// reazioni del personaggio. Solo logica pura, niente rete.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHIAVI_DIALOGO,
  DOMANDE_FISSE,
  aggiornaCoda,
  chiusuraFissa,
  dopoTargetSuperato,
  profiloStudioCompleto,
  registraRisposta,
  senzaRisposta,
  valoreDiRipiego,
} from '../lib/dialogoLogica.ts';
import {
  daProporre,
  esameEntro48Ore,
  inAttesa,
  leggiCoda,
  segnaIgnorata,
  segnaProposta,
  segnaRisposta,
  testoProposta,
} from '../supabase/functions/coda-domande/logica.ts';
import {
  PAUSA_TRA_REAZIONI_MS,
  eEsameTarget,
  puoMostrare,
  reazioneNonSuperato,
  reazionePerEsame,
} from '../lib/reazioni.ts';

// --- profilo_studio e note_libere ---

test('le cinque domande sono cinque, in ordine fisso, una frase ciascuna', () => {
  assert.deepEqual(CHIAVI_DIALOGO, ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo']);
  assert.equal(DOMANDE_FISSE.length, 5);
  for (const d of DOMANDE_FISSE) {
    assert.equal((d.match(/[.!?]/g) ?? []).length, 1, d);
    assert.ok(d.endsWith('?'), d);
  }
});

test('profilo vuoto: la forma è sempre completa', () => {
  const p = profiloStudioCompleto({});
  assert.deepEqual(p, {
    esame_target: { nome: null, id: null },
    quando: { testo: null, data: null },
    avanzamento: null,
    tempo_al_giorno: { testo: null, minuti: null },
    ostacolo: null,
    note_libere: [],
  });
});

test('note_libere si riempie SEMPRE, anche quando il valore strutturato manca', () => {
  let p = profiloStudioCompleto({});
  p = registraRisposta(p, 1, 'Qual è il primo esame?', 'boh', null);
  assert.equal(p.note_libere.length, 1);
  assert.equal(p.note_libere[0].risposta, 'boh');
  assert.equal(p.note_libere[0].domanda, 'Qual è il primo esame?');
  assert.ok(!Number.isNaN(Date.parse(p.note_libere[0].il)));
  assert.equal(p.esame_target.nome, null);

  p = registraRisposta(p, 1, 'Intendi Analisi?', 'sì', { nome: 'Analisi Matematica II', id: 'x' });
  assert.equal(p.note_libere.length, 2);
  assert.deepEqual(p.esame_target, { nome: 'Analisi Matematica II', id: 'x' });
});

test('un valore null non cancella quello raccolto prima (chiarimento)', () => {
  let p = profiloStudioCompleto({});
  p = registraRisposta(p, 2, 'Quando?', 'a gennaio', { testo: 'a gennaio', data: null });
  p = registraRisposta(p, 2, 'Che giorno?', 'boh', null);
  assert.equal(p.quando.testo, 'a gennaio');
  assert.equal(p.note_libere.length, 2);
});

// --- ripiego (la function non risponde) ---

test('ripiego: le non-risposte non diventano dati', () => {
  for (const r of ['boh', 'Boh!', 'non lo so', 'mah', '', '   ', '?']) {
    for (const n of [1, 2, 3, 4, 5]) assert.equal(valoreDiRipiego(n, r), null, `${n}: "${r}"`);
  }
});

test('ripiego: esame target e avanzamento non si deducono mai dal testo grezzo', () => {
  assert.equal(valoreDiRipiego(1, 'non lo so, sono messo male'), null);
  assert.equal(valoreDiRipiego(1, 'Analisi Matematica II'), null);
  assert.equal(valoreDiRipiego(3, 'sono a metà'), null);
});

test('ripiego: dove il campo è testo si tengono le parole dello studente, senza numeri inventati', () => {
  assert.deepEqual(valoreDiRipiego(2, 'a gennaio credo'), { testo: 'a gennaio credo', data: null });
  assert.deepEqual(valoreDiRipiego(4, 'due ore'), { testo: 'due ore', minuti: null });
  assert.equal(valoreDiRipiego(5, 'mi distraggo'), 'mi distraggo');
});

test('la chiusura fissa nomina il target solo se esiste', () => {
  assert.ok(chiusuraFissa('Fisica Generale I').includes('Fisica Generale I'));
  assert.ok(!chiusuraFissa(null).includes('null'));
});

// --- la coda che si riempie nel dialogo ---

test('domanda senza risposta: finisce in coda come "da_fare", una volta sola', () => {
  const p = profiloStudioCompleto({});
  let coda = aggiornaCoda([], p, 1);
  coda = aggiornaCoda(coda, p, 1);
  assert.equal(coda.length, 1);
  assert.deepEqual(
    { id: coda[0].id, chiave: coda[0].chiave, stato: coda[0].stato, priorita: coda[0].priorita },
    { id: 'accoglienza:esame_target', chiave: 'esame_target', stato: 'da_fare', priorita: 1 }
  );
  assert.equal(coda[0].testo, DOMANDE_FISSE[0]);
});

test('domanda con risposta: non entra in coda, e se c\'era ne esce', () => {
  let p = profiloStudioCompleto({});
  const coda = aggiornaCoda([], p, 3);
  assert.equal(coda.length, 1);
  p = registraRisposta(p, 3, 'A che punto sei?', 'a metà', 'a_meta');
  assert.equal(senzaRisposta(p, 'avanzamento'), false);
  assert.deepEqual(aggiornaCoda(coda, p, 3), []);
});

test('risposta vaga ma presente (solo testo) non va in coda', () => {
  let p = profiloStudioCompleto({});
  p = registraRisposta(p, 2, 'Quando?', 'a gennaio credo', { testo: 'a gennaio credo', data: null });
  assert.deepEqual(aggiornaCoda([], p, 2), []);
});

test('esame target superato: target azzerato e "qual è il prossimo?" primo in coda', () => {
  const p = registraRisposta(profiloStudioCompleto({}), 1, 'D', 'analisi', { nome: 'Analisi', id: 'a' });
  const vecchia = [{ id: 'accoglienza:esame_target', testo: 'x', chiave: 'esame_target', stato: 'fatta', priorita: 1 }];
  const dopo = dopoTargetSuperato(p, vecchia);
  assert.deepEqual(dopo.profilo_studio.esame_target, { nome: null, id: null });
  assert.equal(dopo.profilo_studio.note_libere.length, 1); // le note restano
  assert.equal(dopo.domande_in_coda.length, 1);
  assert.equal(dopo.domande_in_coda[0].stato, 'da_fare');
});

// --- la coda che si svuota in chat ---

const domanda = (o = {}) => ({ id: 'a', testo: 'Quando lo devi dare?', chiave: 'quando', stato: 'da_fare', priorita: 2, ...o });
const OGGI = '2026-10-02';

test('coda: propone la domanda con priorità più bassa, una alla volta', () => {
  const coda = [domanda({ id: 'b', priorita: 4 }), domanda({ id: 'a', priorita: 2 })];
  assert.equal(daProporre(coda, OGGI, false).id, 'a');
  assert.equal(daProporre([], OGGI, false), null);
});

test('coda: mai più di una domanda al giorno', () => {
  const coda = [domanda({ id: 'a', stato: 'fatta', proposta_il: OGGI }), domanda({ id: 'b', priorita: 4 })];
  assert.equal(daProporre(coda, OGGI, false), null);
  assert.equal(daProporre(coda, '2026-10-03', false).id, 'b');
});

test('coda: mai due domande di fila (una ancora in attesa blocca le altre)', () => {
  const coda = segnaProposta([domanda({ id: 'a' }), domanda({ id: 'b', priorita: 4 })], 'a', '2026-09-30');
  assert.equal(inAttesa(coda).id, 'a');
  assert.equal(daProporre(coda, OGGI, false), null);
});

test('coda: mai una domanda di contorno con un esame entro 48 ore', () => {
  assert.equal(esameEntro48Ore(['2026-10-02'], OGGI), true);
  assert.equal(esameEntro48Ore(['2026-10-04'], OGGI), true);
  assert.equal(esameEntro48Ore(['2026-10-05'], OGGI), false);
  assert.equal(esameEntro48Ore(['2026-10-01', null], OGGI), false); // passato o senza data
  assert.equal(daProporre([domanda()], OGGI, true), null);
});

test('coda: quando risponde la domanda passa a "fatta" e non torna', () => {
  let coda = segnaProposta([domanda()], 'a', OGGI);
  coda = segnaRisposta(coda, 'a');
  assert.equal(coda[0].stato, 'fatta');
  assert.equal(inAttesa(coda), null);
  assert.equal(daProporre(coda, '2026-10-09', false), null);
});

test('coda: ignorata due volte passa a "saltata" e non torna più', () => {
  let coda = segnaProposta([domanda()], 'a', OGGI);
  coda = segnaIgnorata(coda, 'a');
  assert.equal(coda[0].stato, 'da_fare');
  assert.equal(coda[0].ignorata, 1);
  assert.equal(daProporre(coda, OGGI, false), null); // già proposta oggi
  assert.equal(daProporre(coda, '2026-10-03', false).id, 'a');

  coda = segnaIgnorata(segnaProposta(coda, 'a', '2026-10-03'), 'a');
  assert.equal(coda[0].stato, 'saltata');
  assert.equal(daProporre(coda, '2026-10-20', false), null);
});

test('coda: dati sporchi nella colonna vengono scartati', () => {
  assert.deepEqual(leggiCoda(null), []);
  assert.deepEqual(leggiCoda({}), []);
  assert.equal(leggiCoda([domanda(), { id: 1 }, 'x', null]).length, 1);
});

test('coda: la battuta di proposta è una domanda sola', () => {
  const t = testoProposta(domanda({ testo: 'Qual è il primo esame che devi dare?' }));
  assert.equal((t.match(/\?/g) ?? []).length, 1);
  assert.ok(t.includes('qual è il primo esame'));
});

// --- reazioni del personaggio ---

const esito = (o = {}) => ({ materia: 'Fisica', voto: 25, lode: false, giaSuperato: false, eraTarget: false, ...o });

test('reazioni: solo l\'elenco chiuso (28+, 30, 30 e lode, 20 o meno, target)', () => {
  assert.equal(reazionePerEsame(esito({ voto: 25 })), null);
  assert.equal(reazionePerEsame(esito({ voto: 21 })), null);
  assert.equal(reazionePerEsame(esito({ voto: 27 })), null);
  assert.equal(reazionePerEsame(esito({ voto: 28 })).posa, 'esulta');
  assert.equal(reazionePerEsame(esito({ voto: 29 })).posa, 'esulta');
  assert.equal(reazionePerEsame(esito({ voto: 30 })).posa, 'esultaMax');
  assert.equal(reazionePerEsame(esito({ voto: 30, lode: true })).posa, 'esultaMax');
  assert.equal(reazionePerEsame(esito({ voto: 20 })).posa, 'vicino');
  assert.equal(reazionePerEsame(esito({ voto: 18 })).posa, 'vicino');
  assert.equal(reazionePerEsame(esito({ voto: null })), null); // idoneità non target
});

test('reazioni: una sola per evento, il target superato vince e chiede il prossimo', () => {
  const r = reazionePerEsame(esito({ voto: 30, lode: true, eraTarget: true, materia: 'Analisi II' }));
  assert.equal(r.posa, 'esulta');
  assert.equal(r.versoChat, true);
  assert.ok(r.battuta.includes('Analisi II') && r.battuta.includes('prossimo'));
});

test('reazioni: correggere un esame già superato non è un evento', () => {
  assert.equal(reazionePerEsame(esito({ voto: 30, giaSuperato: true })), null);
});

test('reazioni: la vicinanza non è tristezza', () => {
  const testi = [reazionePerEsame(esito({ voto: 18 })).battuta, reazioneNonSuperato().battuta];
  for (const t of testi) assert.ok(!/piang|dispera|trist|peccato|mi dispiace/i.test(t), t);
  assert.equal(reazioneNonSuperato().posa, 'vicino');
});

test('freno: mai due popup di fila', () => {
  assert.equal(puoMostrare({ visibile: false, chiusaAlle: null }, 1000), true);
  assert.equal(puoMostrare({ visibile: true, chiusaAlle: null }, 1000), false);
  assert.equal(puoMostrare({ visibile: false, chiusaAlle: 1000 }, 1000 + PAUSA_TRA_REAZIONI_MS - 1), false);
  assert.equal(puoMostrare({ visibile: false, chiusaAlle: 1000 }, 1000 + PAUSA_TRA_REAZIONI_MS), true);
});

test('esame target: riconosciuto per id, o per nome se manca', () => {
  assert.equal(eEsameTarget({ nome: 'Analisi', id: 'a' }, { id: 'a', materia: 'Altro nome' }), true);
  assert.equal(eEsameTarget({ nome: 'Analisi', id: 'a' }, { id: 'b', materia: 'Analisi' }), false);
  assert.equal(eEsameTarget({ nome: 'Chimica Organica', id: null }, { id: 'z', materia: 'chimica  organica' }), true);
  assert.equal(eEsameTarget({ nome: null, id: null }, { id: 'z', materia: 'x' }), false);
  assert.equal(eEsameTarget(undefined, { id: 'z', materia: 'x' }), false);
});
