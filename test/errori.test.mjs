// Quando il modello non risponde la chat non si rompe: classificazione dell'errore,
// messaggio normale di Lode, riga di log riconoscibile, dialogo fermo al suo turno.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGGIO_BLOCCO, rigaErroreModello, tipoDaRisposta, tipoErrore } from '../supabase/functions/_shared/errori.ts';
import { corpoBlocco, profiloCompleto } from '../supabase/functions/accoglienza-dialogo/logica.ts';

test('errori: il tipo si riconosce da stato e corpo dell\'API', () => {
  assert.equal(tipoDaRisposta(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}'), 'credito_esaurito');
  assert.equal(tipoDaRisposta(529, '{"type":"error","error":{"type":"overloaded_error"}}'), 'sovraccarico');
  assert.equal(tipoDaRisposta(200, 'overloaded'), 'sovraccarico');
  assert.equal(tipoDaRisposta(500, ''), 'sovraccarico');
  assert.equal(tipoDaRisposta(429, ''), 'limite_richieste');
  assert.equal(tipoDaRisposta(401, ''), 'autenticazione');
  assert.equal(tipoDaRisposta(400, 'bad'), 'richiesta_non_valida');
  assert.equal(tipoDaRisposta(418, ''), 'altro');
});

test('errori: il tipo si riconosce anche dalle eccezioni (SDK, fetch, timeout, risposta vuota)', () => {
  assert.equal(tipoErrore({ status: 400, message: '400 {"error":{"message":"credit balance is too low"}}' }), 'credito_esaurito');
  assert.equal(tipoErrore({ status: 529, error: { type: 'overloaded_error' } }), 'sovraccarico');
  assert.equal(tipoErrore({ name: 'APIConnectionTimeoutError', message: 'Request timed out.' }), 'timeout');
  assert.equal(tipoErrore({ name: 'AbortError', message: 'aborted' }), 'timeout');
  assert.equal(tipoErrore(new Error('risposta vuota')), 'risposta_vuota');
  assert.equal(tipoErrore(new TypeError('fetch failed')), 'connessione');
  assert.equal(tipoErrore(null), 'altro');
});

test('errori: la riga di log si riconosce e porta il tipo', () => {
  assert.equal(rigaErroreModello('chat', 'credito_esaurito', 400), 'LODE_ERRORE_MODELLO tipo=credito_esaurito contesto=chat stato=400');
  assert.equal(rigaErroreModello('accoglienza-dialogo', 'timeout'), 'LODE_ERRORE_MODELLO tipo=timeout contesto=accoglienza-dialogo');
});

test('errori: il messaggio è un normale messaggio di Lode, senza numeri né recapiti', () => {
  assert.equal(MESSAGGIO_BLOCCO, 'Mi sono bloccato un attimo, riprova tra qualche minuto.');
  assert.ok(!/\d/.test(MESSAGGIO_BLOCCO));
});

test('accoglienza: se il modello non risponde il dialogo resta al turno in cui era', () => {
  const profilo = profiloCompleto({ esame_target: { testo: 'Analisi 1', nome: 'Analisi 1', id: null } });
  const c = corpoBlocco(profilo, ['esame_target', 'quando'], 'credito_esaurito');
  assert.equal(c.risposta_bot, MESSAGGIO_BLOCCO);
  assert.equal(c.profilo_studio, profilo, 'profilo com\'era: la risposta dello studente non è stata registrata');
  assert.deepEqual(c.chieste, ['esame_target', 'quando']);
  assert.equal(c.prossima_chiave, 'quando', 'la domanda in sospeso resta la stessa');
  assert.equal(c.fine, false);
  assert.equal(c.aiuto, false, 'la chat non si apre');
  assert.equal(c.messaggi_salvati, false, 'niente in chat_messages');
  assert.equal(c.errore_modello, 'credito_esaurito');
  assert.equal(corpoBlocco(profilo, [], 'timeout').prossima_chiave, null);
});
