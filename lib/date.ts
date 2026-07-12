// Utility date/ore in italiano, senza dipendere da Intl (supporto Hermes variabile).

export const GIORNI_SETTIMANA = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const;

export const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const;

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
] as const;

/** Giorno della settimana di oggi nel formato dello schema: 1 = lunedì … 7 = domenica */
export function giornoOggi(): number {
  const js = new Date().getDay(); // 0 = domenica
  return js === 0 ? 7 : js;
}

/** Data di oggi in ISO "AAAA-MM-GG" (fuso locale) */
export function dataOggiIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Lunedì 13 luglio" */
export function dataLungaItaliana(d: Date = new Date()): string {
  const giorno = d.getDay() === 0 ? 7 : d.getDay();
  return `${GIORNI_SETTIMANA[giorno - 1]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** ISO "AAAA-MM-GG" → "13 lug" (breve, per le righe scadenza) */
export function dataBreveItaliana(iso: string): string {
  const [anno, mese, giorno] = iso.split('-').map(Number);
  if (!anno || !mese || !giorno) return iso;
  const abbrev = MESI[mese - 1]?.slice(0, 3) ?? '';
  const annoCorrente = new Date().getFullYear();
  return anno === annoCorrente ? `${giorno} ${abbrev}` : `${giorno} ${abbrev} ${anno}`;
}

/** Giorni mancanti (negativo = passata) da oggi a una data ISO */
export function giorniMancanti(iso: string): number {
  const [anno, mese, giorno] = iso.split('-').map(Number);
  const scadenza = new Date(anno, mese - 1, giorno);
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return Math.round((scadenza.getTime() - oggi.getTime()) / 86_400_000);
}

/** "GG/MM/AAAA" (o "G/M/AAAA") → ISO "AAAA-MM-GG", null se non valida */
export function parseDataItaliana(testo: string): string | null {
  const m = testo.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, g, me, a] = m.map(Number);
  const data = new Date(a, me - 1, g);
  if (data.getFullYear() !== a || data.getMonth() !== me - 1 || data.getDate() !== g) return null;
  return `${a}-${String(me).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

/** Valida "HH:MM" (o "H:MM") e la normalizza a "HH:MM", null se non valida */
export function normalizzaOra(testo: string): string | null {
  const m = testo.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const ore = Number(m[1]);
  const minuti = Number(m[2]);
  if (ore > 23 || minuti > 59) return null;
  return `${String(ore).padStart(2, '0')}:${m[2]}`;
}

/** Postgres "HH:MM:SS" → "HH:MM" */
export function oraBreve(ora: string | null): string {
  return ora ? ora.slice(0, 5) : '';
}
