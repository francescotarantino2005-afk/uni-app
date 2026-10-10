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

// --- 1.0.1 build 22: chat nuove salvate solo al primo messaggio ---
import {
  TITOLO_NUOVA as TITOLO_NUOVA_APP,
  VUOTA_DA_ELIMINARE_MS,
  bozza,
  eBozza,
  separaVuote,
  sottotitoloChat,
  titoloDaMessaggio,
} from '../lib/conversazioni.ts';
import { TITOLO_NUOVA as TITOLO_NUOVA_SERVER } from '../supabase/functions/chat/logica.ts';

test('bozza: una chat nuova non ha id finché non si salva', () => {
  const b = bozza('esame-1');
  assert.equal(eBozza(b), true);
  assert.equal(b.exam_id, 'esame-1');
  assert.equal(eBozza({ ...b, id: 'abc' }), false);
  assert.equal(eBozza(null), false);
  // stesso titolo di default del server: se arrivasse lì, il server lo rimpiazzerebbe
  assert.equal(TITOLO_NUOVA_APP, TITOLO_NUOVA_SERVER);
});

test('titolo dal primo messaggio: al massimo 30 caratteri, parola intera', () => {
  assert.equal(titoloDaMessaggio('Derivate'), 'Derivate');
  assert.equal(titoloDaMessaggio('  ciao   come\tva  '), 'ciao come va');
  assert.equal(titoloDaMessaggio('\n\nprima riga\nseconda riga'), 'prima riga');
  const lungo = titoloDaMessaggio('Fammi una simulazione TOLC-I di 20 domande sulla logica');
  assert.ok(lungo.length <= 30, lungo);
  assert.equal(lungo, 'Fammi una simulazione TOLC-I…');
  const senzaSpazi = titoloDaMessaggio('x'.repeat(60));
  assert.equal(senzaSpazi.length, 30);
  assert.ok(senzaSpazi.endsWith('…'));
  assert.equal(titoloDaMessaggio('Spiegami gli integrali, per favore, con calma'), 'Spiegami gli integrali, per…');
  assert.equal(titoloDaMessaggio('   '), TITOLO_NUOVA_APP);
  // esattamente 30 caratteri: resta intero
  assert.equal(titoloDaMessaggio('a'.repeat(30)), 'a'.repeat(30));
});

test('chat vuote: mai nella barra; si eliminano solo dopo dieci minuti; la Generale resta', () => {
  const adesso = Date.parse('2026-10-10T12:00:00Z');
  const fa = (ms) => new Date(adesso - ms).toISOString();
  const riga = (id, messaggi, creata, generale = false) => ({
    id, exam_id: null, titolo: 'Nuova chat', generale, aggiornata_il: creata, creata_il: creata, messaggi,
  });
  const { visibili, daEliminare } = separaVuote(
    [
      riga('gen', 0, fa(86_400_000), true),
      riga('piena', 4, fa(86_400_000)),
      riga('vuota-vecchia-1', 0, fa(86_400_000)),
      riga('vuota-vecchia-2', 0, fa(VUOTA_DA_ELIMINARE_MS + 1000)),
      riga('vuota-appena-nata', 0, fa(5_000)),
    ],
    adesso
  );
  assert.deepEqual(visibili.map((c) => c.id), ['gen', 'piena']);
  assert.deepEqual(daEliminare, ['vuota-vecchia-1', 'vuota-vecchia-2']);
  // le righe visibili non si portano dietro i campi di servizio
  assert.equal('messaggi' in visibili[1], false);
  assert.equal('creata_il' in visibili[1], false);
});

test('intestazione: Generale, esame, titolo della chat', () => {
  const c = { id: 'c1', exam_id: 'e1', titolo: 'Limiti notevoli', generale: false, aggiornata_il: '' };
  assert.equal(sottotitoloChat(null, null), 'Generale');
  assert.equal(sottotitoloChat({ ...c, generale: true, titolo: 'Generale' }, null), 'Generale');
  assert.equal(sottotitoloChat(c, 'Analisi 1'), 'Analisi 1 · Limiti notevoli');
  assert.equal(sottotitoloChat({ ...c, exam_id: null }, null), 'Limiti notevoli');
  assert.equal(sottotitoloChat(bozza('e1'), 'Analisi 1'), 'Analisi 1');
  assert.equal(sottotitoloChat(bozza(null), null), 'Nuova chat');
});
