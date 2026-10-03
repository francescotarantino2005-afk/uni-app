// La chat: la promessa di fine accoglienza va mantenuta. Solo logica pura,
// niente rete: il caso Tolc usa le risposte del modello REGISTRATE in
// test/fixtures/chat.json (2 ottobre 2026) e le fa passare dalla stessa logica
// che gira nelle Edge Functions accoglienza-dialogo e chat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allineaCoda,
  elaboraTurno,
  impegnoDiLode,
  leggiImpegno,
  profiloCompleto,
} from '../supabase/functions/accoglienza-dialogo/logica.ts';
import {
  MODELLO_CHAT,
  TENTATIVO_VALE_MS,
  TURNO_APERTURA,
  conImpegno,
  costoUSD,
  impegnoDaMantenere,
  istruzioneImpegno,
  messaggiModello,
  richiestaChat,
  righeAccoglienza,
  testoRisposta,
} from '../supabase/functions/chat/logica.ts';
import { daMostrare, impegnoFermaCoda } from '../supabase/functions/coda-domande/logica.ts';
import {
  ATTESA_MASSIMA_MS,
  PASSO_CONTROLLO_MS,
  conMessaggio,
  faseAttesa,
  impegnoInSospeso,
  testoAttesa,
} from '../lib/impegnoAttesa.ts';

const TOLC = JSON.parse(readFileSync(new URL('./fixtures/chat.json', import.meta.url), 'utf8')).tolc;
const APERTURA = 'Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?';

/** Il dialogo del Tolc, rigiocato con le risposte registrate del modello. */
function dialogoTolc() {
  let profilo = profiloCompleto({});
  let chieste = ['esame_target'];
  let conversazione = [{ ruolo: 'assistant', contenuto: APERTURA }];
  let esito = null;
  for (const t of TOLC.dialogo) {
    conversazione = [...conversazione, { ruolo: 'user', contenuto: t.studente }];
    const input = { nomeBot: 'Lode', oggi: TOLC.oggi, conversazione, profilo, chieste, esami: [], libretto: { media: null, cfu: 0 } };
    esito = elaboraTurno(input, t.grezzo);
    if (esito.fine && esito.impegno_ripiego && t.grezzo_riprova && impegnoDiLode(t.grezzo_riprova.impegno)) {
      esito = elaboraTurno(input, { ...t.grezzo, impegno: t.grezzo_riprova.impegno });
    }
    profilo = esito.profilo;
    chieste = esito.chieste;
    conversazione = [...conversazione, { ruolo: 'assistant', contenuto: esito.risposta_bot }];
  }
  return { esito, profilo, conversazione };
}

/** Le righe "1) ...", "2) ..." di un messaggio: gli esercizi scritti per esteso. */
function esercizi(testo) {
  return testo
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => /^\d+\)\s+\S/.test(r));
}
/** Un esercizio vero ha dentro dell'algebra, non solo parole. */
const conAlgebra = (riga) => /[0-9]*[a-z](\^\d)?\s*[+\-*/)(]|\(.*[a-z].*\)/i.test(riga.replace(/^\d+\)\s+/, ''));

// ---------- il caso Tolc, dall'inizio alla fine ----------

test('caso Tolc: il dialogo chiude con un impegno, e l\'impegno resta nel profilo "da_mantenere"', () => {
  const { esito, profilo } = dialogoTolc();
  assert.equal(esito.aiuto, true);
  assert.equal(esito.fine, true);
  const impegno = leggiImpegno(profilo);
  assert.ok(impegno, 'l\'impegno non è stato salvato');
  assert.equal(impegno.stato, 'da_mantenere');
  assert.ok(esito.risposta_bot.includes(impegno.testo), 'l\'impegno salvato è la promessa detta allo studente');
  assert.match(impegno.testo, /monomi|polinomi|prodotti notevoli/i);
  assert.ok(impegnoDiLode(impegno.testo), 'è un\'azione che fa Lode');
  // non si perde quando il profilo viene riletto o riscritto
  assert.deepEqual(leggiImpegno(profiloCompleto(JSON.parse(JSON.stringify(profilo)))), impegno);
  // e non entra in coda come domanda
  assert.ok(allineaCoda([], profilo, true).every((d) => d.chiave !== 'impegno'));
});

test('caso Tolc: la richiesta alla chat obbliga a mantenere la promessa, con il livello dichiarato nei dati', () => {
  const { profilo, conversazione } = dialogoTolc();
  const impegno = leggiImpegno(profilo);
  const dati = { testo: righeAccoglienza(profilo).join('\n'), senzaVoti: true };
  const r = richiestaChat(dati, [], conversazione, TURNO_APERTURA, istruzioneImpegno(impegno.testo, false));

  assert.equal(r.model, MODELLO_CHAT);
  assert.equal(r.model, 'claude-sonnet-5-5');
  // parte stabile in cache (istruzioni + dati dello studente), istruzione del momento fuori
  assert.equal(r.system.length, 3);
  assert.deepEqual(r.system[0].cache_control, { type: 'ephemeral' });
  assert.deepEqual(r.system[1].cache_control, { type: 'ephemeral' });
  assert.equal(r.system[2].cache_control, undefined);
  assert.ok(r.system[2].text.includes(impegno.testo));
  assert.match(r.system[2].text, /esercizi veri/);
  // il livello dichiarato dallo studente arriva al modello con le sue parole
  assert.match(r.system[1].text, /indietro con la matematica/);
  assert.match(r.system[1].text, /Tolc I/);
  // la conversazione parte da un messaggio dello studente e finisce con l'apertura della chat
  assert.equal(r.messages[0].role, 'user');
  assert.equal(r.messages[r.messages.length - 1].content, TURNO_APERTURA);
  assert.equal(r.messages[r.messages.length - 2].role, 'assistant'); // la battuta di chiusura
});

test('caso Tolc: il PRIMO messaggio della chat contiene esercizi veri, coerenti con la promessa e col livello', () => {
  const { profilo } = dialogoTolc();
  const m = TOLC.primo_messaggio;
  const righe = esercizi(m);
  const promessi = Number(leggiImpegno(profilo).testo.match(/\b(\d+) esercizi/)?.[1] ?? 0);
  // se la promessa dice un numero, ci sono esattamente quelli; altrimenti da tre a cinque
  if (promessi) assert.equal(righe.length, promessi, `promessi ${promessi} esercizi, trovati ${righe.length}`);
  else assert.ok(righe.length >= 3 && righe.length <= 5, `servono da tre a cinque esercizi, trovati ${righe.length}`);
  for (const r of righe) assert.ok(conAlgebra(r), `non è un esercizio: ${r}`);
  // coerenti con la promessa: prodotti notevoli = quadrati, cubi e prodotti di binomi
  assert.match(leggiImpegno(profilo).testo, /prodotti notevoli/i);
  for (const r of righe) assert.match(r, /\([^)]*[+-][^)]*\)(\^\d|\s*\()/, `non è un prodotto notevole: ${r}`);
  // coerenti col livello ("partendo dalle basi"): si parte dal quadrato di un binomio semplice
  assert.match(righe[0], /^1\)\s*\(\w \+ \d\)\^2$/);
  // niente soluzioni insieme agli esercizi, e niente "sei pronto?"
  for (const r of righe) assert.ok(!r.includes('='), `soluzione insieme all'esercizio: ${r}`);
  assert.ok(!/sei pronto|vuoi (che )?(cominci|inizi)|iniziamo\?/i.test(m), 'annuncia invece di cominciare');
  assert.ok(!m.includes('?'), 'il primo messaggio non rimanda con una domanda');
  // testo semplice: niente markdown
  assert.ok(!/\*\*|^#|^[-*] /m.test(m));
});

test('caso Tolc: sull\'errore spiega il passaggio sbagliato, non dà solo la soluzione giusta', () => {
  const c = TOLC.correzione;
  assert.equal(TOLC.risposta_sbagliata, 'il primo fa x^2 + 9');
  assert.match(c, /x\^2 \+ 6x \+ 9/, 'il risultato giusto c\'è');
  assert.match(c, /x\^2 \+ 9/, 'riprende il risultato dello studente');
  // dice qual è il passaggio rotto: il doppio prodotto perso
  assert.match(c, /doppio prodotto/i, 'nomina il passaggio sbagliato');
  assert.match(c, /2 \* x \* 3|2 · x · 3|2·x·3/, 'mostra il passaggio fatto bene');
  // spiega la regola, e fa riprovare
  assert.match(c, /\(a \+ b\)\^2 = a\^2 \+ 2ab \+ b\^2/);
  assert.ok(c.replace(/\s+/g, ' ').length > 'Il risultato giusto è x^2 + 6x + 9.'.length * 4, 'è solo la soluzione');
  assert.match(c, /rifa|riprova|gemello/i);
});

// ---------- l'impegno: una volta sola, e non si perde ----------

const IMPEGNO = { testo: 'Partiamo da monomi e polinomi.', stato: 'da_mantenere', il: '2026-10-02T17:00:00.000Z' };
const ADESSO = Date.parse('2026-10-02T17:00:10.000Z');

test('impegno: va mantenuto se è "da_mantenere" e nessun tentativo è in corso', () => {
  assert.equal(impegnoDaMantenere(IMPEGNO, ADESSO), true);
  assert.equal(impegnoDaMantenere(null, ADESSO), false);
  // un tentativo appena partito blocca i doppioni...
  const inCorso = { ...IMPEGNO, tentativo_il: new Date(ADESSO - 5_000).toISOString() };
  assert.equal(impegnoDaMantenere(inCorso, ADESSO), false);
  // ...ma se è rimasto appeso (function morta a metà) non blocca per sempre
  const appeso = { ...IMPEGNO, tentativo_il: new Date(ADESSO - TENTATIVO_VALE_MS - 1).toISOString() };
  assert.equal(impegnoDaMantenere(appeso, ADESSO), true);
});

test('impegno: una volta "mantenuto" non si mantiene più', () => {
  const fatto = { ...IMPEGNO, stato: 'mantenuto', mantenuto_il: '2026-10-02T17:00:08.000Z', messaggio_id: 'x' };
  assert.equal(impegnoDaMantenere(fatto, ADESSO), false);
  assert.equal(impegnoDaMantenere(fatto, ADESSO + 10 * 24 * 3600 * 1000), false);
});

test('impegno: se la generazione fallisce resta "da_mantenere" e lo mantiene la risposta al primo messaggio', () => {
  // fallimento = il tentativo viene liberato, lo stato non cambia
  const dopoFallimento = { ...IMPEGNO, tentativo_il: null };
  assert.equal(impegnoDaMantenere(dopoFallimento, ADESSO), true);
  const r = richiestaChat({ testo: 'x', senzaVoti: true }, [], [], 'ciao, ci sei?', istruzioneImpegno(IMPEGNO.testo, true));
  assert.match(r.system[2].text, /Rispondi a quello che ha appena scritto e, nello stesso messaggio, mantienila/);
  assert.equal(r.messages[r.messages.length - 1].content, 'ciao, ci sei?');
});

test('impegno: scriverlo nel profilo non tocca il resto, e un profilo riscritto dall\'app vecchia lo riottiene', () => {
  const profilo = { esame_target: { testo: 'Tolc I', nome: 'Tolc I', id: null }, ostacolo: 'x' };
  const con = conImpegno(profilo, IMPEGNO);
  assert.deepEqual(con.esame_target, profilo.esame_target);
  assert.deepEqual(leggiImpegno(con), { ...IMPEGNO, tentativo_il: null, mantenuto_il: null, messaggio_id: null });
  // l'app già installata salva il profilo senza la chiave: leggiImpegno dà null e il server la rimette
  assert.equal(leggiImpegno(profilo), null);
  assert.equal(leggiImpegno({ impegno: { testo: '', stato: 'da_mantenere' } }), null);
  assert.equal(leggiImpegno({ impegno: { testo: 'x', stato: 'boh' } }), null);
  // un profilo senza impegno resta senza la chiave (la forma non cambia)
  assert.ok(!('impegno' in profiloCompleto({})));
});

test('impegno e coda: prima la promessa, e nel giorno in cui è mantenuta nessuna domanda di contorno', () => {
  const giorno = (iso) => iso.slice(0, 10);
  assert.equal(impegnoFermaCoda(null, '2026-10-02', giorno), false);
  assert.equal(impegnoFermaCoda({ stato: 'da_mantenere' }, '2026-10-02', giorno), true);
  const fatto = { stato: 'mantenuto', mantenuto_il: '2026-10-02T17:00:08.000Z' };
  assert.equal(impegnoFermaCoda(fatto, '2026-10-02', giorno), true);
  assert.equal(impegnoFermaCoda(fatto, '2026-10-03', giorno), false);
});

test('apertura della chat: il messaggio che mantiene l\'impegno si restituisce solo se l\'app non può averlo già', () => {
  const apertura = Date.parse('2026-10-02T17:00:05.000Z');
  assert.equal(daMostrare('2026-10-02T17:00:09.000Z', apertura), true); // scritto dopo l'apertura
  assert.equal(daMostrare('2026-10-02T17:00:00.000Z', apertura), false); // c'era già: è nello storico
  assert.equal(daMostrare(null, apertura), false);
});

// ---------- l'attesa in chat (lato app) ----------

test('attesa in chat: si aspetta solo finché l\'impegno è "da_mantenere"', () => {
  const { profilo } = dialogoTolc();
  assert.equal(impegnoInSospeso(profilo).testo, leggiImpegno(profilo).testo);
  assert.equal(impegnoInSospeso({}), null);
  assert.equal(impegnoInSospeso({ impegno: { ...IMPEGNO, stato: 'mantenuto' } }), null);
  // niente impegno in sospeso = niente attesa e nessun controllo periodico
  assert.equal(faseAttesa(false, null, ADESSO), 'niente');
  assert.equal(faseAttesa(false, ADESSO - 5000, ADESSO), 'niente');
});

test('attesa in chat: personaggio che pensa per 30 secondi, poi il bottone "Inizia"', () => {
  assert.equal(PASSO_CONTROLLO_MS, 2000);
  assert.equal(ATTESA_MASSIMA_MS, 30_000);
  assert.equal(faseAttesa(true, ADESSO, ADESSO), 'attesa');
  assert.equal(faseAttesa(true, ADESSO, ADESSO + 29_999), 'attesa');
  assert.equal(faseAttesa(true, ADESSO, ADESSO + 30_000), 'bottone');
  assert.equal(faseAttesa(true, ADESSO, ADESSO + 10 * 60_000), 'bottone'); // mai appesa: il bottone resta
  // premuto "Inizia" l'attesa riparte da capo
  assert.equal(faseAttesa(true, ADESSO + 31_000, ADESSO + 32_000), 'attesa');
});

test('attesa in chat: la scritta dice cosa è stato promesso, col nome del bot', () => {
  assert.equal(
    testoAttesa('Lode', 'Partiamo da monomi e polinomi: ti preparo una serie di esercizi graduali.'),
    'Lode sta preparando i tuoi esercizi…'
  );
  assert.equal(testoAttesa('Pico', 'Ti faccio uno schema dei prodotti notevoli.'), 'Pico sta preparando il tuo schema…');
  assert.equal(testoAttesa('', 'Ti aiuto a organizzare il ripasso partendo da monomi.'), 'Lode sta preparando il tuo piano…');
  assert.equal(testoAttesa('Lode', 'Partiamo da lì: ti aspetto in chat e cominciamo subito.'), 'Lode sta preparando quello che ti ha promesso…');
});

test('attesa in chat: il messaggio che mantiene l\'impegno compare una volta sola', () => {
  const lista = [
    { id: 'a', ruolo: 'user', contenuto: 'ciao' },
    { id: 'b', ruolo: 'assistant', contenuto: 'chiusura' },
  ];
  const nuovo = { id: 'c', ruolo: 'assistant', contenuto: '1) Calcola 3a + 5a - 2a' };
  const con = conMessaggio(lista, nuovo);
  assert.deepEqual(con.map((m) => m.id), ['a', 'b', 'c']);
  // già nello storico (stesso id), o già mostrato con un id locale (stesso testo): non si raddoppia
  assert.equal(conMessaggio(con, nuovo), con);
  const locale = [...lista, { id: 'locale-1', ruolo: 'assistant', contenuto: nuovo.contenuto }];
  assert.equal(conMessaggio(locale, nuovo), locale);
  // un messaggio dello studente con lo stesso testo non conta come doppione
  assert.equal(conMessaggio([{ id: 'x', ruolo: 'user', contenuto: nuovo.contenuto }], nuovo).length, 2);
});

// ---------- la richiesta e il costo ----------

test('chat: la conversazione mandata al modello comincia sempre da un messaggio dello studente', () => {
  const m = messaggiModello(
    [
      { ruolo: 'assistant', contenuto: 'a' },
      { ruolo: 'assistant', contenuto: 'b' },
      { ruolo: 'user', contenuto: 'c' },
      { ruolo: 'assistant', contenuto: 'd' },
    ],
    'e'
  );
  assert.deepEqual(m.map((x) => x.content), ['c', 'd', 'e']);
  assert.deepEqual(messaggiModello([{ ruolo: 'assistant', contenuto: 'a' }], 'e').map((x) => x.role), ['user']);
});

test('chat: senza istruzione del momento i blocchi di sistema sono due, tutti e due in cache', () => {
  const r = richiestaChat({ testo: 'Oggi è venerdì.', senzaVoti: false }, [{ categoria: 'obiettivi', contenuto: 'laurearsi a luglio' }], [], 'ciao');
  assert.equal(r.system.length, 2);
  assert.ok(r.system.every((b) => b.cache_control?.type === 'ephemeral'));
  assert.ok(!r.system[0].text.includes('Oggi è venerdì'), 'i dati dello studente non stanno nel blocco uguale per tutti');
  assert.match(r.system[1].text, /laurearsi a luglio/);
  assert.match(r.system[1].text, /<dati_reali_utente>\nOggi è venerdì\.\n<\/dati_reali_utente>/);
});

test('chat: testo della risposta, e niente testo se il modello rifiuta', () => {
  assert.equal(testoRisposta({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ' ciao ' }] }), 'ciao');
  assert.equal(testoRisposta({ stop_reason: 'refusal', content: [{ type: 'text', text: 'x' }] }), '');
  assert.equal(testoRisposta(null), '');
});

test('costo: dai token reali, con lettura e scrittura della cache al loro prezzo', () => {
  // 1M di token per voce: 2 + 10 + 0,20 + 2,50 dollari su Sonnet
  const u = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 };
  assert.equal(Number(costoUSD('claude-sonnet-5-5', u).toFixed(2)), 14.7);
  assert.equal(Number(costoUSD('claude-haiku-4-5', u).toFixed(2)), 7.35);
  // i token registrati nel caso Tolc: il secondo messaggio legge dalla cache quello che il primo ha scritto
  assert.equal(TOLC.uso_correzione.cache_read_input_tokens, TOLC.uso_primo_messaggio.cache_creation_input_tokens);
  assert.ok(costoUSD(MODELLO_CHAT, TOLC.uso_correzione) < costoUSD(MODELLO_CHAT, TOLC.uso_primo_messaggio));
});
