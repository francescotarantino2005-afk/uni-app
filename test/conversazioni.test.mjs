// Spazi per esame (1.0.1): conversazioni della chat. Logica pura e controlli
// sul codice che gira nella function chat e nella migrazione.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TITOLO_NUOVA, titoloDa } from '../supabase/functions/chat/logica.ts';

const leggi = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('titolo: la prima riga del primo messaggio, al massimo 40 caratteri, a parola intera', () => {
  assert.equal(titoloDa('Interrogami sui contratti'), 'Interrogami sui contratti');
  assert.equal(titoloDa('  riga uno\nriga due'), 'riga uno');
  const lungo = titoloDa('Mi prepari un piano di studio per il TOLC-I di giovedì prossimo, per favore?');
  assert.ok(lungo.length <= 41, lungo);
  assert.ok(lungo.endsWith('…'));
  assert.ok(!/\s…$/.test(lungo));
  assert.equal(titoloDa('   '), TITOLO_NUOVA);
});

test('migrazione: solo aggiunte, RLS sulla tabella nuova, colonna facoltativa, backfill in "Generale"', () => {
  const file = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find((f) => f.endsWith('_conversazioni.sql'));
  assert.ok(file, 'manca la migrazione delle conversazioni');
  const sql = leggi(`supabase/migrations/${file}`);
  assert.ok(!/\bdrop\b|\btruncate\b|delete\s+from/i.test(sql), 'nessuna cancellazione di dati');
  assert.match(sql, /alter table public\.conversazioni enable row level security/);
  assert.match(sql, /add column if not exists conversazione_id uuid references public\.conversazioni\(id\)/);
  assert.ok(!/conversazione_id uuid[^;]*not null/i.test(sql), 'la colonna resta facoltativa (build vecchie)');
  assert.match(sql, /'Generale', true/);
  assert.match(sql, /for delete using \(auth\.uid\(\) = user_id and not generale\)/);
});

test('chat: senza conversazione_id (build fino alla 20) si usa la "Generale"; un id altrui non si usa', () => {
  const index = leggi('supabase/functions/chat/index.ts');
  const motore = leggi('supabase/functions/chat/motore.ts');
  assert.match(index, /conversazioneDelTurno\(admin, user\.id, convRichiesta \?\? null\)/);
  assert.match(index, /CONVERSAZIONE_NON_TROVATA/);
  assert.match(motore, /\.eq\('id', id\)\.eq\('user_id', userId\)/);
  // nella Generale contano anche i messaggi scritti senza conversazione (accoglienza, coda, impegno)
  assert.match(motore, /conversazione_id\.is\.null/);
  // la memoria resta una sola: le note non si filtrano per conversazione
  assert.ok(!/from\('note_studente'\)[^;]*conversazione_id/.test(motore));
});
