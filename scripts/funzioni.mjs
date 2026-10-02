// Edge Functions: cosa c'è nel repo contro cosa è stato PUBBLICATO.
//
// Il problema che risolve: una function in produzione che non è più uguale al
// repo senza che nessuno se ne accorga (di solito perché cambia un file
// condiviso e si ripubblica solo una delle function che lo usano).
//
// Come funziona:
// - per ogni function calcola i file che finiscono nel suo pacchetto, seguendo
//   gli import relativi a partire da index.ts (quindi anche i file condivisi);
// - supabase/functions/pubblicato.json registra, per ogni function, la versione
//   pubblicata e l'impronta di ciascun file COM'ERA quando è stato verificato
//   dal vivo;
// - `npm test` fallisce se il repo non coincide più col registro: vuol dire che
//   c'è una function da ripubblicare (test/funzioni-pubblicate.test.mjs).
//
// Comandi:
//   node scripts/funzioni.mjs stato
//       cosa è allineato e cosa va ripubblicato
//   node scripts/funzioni.mjs carico <function>
//       i file da passare alla pubblicazione (JSON, una riga per file)
//   node scripts/funzioni.mjs registra <function> <file.json>
//       <file.json> è il corpo LETTO DAL VIVO dopo la pubblicazione (il JSON di
//       get_edge_function del collegamento Supabase): lo confronta byte per
//       byte col repo e, solo se coincide, aggiorna il registro.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');
const REGISTRO = join(RADICE, 'pubblicato.json');

/** Il contenuto di riferimento è quello di git: fine riga LF. */
const leggi = (nome) => readFileSync(join(RADICE, nome), 'utf8').replace(/\r\n/g, '\n');
export const impronta = (testo) => createHash('sha256').update(testo, 'utf8').digest('hex');

/** Le function del repo: le cartelle con un index.ts (non quelle che iniziano con "_"). */
export function funzioni() {
  return readdirSync(RADICE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(RADICE, d.name, 'index.ts')))
    .map((d) => d.name)
    .sort();
}

/** I file del pacchetto di una function: index.ts e tutto ciò che importa, in modo ricorsivo. */
export function pacchetto(funzione) {
  const visti = new Map();
  const daVedere = [`${funzione}/index.ts`];
  while (daVedere.length) {
    const nome = daVedere.pop();
    if (visti.has(nome)) continue;
    const testo = leggi(nome);
    visti.set(nome, testo);
    for (const m of testo.matchAll(/(?:from|import)\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      daVedere.push(posix.normalize(posix.join(posix.dirname(nome), m[1])));
    }
  }
  return [...visti].sort(([a], [b]) => a.localeCompare(b)).map(([name, content]) => ({ name, content }));
}

export function leggiRegistro() {
  return existsSync(REGISTRO) ? JSON.parse(readFileSync(REGISTRO, 'utf8')) : {};
}

/** Per una function: cosa non coincide tra repo e registro ([] = allineata). */
export function differenze(funzione, registro = leggiRegistro()) {
  const voce = registro[funzione];
  if (!voce) return ['mai registrata: va pubblicata e registrata'];
  const ora = Object.fromEntries(pacchetto(funzione).map((f) => [f.name, impronta(f.content)]));
  const nomi = new Set([...Object.keys(ora), ...Object.keys(voce.file)]);
  return [...nomi]
    .sort()
    .filter((n) => ora[n] !== voce.file[n])
    .map((n) => (!voce.file[n] ? `${n}: nuovo nel pacchetto` : !ora[n] ? `${n}: non è più nel pacchetto` : `${n}: cambiato`));
}

function stato() {
  const registro = leggiRegistro();
  let daFare = 0;
  for (const f of funzioni()) {
    const d = differenze(f, registro);
    if (d.length) daFare++;
    console.log(`${d.length ? 'DA RIPUBBLICARE' : 'allineata      '}  ${f}${registro[f] ? `  (v${registro[f].versione}, verificata il ${registro[f].verificata_il})` : ''}`);
    for (const r of d) console.log(`    - ${r}`);
  }
  console.log(daFare ? `\n${daFare} function da ripubblicare.` : '\nTutte le function del repo coincidono con quelle pubblicate.');
  return daFare;
}

function registra(funzione, percorso) {
  const grezzo = readFileSync(percorso, 'utf8');
  const vivo = JSON.parse(grezzo.slice(grezzo.indexOf('{')));
  if (vivo.slug !== funzione) throw new Error(`il file è della function "${vivo.slug}", non di "${funzione}"`);
  // I nomi dal vivo possono avere davanti "functions/" o "supabase/functions/" (pubblicazioni dalla CLI).
  const pulito = (n) => n.replace(/^(supabase\/)?functions\//, '');
  const dalVivo = Object.fromEntries(vivo.files.map((f) => [pulito(f.name), f.content]));
  const locale = pacchetto(funzione);
  const problemi = [];
  let soloFineRiga = false;
  for (const f of locale) {
    const v = dalVivo[f.name];
    if (v === undefined) problemi.push(`${f.name}: manca dal vivo`);
    else if (v !== f.content) {
      if (v.replace(/\r\n/g, '\n') === f.content) soloFineRiga = true;
      else problemi.push(`${f.name}: DIVERSO dal vivo`);
    }
  }
  for (const n of Object.keys(dalVivo)) if (!locale.some((f) => f.name === n)) problemi.push(`${n}: dal vivo c'è, nel repo non serve`);
  if (problemi.length) {
    console.log(`NON REGISTRATA ${funzione} (v${vivo.version}): la function dal vivo non coincide col repo`);
    for (const p of problemi) console.log(`    - ${p}`);
    return 1;
  }
  const registro = leggiRegistro();
  registro[funzione] = {
    versione: vivo.version,
    verify_jwt: vivo.verify_jwt,
    verificata_il: new Date().toISOString().slice(0, 10),
    file: Object.fromEntries(locale.map((f) => [f.name, impronta(f.content)])),
  };
  const ordinato = Object.fromEntries(Object.keys(registro).sort().map((k) => [k, registro[k]]));
  writeFileSync(REGISTRO, JSON.stringify(ordinato, null, 2) + '\n');
  console.log(`registrata ${funzione} v${vivo.version}: ${locale.length} file identici al repo${soloFineRiga ? ' (a parte il fine riga CRLF di una pubblicazione da Windows)' : ''}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [comando, funzione, percorso] = process.argv.slice(2);
  if (comando === 'stato') process.exit(stato() ? 1 : 0);
  else if (comando === 'carico' && funzione) for (const f of pacchetto(funzione)) console.log(JSON.stringify(f));
  else if (comando === 'registra' && funzione && percorso) process.exit(registra(funzione, percorso));
  else {
    console.log('uso: node scripts/funzioni.mjs stato | carico <function> | registra <function> <file.json>');
    process.exit(2);
  }
}
