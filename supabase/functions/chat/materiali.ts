// I materiali che Lode prepara e a cui lo studente rispondera' (test, esercizi,
// piani) e la cronologia mandata al modello. Logica PURA (niente rete): la usa
// chat/motore.ts, la coprono test/materiali.test.mjs.
//
// Perche' esiste (9 ottobre 2026, TOLC-I): la chat mandava gli ultimi 10
// messaggi e scartava quelli di Lode in testa; il test di 20 domande e' uscito
// dalla finestra e Lode ha "corretto" tirando a indovinare, contando male piu'
// volte. Da qui:
// - la cronologia si costruisce per budget di token, sempre con gli ultimi
//   messaggi interi;
// - il messaggio di Lode che contiene un materiale porta metadati.materiale e
//   l'ultimo materiale attivo entra sempre nel contesto, anche fuori finestra;
// - un test a risposta multipla porta la chiave (il segno [[test ...]] scritto
//   dal modello, tolto prima di mostrare il messaggio): le risposte dello
//   studente le confronta il CODICE, che calcola giuste, sbagliate, non date e
//   punteggio. Il modello spiega gli errori ma non conta.

// ---------- cronologia per budget di token ----------

/** Quanti messaggi si leggono dal database al massimo (poi decide il budget). */
export const MAX_STORICO_LETTI = 80;
/** Budget di token per la cronologia (stima: un token ogni 3 caratteri). */
export const BUDGET_STORICO_TOKEN = 12_000;
/** Gli ultimi messaggi entrano sempre, interi, anche oltre il budget. */
export const ULTIMI_SEMPRE = 6;
/** Un materiale resta attivo per due settimane (se non ne arriva uno piu' nuovo). */
export const MATERIALE_VALE_GIORNI = 14;

export function tokenStimati(testo: string): number {
  return Math.ceil((testo ?? '').length / 3);
}

/** La parte finale dello storico che sta nel budget: messaggi interi, mai tagliati, gli ultimi sempre. */
export function finestraStorico<T extends { contenuto: string }>(
  storico: T[],
  budget = BUDGET_STORICO_TOKEN,
  sempre = ULTIMI_SEMPRE
): T[] {
  let usati = 0;
  let i = storico.length;
  while (i > 0) {
    const t = tokenStimati(storico[i - 1].contenuto);
    if (storico.length - i >= sempre && usati + t > budget) break;
    usati += t;
    i--;
  }
  return storico.slice(i);
}

// ---------- che materiale e' ----------

export type TipoMateriale = 'test' | 'esercizi' | 'piano';

const RIGA_NUMERATA = /^\s*(?:[-*]\s*)?(?:\*\*)?(?:Domanda\s+|Esercizio\s+)?(\d{1,2})\s*[).:](?:\*\*)?\s+\S/gim;
const OPZIONE = /(?:^|\s|\()[A-E]\)\s*\S/gm;
const GIORNO = /^\s*(?:[-*]\s*)?(?:#+\s*)?(?:\*\*)?(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|giorno\s+\d+)(?![\p{L}])/gimu;
const CHIEDE_RISULTATI = /\b(?:mandami|scrivimi|dimmi|fammi sapere|inviami)\b[^.\n]{0,80}\b(?:risultat|rispost|soluzion|lettere|conti)/i;

/** Il tipo di materiale di un messaggio di Lode, o null se e' un messaggio qualunque. */
export function tipoMateriale(testo: string): TipoMateriale | null {
  const numerate = (testo.match(RIGA_NUMERATA) ?? []).length;
  const opzioni = (testo.match(OPZIONE) ?? []).length;
  if (numerate >= 3 && opzioni >= 9) return 'test';
  if ((numerate >= 2 || /\besercizio\b/i.test(testo)) && CHIEDE_RISULTATI.test(testo)) return 'esercizi';
  if ((testo.match(GIORNO) ?? []).length >= 3) return 'piano';
  return null;
}

// ---------- la chiave del test ----------

export type FormatoPunteggio = 'tolc' | 'semplice';

export type ChiaveTest = {
  /** numero della domanda -> lettera giusta (A-E) */
  chiave: Record<string, string>;
  /** tolc: +1 giusta, -0,25 sbagliata, 0 non data. semplice: +1 giusta, 0 il resto. */
  formato: FormatoPunteggio;
  /** domande senza penalita' anche nel formato tolc (per esempio Inglese) */
  senza_penalita: number[];
  /** l'inizio del testo di ogni domanda, per riconoscerla */
  domande: { n: number; testo: string }[];
};

const SEGNO_TEST = /\[\[\s*test\b([^\]]*)\]\]/gi;

function intervalli(s: string): number[] {
  const out: number[] = [];
  for (const parte of s.split(/[,\s]+/).filter(Boolean)) {
    const m = parte.match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && n <= 99; n++) out.push(n);
  }
  return [...new Set(out)].sort((x, y) => x - y);
}

/** L'inizio del testo di ogni domanda numerata (al massimo 120 caratteri). */
export function domandeDi(testo: string): { n: number; testo: string }[] {
  const out: { n: number; testo: string }[] = [];
  const visti = new Set<number>();
  for (const m of testo.matchAll(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:Domanda\s+)?(\d{1,2})\s*[).:](?:\*\*)?\s+(.+)$/gim)) {
    const n = Number(m[1]);
    if (visti.has(n)) continue;
    visti.add(n);
    out.push({ n, testo: m[2].replace(/\*\*/g, '').trim().slice(0, 120) });
  }
  return out;
}

/**
 * Toglie dal testo il segno [[test formato=tolc chiave=1A,2C,... senza_penalita=16-20]]
 * e ne ricava la chiave. Chiave null se il segno manca o non ha lettere valide.
 */
export function estraiChiave(risposta: string): { testo: string; chiave: ChiaveTest | null } {
  let dentro: string | null = null;
  const testo = risposta
    .replace(SEGNO_TEST, (_, d: string) => {
      if (dentro === null) dentro = d;
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (dentro === null) return { testo, chiave: null };
  const d: string = dentro;
  const parteChiave = d.match(/chiave\s*=\s*([^=\]]*?)(?=\s+\w+\s*=|$)/i)?.[1] ?? '';
  const chiave: Record<string, string> = {};
  for (const m of parteChiave.matchAll(/(\d{1,2})\s*[-=:.)]?\s*([A-Ea-e])(?![A-Za-z])/g)) chiave[String(Number(m[1]))] = m[2].toUpperCase();
  if (!Object.keys(chiave).length) return { testo, chiave: null };
  const formato: FormatoPunteggio = /formato\s*=\s*(?:semplice|senza)/i.test(d) ? 'semplice' : 'tolc';
  const senza = d.match(/senza_penalita\s*=\s*([\d,\s-]+)/i)?.[1] ?? '';
  return {
    testo,
    chiave: { chiave, formato, senza_penalita: intervalli(senza), domande: domandeDi(testo) },
  };
}

/** I metadati da scrivere sul messaggio di Lode che contiene un materiale. */
export function metadatiMateriale(testo: string, chiave: ChiaveTest | null): Record<string, unknown> {
  const tipo = chiave ? 'test' : tipoMateriale(testo);
  if (!tipo) return {};
  return chiave ? { materiale: tipo, test: chiave } : { materiale: tipo };
}

export function leggiMateriale(metadati: unknown): TipoMateriale | null {
  const m = metadati && typeof metadati === 'object' ? (metadati as Record<string, unknown>).materiale : null;
  return m === 'test' || m === 'esercizi' || m === 'piano' ? m : null;
}

export function leggiChiave(metadati: unknown): ChiaveTest | null {
  const t = metadati && typeof metadati === 'object' ? (metadati as Record<string, unknown>).test : null;
  if (!t || typeof t !== 'object') return null;
  const c = t as Partial<ChiaveTest>;
  if (!c.chiave || typeof c.chiave !== 'object' || !Object.keys(c.chiave).length) return null;
  return {
    chiave: c.chiave as Record<string, string>,
    formato: c.formato === 'semplice' ? 'semplice' : 'tolc',
    senza_penalita: Array.isArray(c.senza_penalita) ? c.senza_penalita.filter((n) => typeof n === 'number') : [],
    domande: Array.isArray(c.domande) ? c.domande : [],
  };
}

export type RigaMateriale = { id?: string; ruolo: string; contenuto: string; created_at?: string; metadati?: unknown };

/**
 * L'ultimo materiale attivo: il messaggio di Lode piu' recente con
 * metadati.materiale (o che lo e' a giudicare dal testo, per i messaggi scritti
 * prima del 9 ottobre), non piu' vecchio di due settimane.
 */
export function materialeAttivo<T extends RigaMateriale>(righe: T[], adessoMs: number): T | null {
  for (let i = righe.length - 1; i >= 0; i--) {
    const r = righe[i];
    if (r.ruolo !== 'assistant') continue;
    if (!leggiMateriale(r.metadati) && !tipoMateriale(r.contenuto)) continue;
    const quando = r.created_at ? Date.parse(r.created_at) : adessoMs;
    if (adessoMs - quando > MATERIALE_VALE_GIORNI * 86_400_000) return null;
    return r;
  }
  return null;
}

/** L'istruzione che rimette nel contesto un materiale uscito dalla finestra della cronologia. */
export function istruzioneMateriale(m: RigaMateriale, testoLeggibile: string): string {
  const tipo = leggiMateriale(m.metadati) ?? tipoMateriale(m.contenuto) ?? 'materiale';
  const nome = tipo === 'test' ? 'il TEST' : tipo === 'esercizi' ? 'gli ESERCIZI' : tipo === 'piano' ? 'il PIANO' : 'il materiale';
  const quando = m.created_at ? ` il ${m.created_at.slice(0, 10)}` : '';
  return `MATERIALE ANCORA IN CORSO: qui sotto c'è ${nome} che hai scritto tu${quando}, in questa conversazione. Il messaggio è più vecchio della parte di conversazione che vedi, ma è TUO e lo studente ci sta lavorando: quando parla di risposte, domande o esercizi si riferisce a questo. Usalo così com'è (numeri delle domande, testi, opzioni).
<materiale_di_lode>
${testoLeggibile}
</materiale_di_lode>`;
}

// ---------- le risposte dello studente ----------

export type Lettura = {
  /** numero -> lettera (A-E) o null (non data, confermata) */
  risposte: Record<string, string | null>;
  /** righe da confermare: numero e cosa ha scritto */
  dubbie: { n: number; scritto: string }[];
  /** quante lettere chiare ha trovato */
  chiare: number;
};

const NON_SO = /^(?:non\s+(?:so|lo\s+so|l'ho\s+fatt[ao]|ricordo|ho\s+rispost[oa]|data)|saltat[ao]|nessuna|boh|[-–—]+$|x$|\?+$)/i;

/** Interpreta cio' che lo studente ha scritto dopo il numero (o nella riga, senza numero). */
function interpreta(resto: string): { lettera: string } | { dubbia: string } | null {
  const r = resto.trim().replace(/^[:.)=\-–—]\s*/, '').trim();
  if (!r) return null;
  const sola = r.match(/^\(?([A-Ea-e])\)?[.,;]?$/);
  if (sola) return { lettera: sola[1].toUpperCase() };
  if (NON_SO.test(r)) return { dubbia: r };
  // lettera con un dubbio ("e? non sono sicuro")
  if (/^\(?[A-Ea-e]\)?\s*\?/.test(r)) return { dubbia: r };
  // lettera con un commento ("b ma ho fatto a mente"): vale la lettera, salvo
  // "a"/"e" seguite da una parola minuscola, che in italiano sono parole.
  const conNota = r.match(/^\(?([A-Ea-e])\)?[.,;]?\s+(\S.*)$/);
  if (conNota) {
    const l = conNota[1];
    if ((l === 'a' || l === 'e') && /^[a-zàèéìòù]/.test(conNota[2])) return { dubbia: r };
    return { lettera: l.toUpperCase() };
  }
  return { dubbia: r };
}

/**
 * Le risposte in un messaggio dello studente: "1-A 2-B", "8:b/13: e", "12) c",
 * "alla domanda 12 ho risposto b", oppure una lettera per riga in ordine.
 */
export function leggiRisposte(messaggio: string): Lettura {
  const risposte: Record<string, string | null> = {};
  const dubbie: { n: number; scritto: string }[] = [];
  let chiare = 0;
  const segna = (n: number, esito: ReturnType<typeof interpreta>) => {
    if (!esito || n < 1 || n > 99) return;
    if ('lettera' in esito) {
      risposte[String(n)] = esito.lettera;
      chiare++;
    } else dubbie.push({ n, scritto: esito.dubbia.slice(0, 80) });
  };

  // "alla domanda (numero) 12 ho risposto b"
  const frase = [...messaggio.matchAll(/domanda\s*(?:n(?:umero|\.|°)?\s*)?(\d{1,2})\b[^A-Za-z\d]*(?:ho\s+(?:risposto|messo|dato|scelto)|era|è)?\s*\(?([A-Ea-e])\)?(?![\p{L}])/giu)];
  if (frase.length) {
    for (const m of frase) segna(Number(m[1]), { lettera: m[2].toUpperCase() });
    return { risposte, dubbie, chiare };
  }

  // Coppie numero-lettera sulla stessa riga ("1-A 2-B 3-C", "11-B, 12-B").
  const coppie = [...messaggio.matchAll(/(?:^|[\s,;/|])(\d{1,2})\s*[-=:.)]\s*\(?([A-Ea-e])\)?(?=$|[\s,;/|.])/gm)];
  // un numero con i due punti o la parentesi a meta' riga comincia un'altra risposta ("11: non so 12:c")
  const segmenti = messaggio
    .split(/\n|\/|;|\||\s+(?=\d{1,2}\s*[:)=])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (coppie.length >= 3 && coppie.length >= segmenti.length) {
    for (const m of coppie) segna(Number(m[1]), { lettera: m[2].toUpperCase() });
    return { risposte, dubbie, chiare };
  }

  // Un segmento per risposta: "8:b", "13: mi sembra e", oppure solo la lettera in ordine.
  let prossimo = 1;
  let trovatiNumeri = false;
  for (const s of segmenti) {
    const conNumero = s.match(/^(?:domanda\s*)?(\d{1,2})\s*[).:=\-–]?\s*(.*)$/i);
    if (conNumero && (conNumero[2] === '' || !/^\d/.test(conNumero[2]))) {
      const n = Number(conNumero[1]);
      const esito = interpreta(conNumero[2]) ?? { dubbia: '(vuota)' };
      // "mi sembra e": il dubbio dichiarato vale come riga da confermare
      segna(n, /\bmi sembra\b|\bforse\b|\bcredo\b|\bnon sono sicur/i.test(conNumero[2]) && 'lettera' in esito ? { dubbia: conNumero[2] } : esito);
      if ('lettera' in esito || 'dubbia' in esito) trovatiNumeri = true;
      prossimo = n + 1;
      continue;
    }
    // senza numero: e' la risposta successiva, ma solo se sembra una risposta
    const esito = interpreta(s);
    if (!esito) continue;
    // una frase prima della prima risposta ("scrivo in ordine i risultati") non e' una risposta
    const primaRisposta = !trovatiNumeri && !Object.keys(risposte).length && !dubbie.length;
    if ('dubbia' in esito && !NON_SO.test(s) && primaRisposta) continue;
    segna(prossimo, esito);
    prossimo++;
  }
  // una "risposta" dubbia per messaggi qualunque (una frase sola) non conta
  if (!chiare && !trovatiNumeri && segmenti.length < 3) return { risposte: {}, dubbie: [], chiare: 0 };
  return { risposte, dubbie, chiare };
}

/** Lo studente conferma che le righe dubbie sono "non date" ("contale come non date", "sì, non date"). */
export function confermaNonDate(messaggio: string): boolean {
  return /\bnon\s+dat[ea]\b|\bcontal[ea]\s+(?:come\s+)?(?:non|vuot|bianc)|\bin\s+bianco\b|\blasciat[ea]\s+(?:vuot|in\s+bianco)/i.test(messaggio);
}

// ---------- la correzione ----------

export type StatoCorrezione = {
  /** id del messaggio di Lode con il test */
  test_id: string;
  risposte: Record<string, string | null>;
  /** numeri ancora da confermare */
  da_confermare: number[];
  completa: boolean;
  risultato?: Risultato;
};

export type Esito = 'giusta' | 'sbagliata' | 'non_data';
export type Risultato = {
  giuste: number;
  sbagliate: number;
  non_date: number;
  punteggio: number;
  massimo: number;
  formato: FormatoPunteggio;
  righe: { n: number; data: string | null; giusta: string; esito: Esito; penalita: boolean }[];
};

export function leggiCorrezione(metadati: unknown): StatoCorrezione | null {
  const c = metadati && typeof metadati === 'object' ? (metadati as Record<string, unknown>).correzione : null;
  if (!c || typeof c !== 'object') return null;
  const s = c as Partial<StatoCorrezione>;
  if (typeof s.test_id !== 'string' || !s.risposte || typeof s.risposte !== 'object') return null;
  return {
    test_id: s.test_id,
    risposte: s.risposte as Record<string, string | null>,
    da_confermare: Array.isArray(s.da_confermare) ? s.da_confermare.filter((n) => typeof n === 'number') : [],
    completa: s.completa === true,
    risultato: s.risultato,
  };
}

/** L'ultima correzione di questo test negli ultimi messaggi di Lode. */
export function correzioneDaStorico(storico: { ruolo: string; metadati?: unknown }[], testId: string): StatoCorrezione | null {
  for (let i = storico.length - 1; i >= 0; i--) {
    if (storico[i].ruolo !== 'assistant') continue;
    const c = leggiCorrezione(storico[i].metadati);
    if (c && c.test_id === testId) return c;
  }
  return null;
}

/** Giuste, sbagliate, non date e punteggio: li calcola il codice, mai il modello. */
export function calcolaRisultato(chiave: ChiaveTest, risposte: Record<string, string | null>): Risultato {
  const numeri = Object.keys(chiave.chiave).map(Number).sort((a, b) => a - b);
  const righe: Risultato['righe'] = [];
  let giuste = 0;
  let sbagliate = 0;
  let nonDate = 0;
  let punteggio = 0;
  for (const n of numeri) {
    const giusta = chiave.chiave[String(n)];
    const data = risposte[String(n)] ?? null;
    const penalita = chiave.formato === 'tolc' && !chiave.senza_penalita.includes(n);
    let esito: Esito;
    if (!data) {
      esito = 'non_data';
      nonDate++;
    } else if (data === giusta) {
      esito = 'giusta';
      giuste++;
      punteggio += 1;
    } else {
      esito = 'sbagliata';
      sbagliate++;
      if (penalita) punteggio -= 0.25;
    }
    righe.push({ n, data, giusta, esito, penalita });
  }
  return { giuste, sbagliate, non_date: nonDate, punteggio, massimo: numeri.length, formato: chiave.formato, righe };
}

/** 14.25 -> "14,25"; 14 -> "14". */
export function numeroIt(x: number): string {
  return (Math.round(x * 100) / 100).toString().replace('.', ',').replace('-', '−');
}

/** La riga del risultato che il codice mette in testa alla correzione. */
export function rigaRisultato(r: Risultato, markdown: boolean): string {
  const regola =
    r.formato === 'tolc'
      ? r.righe.some((x) => !x.penalita)
        ? 'TOLC: +1 giusta, −0,25 sbagliata, 0 non data; senza penalità dove previsto'
        : 'TOLC: +1 giusta, −0,25 sbagliata, 0 non data'
      : '+1 giusta, 0 sbagliata o non data';
  const punti = `${numeroIt(r.punteggio)} su ${r.massimo}`;
  const testa = markdown ? `**Risultato: ${punti}**` : `Risultato: ${punti}`;
  return `${testa} — ${r.giuste} giuste, ${r.sbagliate} sbagliate, ${r.non_date} non date (${regola}).`;
}

/** L'istruzione per il modello: la correzione e' gia' fatta, lui spiega soltanto. */
export function istruzioneCorrezione(r: Risultato): string {
  const righe = r.righe
    .map((x) => `${x.n}) data ${x.data ?? '—'}, giusta ${x.giusta}: ${x.esito === 'giusta' ? 'GIUSTA' : x.esito === 'sbagliata' ? 'SBAGLIATA' : 'NON DATA'}`)
    .join('\n');
  return `CORREZIONE GIÀ CALCOLATA DAL CODICE (confronto tra le risposte dello studente e la chiave del test che hai scritto tu). Questi esiti e questi numeri sono definitivi:
${righe}
Totale: ${r.giuste} giuste, ${r.sbagliate} sbagliate, ${r.non_date} non date. Punteggio ${numeroIt(r.punteggio)} su ${r.massimo}.
La riga con il risultato la mette l'app in testa al tuo messaggio: tu NON scrivi il punteggio né i totali, NON ricontare, NON cambiare nessun esito. Spiega SOLO le domande sbagliate e quelle non date, in ordine, una per blocco che comincia con il numero della domanda: il passaggio che si è rotto e quello giusto, in breve. Poi, in una o due frasi, su cosa lavorare prima.`;
}

/** Il messaggio (scritto dal codice, senza modello) che chiede di confermare solo le righe dubbie. */
export function messaggioConferma(
  dubbie: { n: number; scritto: string }[],
  mancanti: number[],
  markdown: boolean
): string {
  const righe: string[] = [];
  for (const d of dubbie) {
    righe.push(`${markdown ? `**${d.n})**` : `${d.n})`} hai scritto «${d.scritto}»: quale lettera, oppure la conto come non data?`);
  }
  if (mancanti.length) righe.push(`Mi mancano le risposte a: ${mancanti.join(', ')}.`);
  return `Prima di contare il punteggio mi servono solo queste righe, così non sbaglio un numero:\n\n${righe.join('\n')}\n\nScrivimele col numero davanti (es. "${dubbie[0]?.n ?? mancanti[0] ?? 7}-B"). Se una non l'hai data, scrivi "non data".`;
}

export type DecisioneCorrezione =
  | { tipo: 'nessuna' }
  | { tipo: 'conferma'; testo: string; stato: StatoCorrezione }
  | { tipo: 'risultato'; risultato: Risultato; stato: StatoCorrezione };

/**
 * Il messaggio dello studente e' (anche) una consegna di risposte al test attivo?
 * Se si': unisce le risposte a quelle gia' date, e o chiede di confermare le
 * righe dubbie, o calcola il risultato.
 */
export function decidiCorrezione(
  messaggio: string,
  testId: string,
  chiave: ChiaveTest,
  precedente: StatoCorrezione | null,
  markdown: boolean
): DecisioneCorrezione {
  const numeri = Object.keys(chiave.chiave).map(Number).sort((a, b) => a - b);
  const lettura = leggiRisposte(messaggio);
  const inSospeso = precedente && precedente.test_id === testId && !precedente.completa ? precedente : null;
  const aggiorna = precedente && precedente.test_id === testId ? precedente : null;
  const nonDate = !!inSospeso && inSospeso.da_confermare.length > 0 && confermaNonDate(messaggio) && lettura.chiare === 0;
  // Dopo il risultato, una lettera sola cambia la correzione solo se lo dice ("alla 12 ho risposto b").
  const correggeUna = /\bho\s+(?:risposto|messo|dato|scelto)\b|\bavevo\b|\bcorreggi\b|\brisposta\b/i.test(messaggio);
  const consegna =
    lettura.chiare >= 3 || (!!inSospeso && lettura.chiare >= 1) || (!!aggiorna && lettura.chiare >= 1 && correggeUna) || nonDate;
  if (!consegna) return { tipo: 'nessuna' };

  const risposte: Record<string, string | null> = { ...(aggiorna?.risposte ?? {}) };
  for (const [n, l] of Object.entries(lettura.risposte)) if (numeri.includes(Number(n))) risposte[n] = l;
  let dubbie = lettura.dubbie.filter((d) => numeri.includes(d.n) && !(String(d.n) in lettura.risposte));
  // le righe in sospeso dal giro prima restano da confermare, se non arrivano ora
  const sospese = (inSospeso?.da_confermare ?? []).filter((n) => !(String(n) in lettura.risposte) && !dubbie.some((d) => d.n === n));
  if (nonDate) {
    for (const n of sospese) risposte[String(n)] = null;
    for (const d of dubbie) risposte[String(d.n)] = null;
    dubbie = [];
  } else {
    for (const n of sospese) if (!dubbie.some((d) => d.n === n)) dubbie.push({ n, scritto: 'da confermare' });
  }
  for (const d of dubbie) delete risposte[String(d.n)];
  const mancanti = numeri.filter((n) => !(String(n) in risposte) && !dubbie.some((d) => d.n === n));
  dubbie.sort((a, b) => a.n - b.n);
  if (dubbie.length || mancanti.length) {
    return {
      tipo: 'conferma',
      testo: messaggioConferma(dubbie, mancanti, markdown),
      stato: { test_id: testId, risposte, da_confermare: [...dubbie.map((d) => d.n), ...mancanti], completa: false },
    };
  }
  const risultato = calcolaRisultato(chiave, risposte);
  return { tipo: 'risultato', risultato, stato: { test_id: testId, risposte, da_confermare: [], completa: true, risultato } };
}
