// Le funzioni di lettura e deduplica del libretto vivono dentro la Edge Function
// (supabase/functions/estrai-libretto/index.ts), che a livello di modulo avvia il
// server e quindi non si può importare. Per provare il codice VERO, senza copie:
// si prende dal sorgente la sola parte pura (tipi + normalizzazione), la si
// scrive in un file temporaneo e la si importa.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const sorgente = readFileSync(
  new URL('../supabase/functions/estrai-libretto/index.ts', import.meta.url),
  'utf8'
);
const tra = (inizio, fine) => {
  const a = sorgente.indexOf(inizio);
  const b = sorgente.indexOf(fine);
  if (a < 0 || b < 0 || b <= a) throw new Error(`Sezione non trovata: ${inizio} … ${fine}`);
  return sorgente.slice(a, b);
};

const puro =
  tra('type Esito', 'const STRUMENTO_ESTRAZIONE') +
  tra('// --- normalizzazione ---', 'function rispondi') +
  '\nexport { leggiVoto, leggiCfu, leggiData, normalizza, chiave, unisci };\n';

const cartella = mkdtempSync(join(tmpdir(), 'lode-test-'));
const file = join(cartella, 'estraiLibrettoPuro.ts');
writeFileSync(file, puro);

export const { leggiVoto, leggiCfu, leggiData, normalizza, chiave, unisci } = await import(
  pathToFileURL(file).href
);

/** La deduplica come la fa la function: una riga per chiave, le altre si uniscono. */
export function deduplica(righe) {
  const perChiave = new Map();
  for (const r of righe) {
    const e = normalizza(r);
    if (!e) continue;
    const k = chiave(e.materia);
    const gia = perChiave.get(k);
    perChiave.set(k, gia ? unisci(gia, e) : e);
  }
  return [...perChiave.values()];
}
