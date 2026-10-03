// Il dialogo di accoglienza, la coda delle domande e le reazioni del personaggio.
// Solo logica pura, niente rete: le conversazioni registrate usano le risposte del
// modello REGISTRATE in test/fixtures/dialoghi.json (2 ottobre 2026) e le fanno
// passare dalla stessa logica che gira nella Edge Function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHIAVI,
  CHIUSURA_GARBATA,
  DOMANDE_FISSE,
  MAX_DOMANDE,
  MAX_FRASI,
  SALTATA,
  allineaCoda,
  GIORNI_URGENZA,
  chiesteDalleNote,
  conversazioneDalleNote,
  correggiNomi,
  giorniAllEsame,
  impegnoDiLode,
  impegnoDiRipiego,
  inDifficolta,
  nomeEsameCorretto,
  richiestaRiprova,
  costruisciContesto,
  dueNonRisposte,
  elaboraTurno,
  frasi,
  haRisposta,
  mancanti,
  nonRisposta,
  profiloCompleto,
  prossimaChiave,
  senzaAvvio,
  turnoDiRipiego,
  turnoSaltato,
} from '../supabase/functions/accoglienza-dialogo/logica.ts';
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

const REGISTRATE = JSON.parse(readFileSync(new URL('./fixtures/dialoghi.json', import.meta.url), 'utf8'));
const APERTURA = 'Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?';

/** Rigioca una conversazione registrata, un messaggio alla volta, fermandosi quando il bot chiude. */
function rigioca(nome) {
  const c = REGISTRATE[nome];
  let profilo = profiloCompleto({});
  let chieste = ['esame_target'];
  let conversazione = [{ ruolo: 'assistant', contenuto: APERTURA }];
  const turni = [];
  for (const t of c.turni) {
    conversazione = [...conversazione, { ruolo: 'user', contenuto: t.studente }];
    const input = { nomeBot: 'Lode', oggi: c.oggi, conversazione, profilo, chieste, esami: c.esami, libretto: c.libretto };
    let esito = elaboraTurno(input, t.grezzo);
    // come in servizio.ts: chiusura senza impegno di Lode -> la seconda risposta registrata
    if (esito.fine && esito.impegno_ripiego && t.grezzo_riprova && impegnoDiLode(t.grezzo_riprova.impegno)) {
      esito = elaboraTurno(input, { ...t.grezzo, impegno: t.grezzo_riprova.impegno });
    }
    turni.push({ studente: t.studente, chiesta: chieste[chieste.length - 1], esito, riprova: !!t.grezzo_riprova });
    profilo = esito.profilo;
    chieste = esito.chieste;
    conversazione = [...conversazione, { ruolo: 'assistant', contenuto: esito.risposta_bot }];
    if (esito.fine) break;
  }
  return { turni, profilo, chieste, ultimo: turni[turni.length - 1].esito };
}

/** Le regole che valgono per OGNI conversazione. */
function regoleGenerali(r) {
  assert.equal(new Set(r.chieste).size, r.chieste.length, 'una chiave chiesta due volte');
  assert.ok(r.chieste.length <= MAX_DOMANDE, 'più di cinque domande');
  assert.equal(r.ultimo.fine, true, 'il dialogo non si è chiuso');
  for (const t of r.turni) {
    const b = t.esito.risposta_bot;
    assert.ok(frasi(b).length <= MAX_FRASI, `più di tre frasi: ${b}`);
    assert.ok(!/\bsegnato\b/i.test(b), `ricevuta: ${b}`);
    assert.ok((b.match(/\?/g) ?? []).length <= 1, `più di una domanda: ${b}`);
    assert.ok(!/^(va bene|ok|okay|d'accordo|certo|allora)\b[\s,.!:;]/i.test(b), `comincia con una formula: ${b}`);
    if (t.esito.prossima_chiave) {
      assert.ok(!haRisposta(t.esito.profilo, t.esito.prossima_chiave), 'chiede una cosa già detta');
    }
  }
  // OGNI chiusura contiene un impegno di Lode, salvato "da_mantenere", e senza domande
  const fine = r.ultimo;
  const impegno = fine.profilo.impegno;
  assert.ok(impegno, 'la chiusura non ha salvato un impegno');
  assert.equal(impegno.stato, 'da_mantenere');
  assert.ok(impegnoDiLode(impegno.testo), `non è un'azione di Lode: ${impegno.testo}`);
  assert.ok(fine.risposta_bot.includes(impegno.testo), 'l\'impegno salvato è quello detto allo studente');
  assert.ok(!fine.risposta_bot.includes('?'), `la chiusura fa una domanda: ${fine.risposta_bot}`);
  // il consiglio, se c'è, viene DOPO l'impegno: prima dell'impegno c'è solo la reazione
  const prima = frasi(fine.risposta_bot.slice(0, fine.risposta_bot.indexOf(impegno.testo)));
  assert.ok(prima.every((f) => !impegnoDiLode(f)));
}

// ---------- le conversazioni registrate ----------

test('conversazione reale (Tolc I): non richiede ciò che ha già detto, e l\'aiuto vince sul questionario', () => {
  const r = rigioca('reale');
  regoleGenerali(r);
  const [uno, due] = r.turni;

  // messaggio 1: dice l'esame E la data → non si chiede "quando"
  assert.equal(uno.esito.profilo.esame_target.nome, 'Tolc I');
  assert.ok(haRisposta(uno.esito.profilo, 'quando'));
  assert.notEqual(uno.esito.prossima_chiave, 'quando');
  // la data è già passata: non viene registrata come data, e il bot lo fa notare
  assert.equal(uno.esito.profilo.quando.data, null);
  assert.equal(uno.esito.profilo.quando.testo, 'il 14 settembre');
  assert.match(uno.esito.risposta_bot, /passat/i);

  // messaggio 2: chiede aiuto → si chiude con un impegno, niente "a che punto sei"
  assert.equal(r.turni.length, 2, 'il dialogo doveva chiudersi al secondo messaggio');
  assert.equal(due.esito.aiuto, true);
  assert.equal(due.esito.fine, true);
  assert.equal(due.esito.prossima_chiave, null);
  assert.ok(!due.esito.risposta_bot.includes('?'), 'dopo la richiesta di aiuto non si fanno domande');
  assert.match(due.esito.risposta_bot, /monomi|polinomi|equazioni|disequazioni/i);
  // l'impegno è sull'argomento da cui ha detto di voler ripartire
  assert.match(r.profilo.impegno.testo, /monomi|polinomi|prodotti notevoli|equazioni/i);
  // quello che ha detto sull'avanzamento resta, con le sue parole
  assert.ok(haRisposta(r.profilo, 'avanzamento'));
  assert.match(r.profilo.avanzamento.testo, /indietro/);
  // ciò che manca va in coda, ciò che ha detto no
  const coda = allineaCoda([], r.profilo, true).map((d) => d.chiave);
  assert.ok(!coda.includes('avanzamento') && !coda.includes('quando') && !coda.includes('esame_target'));
});

test('studente che dice tutto nel primo messaggio: il dialogo si chiude dopo un turno', () => {
  const r = rigioca('tutto_subito');
  regoleGenerali(r);
  assert.equal(r.turni.length, 1);
  assert.deepEqual(mancanti(r.profilo), []);
  assert.equal(r.profilo.esame_target.nome, 'Basi di Dati');
  assert.ok(r.profilo.esame_target.id, 'esame agganciato al libretto');
  assert.equal(r.profilo.quando.data, '2027-02-12');
  assert.equal(r.profilo.avanzamento.livello, 'a_meta');
  assert.equal(r.profilo.tempo_al_giorno.minuti, 120);
  assert.match(r.profilo.ostacolo, /rimando/);
  assert.match(r.profilo.contesto, /lavoro in un bar/);
  assert.deepEqual(allineaCoda([], r.profilo, true), []);
  assert.deepEqual(r.chieste, ['esame_target']);
  // anche senza richiesta di aiuto la chiusura è un impegno, non un consiglio
  assert.equal(r.ultimo.aiuto, false);
  assert.match(r.profilo.impegno.testo, /^Ti (preparo|scrivo|faccio)/);
});

test('studente a monosillabi: una risposta corta conta, una non-risposta no, e nessuna domanda si ripete', () => {
  const r = rigioca('monosillabi');
  regoleGenerali(r);
  assert.equal(r.profilo.esame_target.nome, 'Fisica Generale I'); // "fisica"
  assert.equal(r.profilo.avanzamento.testo, 'poco'); // vago ma è una risposta
  assert.equal(r.profilo.avanzamento.livello, null); // e non si inventa un livello
  assert.equal(haRisposta(r.profilo, 'quando'), false); // "boh"
  assert.equal(haRisposta(r.profilo, 'tempo_al_giorno'), false); // "mah"
  assert.equal(haRisposta(r.profilo, 'ostacolo'), false); // "no"
  assert.deepEqual(r.chieste, [...CHIAVI]);
  assert.deepEqual(
    allineaCoda([], r.profilo, true).map((d) => d.chiave),
    ['quando', 'tempo_al_giorno', 'ostacolo']
  );
});

test('studente fuori tema: non si inventa niente, non si chiede "quando" di un esame ignoto', () => {
  const r = rigioca('fuori_tema');
  regoleGenerali(r);
  assert.deepEqual(mancanti(r.profilo), [...CHIAVI]);
  assert.equal(r.profilo.contesto, null);
  assert.ok(!r.chieste.includes('quando') && !r.chieste.includes('avanzamento'));
  assert.ok(!/ora so da dove partire/i.test(r.ultimo.risposta_bot), 'non finge di sapere');
  assert.equal(allineaCoda([], r.profilo, true).length, 5);
  // il modello aveva chiuso senza impegno: la seconda richiesta l'ha scritto
  assert.equal(r.turni[r.turni.length - 1].riprova, true);
});

test('studente che non vuole rispondere: dopo due non-risposte di fila il dialogo chiude con garbo', () => {
  const r = rigioca('non_risponde');
  regoleGenerali(r);
  // "fisica", "boh", "mah": al secondo vuoto di fila si chiude, senza arrivare a cinque domande
  assert.equal(r.turni.length, 3);
  assert.deepEqual(r.chieste, ['esame_target', 'quando', 'avanzamento']);
  assert.equal(r.ultimo.fine, true);
  assert.equal(r.ultimo.aiuto, false);
  assert.equal(r.ultimo.prossima_chiave, null);
  assert.ok(!r.ultimo.risposta_bot.includes('?'), 'chiude senza altre domande');
  assert.ok(r.ultimo.risposta_bot.startsWith(CHIUSURA_GARBATA));
  assert.equal(frasi(r.ultimo.risposta_bot).length, 2); // la frase gentile e l'impegno
  assert.ok(!/non (hai|mi hai) risposto|peccato|come vuoi/i.test(r.ultimo.risposta_bot), 'nessun rimprovero');
  // quello che ha detto resta, e le chiavi mancanti vanno tutte in coda
  assert.equal(r.profilo.esame_target.nome, 'Fisica Generale I');
  assert.deepEqual(
    allineaCoda([], r.profilo, true).map((d) => d.chiave),
    ['quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo']
  );
  // anche chi non risponde riceve un impegno: c'è sempre qualcosa da cui partire
  assert.match(r.profilo.impegno.testo, /Fisica Generale I/);
});

test('PROVA DI STANOTTE (Tolc I tra una settimana, "sono messo male"): si chiude subito con un impegno di Lode', () => {
  const r = rigioca('urgenza');
  regoleGenerali(r);
  const [uno, due] = r.turni;
  // il nome si scrive bene, nel profilo e nella battuta, anche se lo studente scrive "tolc i"
  assert.equal(uno.esito.profilo.esame_target.nome, 'Tolc I');
  assert.match(uno.esito.risposta_bot, /Tolc I/);
  assert.ok(!/tolc i/.test(uno.esito.risposta_bot), 'nome scritto male nella battuta');
  assert.equal(uno.esito.fine, false); // senza difficoltà dichiarata si continua
  // "sono messo male" con l'esame tra una settimana: niente più domande
  assert.equal(r.turni.length, 2, 'il dialogo doveva chiudersi al secondo messaggio');
  assert.equal(due.esito.urgente, true);
  assert.equal(due.esito.aiuto, false);
  assert.equal(due.esito.prossima_chiave, null);
  assert.deepEqual(r.chieste, ['esame_target', 'avanzamento']);
  // l'impegno è un'azione di Lode sul Tolc I, non "un primo giro serio col telefono fuori dalla stanza"
  assert.match(r.profilo.impegno.testo, /Tolc I/);
  assert.match(r.profilo.impegno.testo, /^Ti (preparo|scrivo|faccio)/);
  assert.ok(!/telefono fuori/.test(r.profilo.impegno.testo));
  // tempo e ostacolo non chiesti vanno in coda
  assert.deepEqual(
    allineaCoda([], r.profilo, true).map((d) => d.chiave),
    ['tempo_al_giorno', 'ostacolo']
  );
});

// ---------- le regole, una per una ----------

const GREZZO_VUOTO = {
  reazione: '', chiede_aiuto: false, impegno: '', prossima_chiave: 'nessuna', domanda_successiva: '', chiusura: '',
  esame_testo: '', esame_nome: '', esame_indice: 0, quando_testo: '', quando_data: '',
  avanzamento_testo: '', avanzamento_livello: 'sconosciuto', tempo_testo: '', tempo_minuti: 0,
  ostacolo_testo: '', contesto_testo: '', giorni_all_esame: -1, in_difficolta: false,
};
const turno = (messaggio, grezzo = {}, extra = {}) => ({
  input: {
    nomeBot: 'Lode',
    oggi: '2026-10-02',
    conversazione: [
      { ruolo: 'assistant', contenuto: APERTURA },
      { ruolo: 'user', contenuto: messaggio },
    ],
    profilo: profiloCompleto({}),
    chieste: ['esame_target'],
    esami: [],
    libretto: { media: null, cfu: 0 },
    ...extra,
  },
  grezzo: { ...GREZZO_VUOTO, ...grezzo },
});
const esegui = (t) => elaboraTurno(t.input, t.grezzo);

test('le domande: cinque chiavi in ordine fisso, una frase ciascuna', () => {
  assert.deepEqual([...CHIAVI], ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo']);
  for (const k of CHIAVI) {
    assert.equal(frasi(DOMANDE_FISSE[k]).length, 1);
    assert.ok(DOMANDE_FISSE[k].endsWith('?'));
  }
});

test('profilo: forma sempre completa, e la forma vecchia non perde niente', () => {
  assert.deepEqual(profiloCompleto({}), {
    esame_target: { testo: null, nome: null, id: null },
    quando: { testo: null, data: null },
    avanzamento: { testo: null, livello: null },
    tempo_al_giorno: { testo: null, minuti: null },
    ostacolo: null,
    contesto: null,
    note_libere: [],
  });
  const vecchio = profiloCompleto({ esame_target: { nome: 'Analisi', id: 'a' }, avanzamento: 'a_meta', ostacolo: 'rimando' });
  assert.equal(vecchio.esame_target.testo, 'Analisi');
  assert.equal(vecchio.avanzamento.livello, 'a_meta');
  assert.deepEqual(mancanti(vecchio), ['quando', 'tempo_al_giorno']);
});

test('una chiave conta come risposta appena c\'è il testo: null vuol dire solo "non ne ha parlato"', () => {
  const p = profiloCompleto({ avanzamento: { testo: 'sono arrivato alle equazioni di 1 grado', livello: null } });
  assert.equal(haRisposta(p, 'avanzamento'), true);
  assert.ok(!mancanti(p).includes('avanzamento'));
});

test('da una risposta si estraggono tutte le chiavi che contiene, non solo quella chiesta', () => {
  const e = esegui(
    turno('ho analisi il 20 gennaio e lavoro la mattina', {
      esame_testo: 'ho analisi', esame_nome: 'analisi',
      quando_testo: 'il 20 gennaio', quando_data: '2027-01-20',
      contesto_testo: 'lavoro la mattina',
      reazione: 'Con il lavoro la mattina il pomeriggio diventa prezioso.',
      prossima_chiave: 'avanzamento', domanda_successiva: 'A che punto sei con analisi?',
    })
  );
  assert.equal(e.profilo.esame_target.nome, 'Analisi'); // scritto bene
  assert.deepEqual(e.profilo.quando, { testo: 'il 20 gennaio', data: '2027-01-20' });
  assert.equal(e.profilo.contesto, 'lavoro la mattina');
  assert.equal(e.prossima_chiave, 'avanzamento'); // "quando" non si chiede: l'ha già detto
  assert.equal(e.profilo.note_libere.length, 1);
  assert.equal(e.profilo.note_libere[0].risposta, 'ho analisi il 20 gennaio e lavoro la mattina');
  assert.equal(e.profilo.note_libere[0].chiave, 'esame_target');
});

test('la prossima domanda la sceglie il codice: se il modello ne propone una già detta, vince il codice', () => {
  const e = esegui(
    turno('ho analisi il 20 gennaio', {
      esame_testo: 'ho analisi', esame_nome: 'analisi', quando_testo: 'il 20 gennaio', quando_data: '2027-01-20',
      reazione: 'Analisi a gennaio, allora.',
      prossima_chiave: 'quando', domanda_successiva: 'E per quando pensi di arrivare preparato?',
    })
  );
  assert.equal(e.prossima_chiave, 'avanzamento');
  assert.ok(e.risposta_bot.endsWith(DOMANDE_FISSE.avanzamento));
  assert.ok(!/per quando/i.test(e.risposta_bot));
});

test('una chiave già chiesta non si richiede, nemmeno se è rimasta vuota', () => {
  const p = profiloCompleto({ esame_target: { testo: 'fisica', nome: 'fisica', id: null } });
  assert.equal(prossimaChiave(p, ['esame_target', 'quando']), 'avanzamento');
  assert.equal(prossimaChiave(p, ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo']), null);
  assert.equal(prossimaChiave(profiloCompleto({}), ['esame_target']), 'tempo_al_giorno'); // senza esame niente "quando"
});

test('quando non manca niente il dialogo finisce, anche dopo un messaggio', () => {
  const pieno = profiloCompleto({
    esame_target: { testo: 'a', nome: 'a', id: null }, quando: { testo: 'b', data: null },
    avanzamento: { testo: 'c', livello: null }, tempo_al_giorno: { testo: 'd', minuti: null }, ostacolo: 'e',
  });
  assert.equal(prossimaChiave(pieno, ['esame_target']), null);
});

test('le citazioni devono essere parole dello studente: ciò che non ha detto non entra nel profilo', () => {
  const e = esegui(
    turno('devo dare fisica', {
      esame_testo: 'devo dare fisica', esame_nome: 'fisica',
      quando_testo: 'a febbraio', quando_data: '2027-02-10', // mai detto
      ostacolo_testo: 'si distrae facilmente', // mai detto
      contesto_testo: 'lavora', // mai detto
      reazione: 'Fisica, allora.',
    })
  );
  assert.equal(e.profilo.esame_target.nome, 'Fisica');
  assert.equal(haRisposta(e.profilo, 'quando'), false);
  assert.equal(e.profilo.ostacolo, null);
  assert.equal(e.profilo.contesto, null);
});

test('"boh" e "non so" non sono risposte, nemmeno se il modello le cita', () => {
  const e = esegui(turno('non so', { esame_testo: 'non so', reazione: 'Nessun problema.' }));
  assert.equal(haRisposta(e.profilo, 'esame_target'), false);
  assert.equal(e.profilo.note_libere.length, 1); // la nota grezza resta comunque
});

test('una data già passata non viene registrata, e il bot lo fa notare anche se il modello non lo fa', () => {
  const e = esegui(
    turno('ho il Tolc il 14 settembre', {
      esame_testo: 'ho il Tolc', esame_nome: 'Tolc', quando_testo: 'il 14 settembre', quando_data: '2026-09-14',
      reazione: 'Il Tolc, quindi.', prossima_chiave: 'avanzamento', domanda_successiva: 'A che punto sei?',
    })
  );
  assert.deepEqual(e.profilo.quando, { testo: 'il 14 settembre', data: null });
  assert.match(e.risposta_bot, /14 settembre però è già passato/);
  assert.ok(frasi(e.risposta_bot).length <= MAX_FRASI);
});

test('mai più di tre frasi, mai una ricevuta, mai una domanda nella reazione', () => {
  const e = esegui(
    turno('devo dare fisica', {
      esame_testo: 'devo dare fisica', esame_nome: 'fisica',
      reazione: 'Ok, segnato. Fisica è tosta. Si fa con gli esercizi. Serve costanza. Ce la fai?',
      prossima_chiave: 'quando', domanda_successiva: 'Quando la devi dare?',
    })
  );
  assert.equal(frasi(e.risposta_bot).length, 3);
  assert.ok(!/segnato/i.test(e.risposta_bot));
  assert.equal((e.risposta_bot.match(/\?/g) ?? []).length, 1);

  const soloRicevuta = esegui(
    turno('devo dare fisica', {
      esame_testo: 'devo dare fisica', esame_nome: 'fisica', reazione: 'Ok, segnato.',
      prossima_chiave: 'quando', domanda_successiva: 'Quando la devi dare?',
    })
  );
  assert.equal(soloRicevuta.risposta_bot, 'Quando la devi dare?');
});

test('richiesta di aiuto: si chiude con un impegno, senza domande, e ciò che manca va in coda', () => {
  const e = esegui(
    turno('devo dare analisi, mi aiuti con le disequazioni?', {
      esame_testo: 'devo dare analisi', esame_nome: 'analisi', chiede_aiuto: true,
      reazione: 'Le disequazioni sono un buon punto da cui ripartire.',
      impegno: 'Ti preparo cinque disequazioni di primo grado, dalla più semplice.',
      prossima_chiave: 'quando', domanda_successiva: 'Quando la devi dare?',
    })
  );
  assert.equal(e.aiuto, true);
  assert.equal(e.fine, true);
  assert.ok(!e.risposta_bot.includes('?'));
  assert.match(e.risposta_bot, /Ti preparo cinque disequazioni/);
  assert.deepEqual(
    allineaCoda([], e.profilo, true).map((d) => d.chiave),
    ['quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo']
  );
});

test('non-risposte: "boh", "mah", "no" e la stringa vuota; una risposta corta non lo è', () => {
  for (const t of ['boh', 'Boh.', 'mah', 'no', 'No!', 'non so', '', '   ', '...', undefined]) {
    assert.equal(nonRisposta(t), true, String(t));
  }
  for (const t of ['poco', 'fisica', 'a gennaio', 'no, lavoro tutto il giorno', 'non so se riesco a darlo a febbraio']) {
    assert.equal(nonRisposta(t), false, t);
  }
});

test('due non-risposte DI FILA chiudono; una sola, o due separate da una risposta, no', () => {
  const conv = (...sue) => [
    { ruolo: 'assistant', contenuto: APERTURA },
    ...sue.flatMap((c) => [{ ruolo: 'user', contenuto: c }, { ruolo: 'assistant', contenuto: 'x?' }]).slice(0, -1),
  ];
  assert.equal(dueNonRisposte(conv('boh')), false);
  assert.equal(dueNonRisposte(conv('boh', 'mah')), true);
  assert.equal(dueNonRisposte(conv('fisica', 'boh', 'no')), true);
  assert.equal(dueNonRisposte(conv('boh', 'poco', 'mah')), false);
  assert.equal(dueNonRisposte(conv('boh', 'fisica')), false);
  // il modello viene avvisato, così la chiusura la scrive lui
  const t = turno('mah', {}, { conversazione: conv('boh', 'mah') });
  assert.match(costruisciContesto(t.input), /<due_non_risposte_di_fila>sì<\/due_non_risposte_di_fila>/);
  assert.match(costruisciContesto(turno('boh').input), /<due_non_risposte_di_fila>no<\/due_non_risposte_di_fila>/);
});

test('due non-risposte di fila: niente altra domanda nemmeno se il modello la propone, e la chiusura c\'è sempre', () => {
  const conversazione = [
    { ruolo: 'assistant', contenuto: APERTURA },
    { ruolo: 'user', contenuto: 'boh' },
    { ruolo: 'assistant', contenuto: DOMANDE_FISSE.tempo_al_giorno },
    { ruolo: 'user', contenuto: 'no' },
  ];
  const extra = { conversazione, chieste: ['esame_target', 'tempo_al_giorno'] };
  // il modello insiste: vince il codice, con la chiusura fissa
  const insiste = esegui(turno('no', { reazione: 'Un no ci sta.', prossima_chiave: 'ostacolo', domanda_successiva: 'Cosa ti blocca?' }, extra));
  assert.equal(insiste.fine, true);
  assert.equal(insiste.prossima_chiave, null);
  assert.equal(insiste.risposta_bot, `${CHIUSURA_GARBATA} ${impegnoDiRipiego(null)}`);
  assert.equal(insiste.impegno_ripiego, true);
  assert.deepEqual(insiste.chieste, ['esame_target', 'tempo_al_giorno']);
  assert.equal(allineaCoda([], insiste.profilo, true).length, 5);
  // il modello chiude lui con un impegno: frase gentile e il suo impegno, senza reazione al "no"
  const chiude = esegui(turno('no', { reazione: 'Un no ci sta.', impegno: 'Ti preparo subito in chat un piano per questa settimana.' }, extra));
  assert.equal(chiude.risposta_bot, `${CHIUSURA_GARBATA} Ti preparo subito in chat un piano per questa settimana.`);
  // anche il ripiego (modello assente) chiude invece di fare la terza domanda, con l'impegno fisso
  const ripiego = turnoDiRipiego(turno('no', {}, extra).input);
  assert.equal(ripiego.fine, true);
  assert.equal(ripiego.risposta_bot, `${CHIUSURA_GARBATA} ${impegnoDiRipiego(null)}`);
  assert.equal(ripiego.profilo.impegno.stato, 'da_mantenere');
  // la richiesta di aiuto vince comunque
  const aiuto = esegui(turno('no', { chiede_aiuto: true, impegno: 'Ti preparo un esercizio sulle frazioni.' }, extra));
  assert.equal(aiuto.aiuto, true);
});

test('nessuna battuta comincia con "Va bene," o un\'altra formula di avvio', () => {
  assert.equal(senzaAvvio('Va bene, la data non è chiara.'), 'La data non è chiara.');
  assert.equal(senzaAvvio('Ok. Allora, fisica è tosta.'), 'Fisica è tosta.');
  assert.equal(senzaAvvio('Bene così non va.'), 'Bene così non va.'); // senza virgola non è una formula
  assert.equal(senzaAvvio('Certo che lavorare e studiare pesa.'), 'Certo che lavorare e studiare pesa.');
  const e = esegui(
    turno('devo dare fisica', {
      esame_testo: 'devo dare fisica', esame_nome: 'fisica',
      reazione: 'Va bene, fisica si prepara con gli esercizi.',
      prossima_chiave: 'quando', domanda_successiva: 'Quando la devi dare?',
    })
  );
  assert.equal(e.risposta_bot, 'Fisica si prepara con gli esercizi. Quando la devi dare?');
});

test('richiesta di aiuto: l\'impegno detto allo studente viene salvato nel profilo, "da_mantenere"', () => {
  const e = esegui(
    turno('devo dare analisi, mi aiuti con le disequazioni?', {
      esame_testo: 'devo dare analisi', esame_nome: 'analisi', chiede_aiuto: true,
      reazione: 'Le disequazioni sono un buon punto da cui ripartire.',
      impegno: 'Ti preparo cinque disequazioni di primo grado, dalla più semplice.',
    })
  );
  assert.equal(e.profilo.impegno.testo, 'Ti preparo cinque disequazioni di primo grado, dalla più semplice.');
  assert.equal(e.profilo.impegno.stato, 'da_mantenere');
  assert.ok(!Number.isNaN(Date.parse(e.profilo.impegno.il)));
  // finché il dialogo non si chiude non nasce nessun impegno
  const senza = esegui(turno('devo dare fisica', { esame_testo: 'devo dare fisica', esame_nome: 'fisica', reazione: 'Fisica, allora.', prossima_chiave: 'quando', domanda_successiva: 'Quando la devi dare?' }));
  assert.equal(senza.fine, false);
  assert.ok(!('impegno' in senza.profilo));
});

test('ogni chiusura ha un impegno di Lode: un consiglio non basta, e il consiglio va dopo l\'impegno', () => {
  const pieno = { esame_target: { testo: 'Tolc I', nome: 'Tolc I', id: null } };
  const chiusura = (grezzo) =>
    esegui(turno('il telefono i pensieri', grezzo, { profilo: profiloCompleto(pieno), chieste: ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo'] }));
  // il modello scrive solo un consiglio (la prova di stanotte): niente impegno valido -> ripiego, e la function riprova
  const consiglio = chiusura({
    reazione: 'Telefono e pensieri sono i due nemici.',
    impegno: 'Si parte da domani: un primo giro serio sul Tolc I, a blocchi brevi, col telefono fuori dalla stanza.',
  });
  assert.equal(consiglio.fine, true);
  assert.equal(consiglio.impegno_ripiego, true);
  assert.equal(consiglio.profilo.impegno.testo, impegnoDiRipiego('Tolc I'));
  assert.ok(consiglio.risposta_bot.endsWith(impegnoDiRipiego('Tolc I')));
  // impegno + consiglio: l'impegno prima, il consiglio dopo
  const buono = chiusura({
    reazione: 'Telefono e pensieri sono i due nemici.',
    impegno: 'Ti preparo subito in chat una mini-simulazione del Tolc I da 15 domande.',
    chiusura: 'Quando la fai, metti il telefono in un\'altra stanza.',
  });
  assert.equal(buono.impegno_ripiego, false);
  assert.equal(
    buono.risposta_bot,
    'Telefono e pensieri sono i due nemici. Ti preparo subito in chat una mini-simulazione del Tolc I da 15 domande. Quando la fai, metti il telefono in un\'altra stanza.'
  );
  // la seconda richiesta al modello dice cosa non andava e chiede l'impegno
  const t = turno('x', {}, { profilo: profiloCompleto(pieno) });
  const r = richiestaRiprova(t.input, { ...GREZZO_VUOTO, impegno: 'Studia a blocchi brevi.' });
  assert.match(r.messages[0].content, /<riprova>[\s\S]*Studia a blocchi brevi[\s\S]*OBBLIGATORIO/);
  assert.equal(r.model, 'claude-sonnet-5-5');
});

test('impegno di Lode: un\'azione che fa Lode, non un consiglio né una promessa vaga', () => {
  for (const t of [
    'Ti preparo subito in chat una mini-simulazione del Tolc I da 15 domande, per capire da dove partire.',
    'Partiamo da monomi e polinomi: ti preparo una serie di esercizi graduali.',
    'Ti scrivo il piano dei prossimi sette giorni, un blocco al giorno.',
    'Domani ti faccio trovare cinque esercizi sulle derivate.',
  ]) assert.equal(impegnoDiLode(t), true, t);
  for (const t of [
    'Si parte da domani: un primo giro serio sul Tolc I, a blocchi brevi, col telefono fuori dalla stanza.',
    'Ripartiamo da monomi e polinomi e da lì ti seguo passo passo.',
    'Ti aiuto a organizzare il ripasso.',
    'Partiamo da lì: ti aspetto in chat e cominciamo subito.',
    'Ti preparo qualcosa?',
    '',
  ]) assert.equal(impegnoDiLode(t), false, t);
  assert.match(impegnoDiRipiego('Tolc I'), /^Ti preparo .*Tolc I/);
  assert.ok(impegnoDiLode(impegnoDiRipiego('Tolc I')) && impegnoDiLode(impegnoDiRipiego(null)));
});

test('urgenza: esame entro 14 giorni + difficoltà dichiarata chiudono subito; da sole no', () => {
  const conv = (...sue) => [
    { ruolo: 'assistant', contenuto: APERTURA },
    ...sue.flatMap((c) => [{ ruolo: 'user', contenuto: c }, { ruolo: 'assistant', contenuto: 'x?' }]).slice(0, -1),
  ];
  assert.equal(GIORNI_URGENZA, 14);
  for (const t of ['sono messo male', 'sono indietro con tutto', 'non ce la faccio', 'Sono messa male', 'non ho studiato niente'])
    assert.equal(inDifficolta(conv(t)), true, t);
  for (const t of ['poco', 'a metà', 'tra una settimana', 'no'])
    assert.equal(inDifficolta(conv(t)), false, t);
  // giorni: dalla data certa se c'è, altrimenti dalla stima del modello
  const conData = profiloCompleto({ quando: { testo: 'il 10 ottobre', data: '2026-10-10' } });
  assert.equal(giorniAllEsame(conData, '2026-10-03', -1), 7);
  assert.equal(giorniAllEsame(profiloCompleto({}), '2026-10-03', 7), 7);
  assert.equal(giorniAllEsame(profiloCompleto({}), '2026-10-03', -1), null);

  const tolc = { esame_target: { testo: 'il tolc i', nome: 'Tolc I', id: null }, quando: { testo: 'tra una settimana circa', data: null } };
  const caso = (messaggi, grezzo) =>
    esegui(turno(messaggi[messaggi.length - 1], { reazione: 'Ok.', prossima_chiave: 'tempo_al_giorno', domanda_successiva: 'Quanto tempo hai?', ...grezzo }, {
      conversazione: conv(...messaggi), profilo: profiloCompleto(tolc), chieste: ['esame_target', 'avanzamento'], oggi: '2026-10-03',
    }));
  // tra 7 giorni + "sono messo male": chiude, anche se il modello vuole un'altra domanda
  const urgente = caso(['devo dare il tolc i tra una settimana circa', 'sono messo male'], { avanzamento_testo: 'sono messo male', giorni_all_esame: 7 });
  assert.equal(urgente.urgente, true);
  assert.equal(urgente.fine, true);
  assert.ok(urgente.profilo.impegno);
  // tra 30 giorni: si continua a chiedere
  assert.equal(caso(['il tolc i tra un mese', 'sono messo male'], { avanzamento_testo: 'sono messo male', giorni_all_esame: 30 }).fine, false);
  // tra 7 giorni ma nessuna difficoltà: si continua
  assert.equal(caso(['il tolc i tra una settimana circa', 'sono a metà'], { avanzamento_testo: 'sono a metà', giorni_all_esame: 7 }).fine, false);
  // senza data e senza stima: si continua
  assert.equal(caso(['il tolc i', 'sono messo male'], { avanzamento_testo: 'sono messo male', giorni_all_esame: -1 }).fine, false);
});

test('i nomi degli esami si scrivono bene, nel profilo e nelle battute', () => {
  assert.equal(nomeEsameCorretto('tolc i'), 'Tolc I');
  assert.equal(nomeEsameCorretto('basi di dati'), 'Basi di Dati');
  assert.equal(nomeEsameCorretto('fisica generale ii'), 'Fisica Generale II');
  assert.equal(nomeEsameCorretto('analisi 2'), 'Analisi 2');
  assert.equal(nomeEsameCorretto('Analisi Matematica'), 'Analisi Matematica'); // già scritto bene: resta
  assert.equal(nomeEsameCorretto('TOLC-I'), 'TOLC-I');
  assert.equal(correggiNomi('Il tolc i è vicino, e il TOLC I pure.', ['Tolc I']), 'Il Tolc I è vicino, e il Tolc I pure.');
  assert.equal(correggiNomi('Lo stoltolc ignoto resta.', ['Tolc I']), 'Lo stoltolc ignoto resta.'); // solo parole intere
  const e = esegui(
    turno('devo sostenere il tolc i tra una settimana circa', {
      esame_testo: 'devo sostenere il tolc i', esame_nome: 'tolc i',
      quando_testo: 'tra una settimana circa', giorni_all_esame: 7,
      reazione: 'Il tolc i tra una settimana circa è dietro l\'angolo.',
      prossima_chiave: 'avanzamento', domanda_successiva: 'A che punto sei con la preparazione per il tolc i?',
    })
  );
  assert.equal(e.profilo.esame_target.nome, 'Tolc I');
  assert.equal(e.profilo.esame_target.testo, 'devo sostenere il tolc i'); // le sue parole restano sue
  assert.equal(e.risposta_bot, 'Il Tolc I tra una settimana circa è dietro l\'angolo. A che punto sei con la preparazione per il Tolc I?');
});

test('un esame dell\'elenco che lo studente non ha scelto non viene nominato', () => {
  const e = esegui(
    turno('boh', { reazione: 'Allora puntiamo su Prova Finale.', prossima_chiave: 'tempo_al_giorno', domanda_successiva: 'Quanto tempo hai?' }, {
      esami: [{ id: 'x', materia: 'Prova Finale' }],
    })
  );
  assert.ok(!e.risposta_bot.includes('Prova Finale'));
});

test('ripiego (il modello non risponde): niente ricevute, le parole dello studente valgono per la sola domanda fatta', () => {
  const t = turno('mi sento indietro, non mi sento in grado', {}, {
    profilo: profiloCompleto({ esame_target: { testo: 'Tolc I', nome: 'Tolc I', id: null }, quando: { testo: 'il 14 settembre', data: null } }),
    chieste: ['esame_target', 'avanzamento'],
  });
  const e = turnoDiRipiego(t.input);
  assert.equal(e.profilo.avanzamento.testo, 'mi sento indietro, non mi sento in grado');
  assert.equal(e.prossima_chiave, 'tempo_al_giorno');
  assert.equal(e.risposta_bot, DOMANDE_FISSE.tempo_al_giorno);
  assert.ok(!/segnato/i.test(e.risposta_bot));
  assert.equal(turnoDiRipiego(turno('boh').input).profilo.esame_target.testo, null);
});

test('domanda saltata: resta vuota, non si richiede, e a fine dialogo va in coda', () => {
  const p = profiloCompleto({ esame_target: { testo: 'fisica', nome: 'fisica', id: null } });
  const e = turnoSaltato(p, ['esame_target', 'quando']);
  assert.equal(e.prossima_chiave, 'avanzamento');
  assert.ok(!e.chieste.slice(0, -1).includes('avanzamento'));
  assert.equal(haRisposta(e.profilo, 'quando'), false);
});

test('"Salta questa domanda" conta come non-risposta: due salti di fila chiudono il dialogo con garbo', () => {
  const p = profiloCompleto({ esame_target: { testo: 'fisica', nome: 'fisica', id: null } });
  // primo salto: resta nelle note, si passa alla domanda dopo
  const uno = turnoSaltato(p, ['esame_target', 'quando'], 'Quando lo devi dare?');
  assert.equal(uno.fine, false);
  assert.equal(uno.prossima_chiave, 'avanzamento');
  assert.deepEqual(uno.profilo.note_libere.map((n) => [n.domanda, n.risposta, n.chiave]), [
    ['Quando lo devi dare?', SALTATA, 'quando'],
  ]);
  assert.equal(nonRisposta(SALTATA), true);
  // secondo salto di fila: si chiude, senza altre domande
  const due = turnoSaltato(uno.profilo, uno.chieste, 'A che punto sei?');
  assert.equal(due.fine, true);
  assert.equal(due.prossima_chiave, null);
  assert.equal(due.risposta_bot, `${CHIUSURA_GARBATA} ${impegnoDiRipiego('fisica')}`);
  assert.equal(due.profilo.impegno.stato, 'da_mantenere');
  assert.deepEqual(due.chieste, ['esame_target', 'quando', 'avanzamento']);
  // le chiavi saltate vanno in coda, quella detta no
  assert.deepEqual(
    allineaCoda([], due.profilo, true).map((d) => d.chiave),
    ['quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo']
  );
  // un salto dopo una risposta vera non chiude
  const dopoRisposta = esegui(turno('devo dare fisica', { esame_testo: 'devo dare fisica', esame_nome: 'fisica', reazione: 'Fisica, allora.' }));
  assert.equal(turnoSaltato(dopoRisposta.profilo, dopoRisposta.chieste, 'x?').fine, false);
});

test('il salto conta anche per la function: salto + "boh" (o "boh" + salto) chiudono', () => {
  // "boh" e poi salto: lo decide turnoSaltato, dalle note
  const boh = esegui(turno('boh', { reazione: 'Nessun problema.', prossima_chiave: 'tempo_al_giorno', domanda_successiva: 'Quanto tempo hai?' }));
  assert.equal(boh.fine, false);
  const poiSalto = turnoSaltato(boh.profilo, boh.chieste, 'Quanto tempo hai?');
  assert.equal(poiSalto.fine, true);
  assert.ok(poiSalto.risposta_bot.startsWith(CHIUSURA_GARBATA));
  assert.ok(poiSalto.profilo.impegno);

  // salto e poi "boh": la conversazione ricostruita dalle note porta il salto alla function
  const salto = turnoSaltato(profiloCompleto({}), ['esame_target'], APERTURA);
  const conversazione = [
    ...conversazioneDalleNote(salto.profilo),
    { ruolo: 'assistant', contenuto: salto.risposta_bot },
    { ruolo: 'user', contenuto: 'boh' },
  ];
  assert.deepEqual(conversazione.filter((m) => m.ruolo === 'user').map((m) => m.contenuto), [SALTATA, 'boh']);
  assert.equal(dueNonRisposte(conversazione), true);
  const t = turno('boh', { reazione: 'Ci sta.', prossima_chiave: 'ostacolo', domanda_successiva: 'Cosa ti blocca?' }, {
    conversazione, profilo: salto.profilo, chieste: salto.chieste,
  });
  assert.match(costruisciContesto(t.input), /<due_non_risposte_di_fila>sì</);
  const e = esegui(t);
  assert.equal(e.fine, true);
  assert.equal(e.risposta_bot, `${CHIUSURA_GARBATA} ${impegnoDiRipiego(null)}`);
  // il salto non entra mai nel profilo come risposta
  assert.equal(haRisposta(e.profilo, 'esame_target'), false);
  // e alla ripresa di un dialogo interrotto la domanda saltata non si richiede
  assert.deepEqual(chiesteDalleNote(salto.profilo), ['esame_target']);
});

test('ripresa di un dialogo interrotto: chiavi chieste e conversazione si ricostruiscono dalle note', () => {
  const e = esegui(turno('devo dare fisica', { esame_testo: 'devo dare fisica', esame_nome: 'fisica', reazione: 'Fisica, allora.' }));
  assert.deepEqual(chiesteDalleNote(e.profilo), ['esame_target']);
  assert.deepEqual(conversazioneDalleNote(e.profilo), [
    { ruolo: 'assistant', contenuto: APERTURA },
    { ruolo: 'user', contenuto: 'devo dare fisica' },
  ]);
});

test('l\'impegno di ripiego nomina il target solo se c\'è, e non finge di sapere', () => {
  assert.ok(impegnoDiRipiego('Fisica Generale I').includes('Fisica Generale I'));
  assert.ok(!/simulazione di/.test(impegnoDiRipiego(null)));
});

// ---------- la coda ----------

const domanda = (o = {}) => ({ id: 'a', testo: 'Quando lo devi dare?', chiave: 'quando', stato: 'da_fare', priorita: 2, ...o });
const OGGI = '2026-10-02';

test('IL DIFETTO DI STAMATTINA: una chiave già risposta non si ripropone, e in coda passa a "fatta"', () => {
  const profilo = profiloCompleto({
    avanzamento: { testo: 'mi sento indietro, sono arrivato a ripetere le equazioni di 1 grado', livello: null },
  });
  const coda = [domanda({ id: 'accoglienza:avanzamento', chiave: 'avanzamento', testo: 'A che punto sei con la preparazione?', priorita: 3 })];
  const allineata = allineaCoda(coda, profilo, false);
  assert.equal(allineata[0].stato, 'fatta');
  assert.equal(daProporre(leggiCoda(allineata), OGGI, false), null);
});

test('a dialogo finito le chiavi vuote entrano in coda una volta sola, quelle piene no', () => {
  const p = profiloCompleto({ esame_target: { testo: 'fisica', nome: 'fisica', id: null } });
  let coda = allineaCoda([], p, true);
  coda = allineaCoda(coda, p, true);
  assert.deepEqual(coda.map((d) => [d.id, d.stato, d.priorita]), [
    ['accoglienza:quando', 'da_fare', 2],
    ['accoglienza:avanzamento', 'da_fare', 3],
    ['accoglienza:tempo_al_giorno', 'da_fare', 4],
    ['accoglienza:ostacolo', 'da_fare', 5],
  ]);
  // una domanda "saltata" non rientra
  const conSaltata = allineaCoda([domanda({ id: 'accoglienza:quando', stato: 'saltata' })], p, true);
  assert.equal(conSaltata.filter((d) => d.chiave === 'quando').length, 1);
  assert.equal(conSaltata.find((d) => d.chiave === 'quando').stato, 'saltata');
});

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
  assert.equal(esameEntro48Ore(['2026-10-01', null], OGGI), false);
  assert.equal(daProporre([domanda()], OGGI, true), null);
});

test('coda: quando risponde passa a "fatta"; ignorata due volte passa a "saltata" e non torna', () => {
  let coda = segnaRisposta(segnaProposta([domanda()], 'a', OGGI), 'a');
  assert.equal(coda[0].stato, 'fatta');
  assert.equal(daProporre(coda, '2026-10-09', false), null);

  coda = segnaIgnorata(segnaProposta([domanda()], 'a', OGGI), 'a');
  assert.equal(coda[0].stato, 'da_fare');
  assert.equal(daProporre(coda, '2026-10-03', false).id, 'a');
  coda = segnaIgnorata(segnaProposta(coda, 'a', '2026-10-03'), 'a');
  assert.equal(coda[0].stato, 'saltata');
  assert.equal(daProporre(coda, '2026-10-20', false), null);
});

test('coda: la battuta di proposta è una domanda sola e non dice "non te l\'ho mai chiesto"', () => {
  const t = testoProposta(domanda({ testo: 'A che punto sei con la preparazione?' }));
  assert.equal((t.match(/\?/g) ?? []).length, 1);
  assert.ok(!/non ti ho ancora chiesto/i.test(t));
  assert.deepEqual(leggiCoda([domanda(), { id: 1 }, 'x', null]).length, 1);
});

// ---------- reazioni del personaggio ----------

const esito = (o = {}) => ({ materia: 'Fisica', voto: 25, lode: false, giaSuperato: false, eraTarget: false, ...o });

test('reazioni: solo l\'elenco chiuso (28+, 30, 30 e lode, 20 o meno, target)', () => {
  assert.equal(reazionePerEsame(esito({ voto: 25 })), null);
  assert.equal(reazionePerEsame(esito({ voto: 27 })), null);
  assert.equal(reazionePerEsame(esito({ voto: 28 })).posa, 'esulta');
  assert.equal(reazionePerEsame(esito({ voto: 30 })).posa, 'esultaMax');
  assert.equal(reazionePerEsame(esito({ voto: 30, lode: true })).posa, 'esultaMax');
  assert.equal(reazionePerEsame(esito({ voto: 20 })).posa, 'vicino');
  assert.equal(reazionePerEsame(esito({ voto: null })), null);
});

test('reazioni: una sola per evento, il target superato vince e chiede il prossimo', () => {
  const r = reazionePerEsame(esito({ voto: 30, lode: true, eraTarget: true, materia: 'Analisi II' }));
  assert.equal(r.posa, 'esulta');
  assert.equal(r.versoChat, true);
  assert.ok(r.battuta.includes('Analisi II') && r.battuta.includes('prossimo'));
  assert.equal(reazionePerEsame(esito({ voto: 30, giaSuperato: true })), null);
});

test('reazioni: la vicinanza non è tristezza, e mai due popup di fila', () => {
  for (const t of [reazionePerEsame(esito({ voto: 18 })).battuta, reazioneNonSuperato().battuta]) {
    assert.ok(!/piang|dispera|trist|peccato|mi dispiace/i.test(t), t);
  }
  assert.equal(puoMostrare({ visibile: false, chiusaAlle: null }, 1000), true);
  assert.equal(puoMostrare({ visibile: true, chiusaAlle: null }, 1000), false);
  assert.equal(puoMostrare({ visibile: false, chiusaAlle: 1000 }, 1000 + PAUSA_TRA_REAZIONI_MS - 1), false);
});

test('esame target: riconosciuto per id, o per nome se manca', () => {
  assert.equal(eEsameTarget({ nome: 'Analisi', id: 'a' }, { id: 'a', materia: 'Altro nome' }), true);
  assert.equal(eEsameTarget({ nome: 'Analisi', id: 'a' }, { id: 'b', materia: 'Analisi' }), false);
  assert.equal(eEsameTarget({ nome: 'Chimica Organica', id: null }, { id: 'z', materia: 'chimica  organica' }), true);
  assert.equal(eEsameTarget(undefined, { id: 'z', materia: 'x' }), false);
});
