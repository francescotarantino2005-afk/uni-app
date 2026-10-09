// Il tetto giornaliero della chat (index.ts): chi non ha limiti, cosa NON scala
// il tetto, quanto puo' essere lungo un messaggio. index.ts e' il contorno HTTP
// (Deno): qui si controlla il sorgente, in ordine, e la migrazione del flag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const index = readFileSync(new URL('../supabase/functions/chat/index.ts', import.meta.url), 'utf8');
const pos = (s) => {
  const i = index.indexOf(s);
  assert.ok(i >= 0, `manca in index.ts: ${s}`);
  return i;
};

test('senza_limiti e premium saltano il tetto giornaliero', () => {
  assert.match(index, /select\('premium, senza_limiti'\)/);
  assert.match(index, /if \(!profilo\?\.premium && !profilo\?\.senza_limiti\) \{/);
});

test('un messaggio lungo fino a 8000 caratteri passa, oltre 413', () => {
  assert.match(index, /MAX_CARATTERI_MESSAGGIO = 8000;/);
  assert.match(index, /messaggio\.length > MAX_CARATTERI_MESSAGGIO\) return json\(\{ errore: 'MESSAGGIO_TROPPO_LUNGO' \}, 413\)/);
});

test('"Mi sono bloccato" e messaggio troppo lungo NON scalano il tetto', () => {
  const conteggio = pos("from('usage_chat').insert(");
  // il rifiuto per lunghezza e il messaggio di blocco escono PRIMA del conteggio
  assert.ok(pos("'MESSAGGIO_TROPPO_LUNGO'") < conteggio);
  assert.ok(pos('return json({ risposta: MESSAGGIO_BLOCCO') < conteggio);
  // e il conteggio e' uno solo
  assert.equal(index.split("from('usage_chat').insert(").length, 2);
});

test('la migrazione protegge il flag: lo studente non lo puo\' cambiare', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const nome = readdirSync(dir).find((f) => f.endsWith('_senza_limiti.sql'));
  assert.ok(nome, 'manca la migrazione senza_limiti');
  const sql = readFileSync(new URL(nome, dir), 'utf8');
  assert.match(sql, /add column if not exists senza_limiti boolean not null default false/);
  assert.match(sql, /current_user in \('authenticated', 'anon'\)/);
  assert.match(sql, /new\.senza_limiti := old\.senza_limiti/);
  assert.match(sql, /before insert or update on public\.profiles/);
});
