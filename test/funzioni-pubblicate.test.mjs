// Il repo e le Edge Functions pubblicate devono coincidere.
// supabase/functions/pubblicato.json registra l'impronta di ogni file di ogni
// function com'era quando è stata pubblicata e riletta dal vivo. Se qui un test
// fallisce, una function in produzione non è più uguale al repo: va
// ripubblicata e registrata di nuovo (node scripts/funzioni.mjs stato).
// Nessuna rete: si confrontano solo i file del repo col registro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { differenze, funzioni, leggiRegistro, pacchetto } from '../scripts/funzioni.mjs';

const registro = leggiRegistro();

test('ogni function del repo è nel registro delle pubblicazioni', () => {
  const mancanti = funzioni().filter((f) => !registro[f]);
  assert.deepEqual(mancanti, [], `function mai registrate come pubblicate: ${mancanti.join(', ')}`);
});

for (const funzione of funzioni()) {
  test(`${funzione}: il repo coincide con ciò che è pubblicato`, () => {
    const d = differenze(funzione, registro);
    assert.deepEqual(
      d,
      [],
      `${funzione} va ripubblicata (e poi registrata con "node scripts/funzioni.mjs registra ${funzione} <corpo dal vivo>"):\n  ${d.join('\n  ')}`
    );
  });
}

test('un file condiviso finisce nel pacchetto di TUTTE le function che lo importano', () => {
  // È il caso che ha causato le function "rimaste indietro": cambia il file
  // condiviso, si ripubblica una function sola. Il pacchetto si calcola dagli
  // import, quindi il test sopra diventa rosso per tutte quelle che lo usano.
  const usano = (file) => funzioni().filter((f) => pacchetto(f).some((x) => x.name === file));
  assert.deepEqual(usano('_shared/briefing.ts'), ['chat', 'genera-briefing', 'genera-piano', 'invia-briefing']);
  assert.deepEqual(usano('accoglienza-dialogo/profilo.ts'), ['accoglienza-dialogo', 'chat', 'coda-domande']);
  assert.deepEqual(
    pacchetto('chat').map((f) => f.name),
    ['_shared/aiuto.ts', '_shared/briefing.ts', '_shared/errori.ts', '_shared/manuale-testo.ts', '_shared/manuale.ts', 'accoglienza-dialogo/profilo.ts', 'chat/controlli.ts', 'chat/formule.ts', 'chat/index.ts', 'chat/interrogazione.ts', 'chat/logica.ts', 'chat/memoria.ts', 'chat/motore.ts']
  );
});
