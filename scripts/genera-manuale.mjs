// Il manuale del professore vive in supabase/functions/_shared/manuale-del-professore.md
// (e' il testo di riferimento: non si modifica a mano nel codice). Le Edge
// Functions pero' pubblicano solo file .ts, quindi questo script ne ricava
// _shared/manuale-testo.ts, che contiene lo STESSO testo, carattere per carattere.
// test/manuale.test.mjs controlla che i due file restino uguali.
//   node scripts/genera-manuale.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions', '_shared');
const testo = readFileSync(join(CARTELLA, 'manuale-del-professore.md'), 'utf8').replace(/\r\n/g, '\n');
if (testo.includes('`') || testo.includes('\\') || testo.includes('${')) {
  throw new Error('Il manuale contiene un apice inverso, una barra rovesciata o un dollaro con graffa: serve un altro modo di includerlo');
}

writeFileSync(
  join(CARTELLA, 'manuale-testo.ts'),
  `// GENERATO da scripts/genera-manuale.mjs a partire da manuale-del-professore.md: non modificare a mano.\nexport const MANUALE = \`${testo}\`;\n`
);
console.log(`manuale-testo.ts scritto (${testo.length} caratteri)`);
