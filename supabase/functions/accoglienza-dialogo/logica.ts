// Logica PURA del dialogo di accoglienza: niente rete, niente Deno, niente React.
// La usano la Edge Function (index.ts), l'app (lib/dialogoLogica.ts) e i test:
// le regole stanno qui, in un posto solo, e stanno nel CODICE, non nel prompt.
//
// Come funziona il dialogo:
// - a ogni turno il modello riceve tutta la conversazione, il profilo raccolto,
//   le chiavi che mancano e la data di oggi;
// - da ogni risposta si estraggono TUTTE le chiavi che contiene, non solo quella
//   chiesta;
// - la domanda successiva e' la prima chiave ancora vuota, in ordine di
//   priorita', che non sia gia' stata chiesta. Quando non manca niente il
//   dialogo finisce, anche dopo un messaggio. Cinque domande sono il massimo;
// - ogni chiave salva SEMPRE le parole dello studente. Data, minuti e livello
//   sono facoltativi: se non si riesce a normalizzare resta il testo, e la
//   chiave conta come risposta. Null vuol dire solo "non ne ha parlato" o "ha
//   saltato la domanda";
// - OGNI chiusura contiene un impegno di Lode: un'azione concreta che Lode fa in
//   chat ("ti preparo una mini-simulazione..."), mai un consiglio da seguire da
//   soli. Se il modello non lo scrive la function lo richiede una volta, poi usa
//   un impegno fisso coerente con l'esame. L'impegno si salva nel profilo
//   ("da_mantenere") e la chat lo mantiene scrivendo lei per prima;
// - si chiude subito, con l'impegno, se lo studente chiede aiuto, oppure se
//   l'esame e' entro 14 giorni e dice di essere in difficolta' ("sono messo
//   male"): con pochi giorni davanti ogni domanda in piu' e' tempo rubato. Le
//   chiavi mancanti vanno in coda;
// - i nomi degli esami si scrivono bene anche se lo studente li scrive male
//   ("tolc i" -> "TOLC-I"), nel profilo e nelle battute;
// - due non-risposte di fila ("boh", "mah", "no", niente, o una domanda saltata
//   col tasto "Salta"): si chiude con garbo, senza altre domande, e le chiavi
//   mancanti vanno in coda. Il salto resta nelle note come risposta SALTATA,
//   cosi' conta anche per la function, che riceve la conversazione intera;
// - nessuna battuta comincia con "Va bene," o un'altra formula di avvio;
// - massimo tre frasi per battuta; mai una risposta che fa solo da ricevuta.

export const MODELLO = 'claude-sonnet-5-5';
export const MAX_DOMANDE = 5;
export const MAX_FRASI = 3;

import { sezioniManuale } from '../_shared/manuale.ts';
import {
  CHIAVI,
  DOMANDE_FISSE,
  type Chiave,
  type EsameElenco,
  type Impegno,
  type Livello,
  type Messaggio,
  type ProfiloStudio,
  haRisposta,
  mancanti,
  normalizza,
  oggetto,
  pulisci,
} from './profilo.ts';

export * from './profilo.ts';

// ---------- testo ----------

/** Spezza in frasi sul punto fermo, esclamativo, interrogativo o sui puntini. */
export function frasi(testo: string): string[] {
  return testo
    .split(/(?<=[.!?…])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

function primeFrasi(testo: string, quante: number): string {
  return frasi(testo).slice(0, quante).join(' ');
}

/** Una frase sola con esattamente un punto interrogativo, altrimenti "". */
function unaDomanda(testo: string): string {
  const tutte = frasi(testo);
  const ultima = tutte[tutte.length - 1] ?? '';
  return (ultima.match(/\?/g) ?? []).length === 1 && ultima.endsWith('?') ? ultima : '';
}

/** Frasi che fanno solo da ricevuta ("Ok, segnato."): vietate, si scartano. */
const RICEVUTA =
  /^(ok|okay|va bene|capito|ho capito|ricevuto|perfetto|bene|d'accordo|chiaro|tutto chiaro)?[\s,.!]*(segnato|annotato|preso nota|ho segnato|me lo segno|ne prendo nota)?[\s,.!]*$/i;

/** La reazione: al massimo `quante` frasi, senza domande e senza ricevute. */
function reazionePulita(testo: string, quante: number): string {
  return frasi(testo)
    .filter((f) => !f.includes('?') && !RICEVUTA.test(f))
    .slice(0, quante)
    .join(' ');
}

const NON_RISPOSTA =
  /^(boh+|bo|mah+|no+|non (lo )?so|non saprei|niente|nulla|nessuno|vedremo|dopo|non mi va|[?.\-\s]+)[\s.!?]*$/i;

/** Cio' che resta nelle note (e nella conversazione) quando lo studente salta la domanda. */
export const SALTATA = '[domanda saltata]';

/** "boh", "mah", "no", una stringa vuota, una domanda saltata: lo studente non ha risposto. */
export function nonRisposta(testo: unknown): boolean {
  const t = pulisci(testo, 1000);
  return t === '' || t === SALTATA || NON_RISPOSTA.test(t);
}

/**
 * Due non-risposte di fila (questa e la precedente dello studente): non si
 * insiste, il dialogo si chiude. Si decide dalla conversazione, prima ancora di
 * chiamare il modello.
 */
export function dueNonRisposte(conversazione: Messaggio[]): boolean {
  const sue = conversazione.filter((m) => m.ruolo === 'user');
  return (
    sue.length >= 2 &&
    nonRisposta(sue[sue.length - 1].contenuto) &&
    nonRisposta(sue[sue.length - 2].contenuto)
  );
}

/** Formule di avvio che non dicono niente: una battuta comincia dalla cosa detta dallo studente. */
const AVVIO = /^(va bene|ok|okay|d'accordo|certo|capito|ho capito|bene|perfetto|allora)\s*[,.!:;]+\s*/i;

export function senzaAvvio(testo: string): string {
  let t = testo.trim();
  for (let i = 0; i < 3 && AVVIO.test(t); i++) t = t.replace(AVVIO, '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// ---------- l'impegno di Lode ----------

/**
 * L'impegno e' un'azione che fa LODE, in chat: "ti preparo...", "ti scrivo...".
 * Un consiglio da seguire da solo ("un primo giro serio, col telefono fuori
 * dalla stanza") o una promessa vaga ("ti aiuto", "ti seguo") non lo sono.
 */
const AZIONE_DI_LODE =
  /\bti\s+(?:(?:lo|la|li|le|ne)\s+)?(preparo|preparer[oò]|faccio|far[oò]|scrivo|scriver[oò]|mando|mander[oò]|propongo|proporr[oò]|costruisco|costruir[oò]|organizzo|organizzer[oò]|imposto|imposter[oò]|spiego|spiegher[oò]|metto|metter[oò]|do|dar[oò])\b/i;

/** Il testo e' un impegno che Lode puo' mantenere in chat? */
export function impegnoDiLode(testo: unknown): boolean {
  const t = pulisci(testo, 300);
  return t.length >= 10 && !t.includes('?') && AZIONE_DI_LODE.test(t);
}

/** L'impegno fisso quando il modello non ne scrive uno valido: coerente con l'esame, se c'e'. */
export function impegnoDiRipiego(nomeEsame: string | null): string {
  return nomeEsame
    ? `Ti preparo subito in chat una mini-simulazione di ${nomeEsame} da 10 domande, per capire da dove partire.`
    : 'Ti preparo subito in chat un piano per i prossimi giorni, da cui partiamo insieme.';
}

// ---------- urgenza ----------

/** Oltre questa distanza dall'esame una difficolta' dichiarata non chiude il dialogo. */
export const GIORNI_URGENZA = 14;

/** "Sono messo male", "sono indietro", "non ce la faccio": lo studente dice di essere in difficolta'. */
const DIFFICOLTA =
  /\b(messo|messa) male\b|\bindietro\b|\bnon ce la (faccio|far[oò])\b|\bin difficolt[aà]\b|\bnon (so|ho studiato|ho fatto) (niente|nulla)\b|\bnon sono (pront[oa]|preparat[oa])\b|\bnel panico\b|\bdisperat[oa]\b|\bnon capisco (niente|nulla)\b/i;

/** In un messaggio qualunque della conversazione lo studente ha detto di essere in difficolta'? */
export function inDifficolta(conversazione: Messaggio[]): boolean {
  return conversazione.some((m) => m.ruolo === 'user' && DIFFICOLTA.test(m.contenuto));
}

function giorniTra(daIso: string, aIso: string): number {
  const g = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    return Date.UTC(a, m - 1, d) / 86_400_000;
  };
  return Math.round(g(aIso) - g(daIso));
}

/**
 * Giorni da oggi all'esame: dalla data certa se c'e', altrimenti dalla stima
 * del modello ("tra una settimana circa" -> 7). Null se non si sa.
 */
export function giorniAllEsame(p: ProfiloStudio, oggi: string, stima: unknown): number | null {
  if (p.quando.data && /^\d{4}-\d{2}-\d{2}$/.test(p.quando.data)) return giorniTra(oggi, p.quando.data);
  const n = Number(stima);
  return Number.isInteger(n) && n >= 0 && n <= 730 ? n : null;
}

// ---------- nomi degli esami ----------

const PAROLE_MINUSCOLE = new Set([
  'di', 'e', 'ed', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'a', 'al', 'alla', 'ai',
  'in', 'per', 'con', 'da', 'su', 'il', 'la', 'lo', 'le', 'gli', 'l',
]);
const ROMANO = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;
// Le sigle ufficiali CISIA: TOLC-I, TOLC-E, TOLC-S, TOLC-F, TOLC-B, TOLC-AV, TOLC-SU, TOLC-PSI, TOLC-LP, TOLC-SPS.
// "e" e' anche una congiunzione: vale come sigla solo in fondo al nome.
const TOLC = /(?<![\p{L}\d])tolc(?:[\s-]+(i|s|f|b|av|su|psi|lp|sps|e(?=\s*$))(?![\p{L}\d]))?(?![\p{L}\d])/giu;

function siglaTolc(testo: string): string {
  return testo.replace(TOLC, (_, sigla?: string) => (sigla ? `TOLC-${sigla.toUpperCase()}` : 'TOLC'));
}

/**
 * Il nome dell'esame scritto bene: iniziali maiuscole, preposizioni minuscole,
 * numeri romani maiuscoli ("fisica generale ii" -> "Fisica Generale II", "basi
 * di dati" -> "Basi di Dati"). Se lo studente ha gia' usato delle maiuscole,
 * resta com'e'. Le sigle TOLC sono sempre quelle ufficiali ("tolc i" -> "TOLC-I").
 */
export function nomeEsameCorretto(nome: string): string {
  const t = siglaTolc(nome.replace(/\s+/g, ' ').trim());
  if (!t || /\p{Lu}/u.test(t)) return t;
  let n = 0;
  return t.replace(/[\p{L}\d]+/gu, (parola) => {
    const primo = n++ === 0;
    if (!primo && ROMANO.test(parola)) return parola.toUpperCase();
    if (!primo && PAROLE_MINUSCOLE.has(parola)) return parola;
    return parola.charAt(0).toUpperCase() + parola.slice(1);
  });
}

function senzaSimboli(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Nella battuta ogni esame nominato si scrive come nel suo nome corretto ("tolc i" -> "TOLC-I"). */
export function correggiNomi(testo: string, nomi: (string | null)[]): string {
  let t = testo;
  for (const nome of nomi) {
    const parole = nome?.match(/[\p{L}\d]+/gu);
    if (!nome || !parole) continue;
    const modello = new RegExp(`(?<![\\p{L}\\d])${parole.map(senzaSimboli).join("[\\s'-]+")}(?![\\p{L}\\d])`, 'giu');
    t = t.replace(modello, nome);
  }
  return t;
}

// ---------- profilo ----------

/**
 * La prossima domanda: la prima chiave vuota che non sia gia' stata chiesta.
 * Null = il dialogo e' finito (non manca niente, o le domande sono finite).
 * E' QUESTO controllo, nel codice, a impedire di chiedere una cosa gia' detta
 * o di chiederla due volte.
 */
export function prossimaChiave(p: ProfiloStudio, chieste: Chiave[]): Chiave | null {
  if (chieste.length >= MAX_DOMANDE) return null;
  // "Quando lo devi dare" e "a che punto sei" hanno senso solo se si sa di quale
  // esame si parla: senza esame non si chiedono (restano vuote e vanno in coda).
  const senzaEsame = !haRisposta(p, 'esame_target');
  return (
    mancanti(p).find(
      (k) => !chieste.includes(k) && !(senzaEsame && (k === 'quando' || k === 'avanzamento'))
    ) ?? null
  );
}

/** Le chiavi gia' chieste, ricostruite dalle note (serve per riprendere un dialogo interrotto). */
export function chiesteDalleNote(p: ProfiloStudio): Chiave[] {
  const viste: Chiave[] = [];
  for (const n of p.note_libere) {
    if (n.chiave && (CHIAVI as readonly string[]).includes(n.chiave) && !viste.includes(n.chiave)) {
      viste.push(n.chiave);
    }
  }
  return viste;
}

/** La conversazione fin qui, ricostruita dalle note. */
export function conversazioneDalleNote(p: ProfiloStudio): Messaggio[] {
  return p.note_libere.flatMap((n) => [
    { ruolo: 'assistant' as const, contenuto: n.domanda },
    { ruolo: 'user' as const, contenuto: n.risposta },
  ]);
}

/** Dopo due non-risposte di fila: nessun rimprovero, e subito l'impegno. */
export const CHIUSURA_GARBATA = 'Le domande le lasciamo qui, nessun problema.';

/** La chiusura senza modello (ripiego o salto): una frase gentile, se serve, e l'impegno fisso. */
function chiusuraDiRipiego(profilo: ProfiloStudio, garbata: boolean): string {
  profilo.impegno = {
    testo: impegnoDiRipiego(profilo.esame_target.nome),
    stato: 'da_mantenere',
    il: new Date().toISOString(),
  };
  return [garbata ? CHIUSURA_GARBATA : '', profilo.impegno.testo].filter(Boolean).join(' ');
}

// ---------- date ----------

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** "AAAA-MM-GG" reale, altrimenti null. */
function dataReale(testo: string): string | null {
  const m = testo.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 ? testo.trim() : null;
}

function dataInParole(iso: string): string {
  const [, m, g] = iso.split('-').map(Number);
  return `${g} ${MESI[m - 1]}`;
}

// ---------- la richiesta al modello ----------

export type InputTurno = {
  nomeBot: string;
  /** AAAA-MM-GG, fuso italiano */
  oggi: string;
  /** tutta la conversazione: l'ultimo messaggio e' la risposta dello studente */
  conversazione: Messaggio[];
  /** il profilo raccolto PRIMA di questa risposta */
  profilo: ProfiloStudio;
  /** le chiavi gia' chieste, compresa quella a cui lo studente sta rispondendo */
  chieste: Chiave[];
  esami: EsameElenco[];
  libretto: { media: number | null; cfu: number };
};

/** Cio' che restituisce il modello (validato da elaboraTurno prima di usarlo). */
export type Grezzo = {
  reazione: string;
  chiede_aiuto: boolean;
  impegno: string;
  prossima_chiave: string;
  domanda_successiva: string;
  chiusura: string;
  esame_testo: string;
  esame_nome: string;
  esame_indice: number;
  quando_testo: string;
  quando_data: string;
  avanzamento_testo: string;
  avanzamento_livello: string;
  tempo_testo: string;
  tempo_minuti: number;
  ostacolo_testo: string;
  contesto_testo: string;
  giorni_all_esame: number;
  in_difficolta: boolean;
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'esame_testo', 'esame_nome', 'esame_indice', 'quando_testo', 'quando_data',
    'avanzamento_testo', 'avanzamento_livello', 'tempo_testo', 'tempo_minuti',
    'ostacolo_testo', 'contesto_testo', 'giorni_all_esame', 'in_difficolta',
    'chiede_aiuto', 'reazione', 'impegno', 'prossima_chiave', 'domanda_successiva', 'chiusura',
  ],
  properties: {
    esame_testo: { type: 'string', description: "Le parole ESATTE dell'ultimo messaggio con cui lo studente dice quale esame o prova deve dare. \"\" se non ne parla." },
    esame_nome: { type: 'string', description: "Solo il nome dell'esame, con le parole ESATTE dello studente (es. \"TOLC-I\"). \"\" se non ne parla." },
    esame_indice: { type: 'integer', description: "Numero dell'esame in <esami_noti> se intende chiaramente quello, altrimenti 0." },
    quando_testo: { type: 'string', description: "Le parole ESATTE con cui dice quando deve dare l'esame, anche vaghe. \"\" se non ne parla." },
    quando_data: { type: 'string', description: 'AAAA-MM-GG solo se indica un giorno preciso; senza anno usa la ricorrenza più vicina a oggi, ANCHE se è già passata. "" altrimenti.' },
    avanzamento_testo: { type: 'string', description: 'Le parole ESATTE con cui dice a che punto è con la preparazione. "" se non ne parla.' },
    avanzamento_livello: { type: 'string', enum: ['non_iniziato', 'a_meta', 'ripasso', 'sconosciuto'], description: 'Solo se si capisce con certezza, altrimenti "sconosciuto".' },
    tempo_testo: { type: 'string', description: 'Le parole ESATTE con cui dice quanto tempo ha per studiare. "" se non ne parla.' },
    tempo_minuti: { type: 'integer', description: 'Minuti al giorno solo se dà una quantità ("2/3 ore" → 150). 0 altrimenti.' },
    ostacolo_testo: { type: 'string', description: 'Le parole ESATTE con cui dice cosa lo ostacola o cosa va storto quando studia. "" se non ne parla.' },
    contesto_testo: { type: 'string', description: 'Le parole ESATTE con cui dice qualcosa della sua vita che pesa sullo studio (lavora, è pendolare, fuorisede...). "" se non ne parla.' },
    giorni_all_esame: { type: 'integer', description: "Quanti giorni mancano all'esame da oggi, ricavati da TUTTA la conversazione anche in modo approssimato (\"tra una settimana circa\" → 7). -1 se non si ricava." },
    in_difficolta: { type: 'boolean', description: 'true se in tutta la conversazione dice di essere in difficoltà con la preparazione ("sono messo male", "sono indietro", "non ce la faccio").' },
    chiede_aiuto: { type: 'boolean', description: "true SOLO se nell'ultimo messaggio chiede aiuto in modo esplicito." },
    reazione: { type: 'string', description: 'Una o due frasi che rispondono a quello che ha appena detto. Mai una domanda.' },
    impegno: { type: 'string', description: 'OBBLIGATORIO se prossima_chiave è "nessuna": UNA frase in prima persona con un\'azione concreta che fai TU in chat appena finita la conversazione ("Ti preparo..."). "" altrimenti.' },
    prossima_chiave: { type: 'string', enum: ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo', 'nessuna'], description: 'La chiave della prossima domanda, o "nessuna" se il dialogo finisce.' },
    domanda_successiva: { type: 'string', description: 'UNA frase: la domanda su prossima_chiave. "" se è "nessuna".' },
    chiusura: { type: 'string', description: 'Facoltativa, solo se prossima_chiave è "nessuna": UNA frase di consiglio che viene DOPO l\'impegno. "" altrimenti.' },
  },
} as const;

export const SYSTEM = `Sei l'assistente di studio dentro un'app per studenti universitari italiani. Stai conoscendo uno studente che ha appena aperto l'app. Non è un questionario: prima ascolti, poi, solo se serve, chiedi quello che manca.

Ricevi tutta la conversazione, quello che sai già, le cose che mancano e la data di oggi. Rispondi in JSON secondo lo schema.

COSA TI SERVE SAPERE (in quest'ordine di priorità)
1. esame_target: quale esame o prova deve dare per primo
2. quando: quando la deve dare
3. avanzamento: a che punto è con la preparazione
4. tempo_al_giorno: quanto tempo ha per studiare
5. ostacolo: cosa lo ostacola quando studia
In più "contesto" (lavora, è pendolare, fuorisede...): lo raccogli se ne parla, non lo chiedi mai.

ESTRARRE
- Dall'ultimo messaggio dello studente estrai TUTTO quello che contiene, non solo la risposta alla tua domanda. Se dice l'esame e anche la data, li prendi tutti e due.
- I campi *_testo sono citazioni: le parole ESATTE dello studente, copiate dal suo messaggio, senza correggere e senza riassumere. Se di una cosa non ha parlato, il campo resta "".
- Una risposta vaga è comunque una risposta: "sono indietro", "nel pomeriggio", "tra un po'" vanno copiate nel campo giusto. Data, minuti e livello li compili solo se sono certi; se non lo sono restano vuoti (""/0/sconosciuto) e va bene così.
- Una non-risposta ("boh", "non so", una battuta, una provocazione) non si estrae: il campo resta "".
- avanzamento_livello si compila solo se lo dice con parole equivalenti ("non ho ancora iniziato", "sono a metà", "sto ripassando"). "Sono indietro", "poco", "sto riprendendo le basi" restano "sconosciuto": conta il testo.
- Non dedurre e non inventare. Se non l'ha detto, non c'è.

LA BATTUTA
- reazione: una o due frasi che rispondono a quello che ha APPENA detto. Deve riprendere una cosa precisa del suo messaggio, con naturalezza. Non è mai una domanda.
- Prima si ascolta. Se dice di essere in difficoltà, di non sentirsi capace, di avere paura, di lavorare, di avere pochissimo tempo: la reazione risponde a QUELLO, non alla casella del questionario. Niente pacche sulle spalle e niente prediche: prendi sul serio quello che dice e digli una cosa utile o vera.
- Vietate le ricevute: "Ok", "Ok, segnato", "Capito", "Perfetto", "Bene" e ogni frase che potrebbe andare bene per qualunque risposta.
- La battuta comincia dalla cosa che ha detto lui, non da una formula: mai aprire con "Va bene,", "Ok,", "D'accordo,", "Certo,", "Allora,".
- Non attribuirgli MAI cose che non ha detto: niente date, voti, esami, numeri o stati d'animo che non siano nelle sue parole. Non fare calcoli sul tempo che manca.
- Se indica una data già passata rispetto a oggi, faglielo notare con gentilezza nella reazione, senza prenderla per buona e senza fargli il terzo grado.
- Italiano corretto, tono da compagno di corso sveglio, prima persona singolare, dai del tu. Testo semplice: niente markdown, elenchi, emoji.
- Esami: puoi nominare solo quelli in <esami_noti> o quello che lo studente ha scritto. <esami_noti> è un elenco parziale: se nomina un esame che non c'è, va bene così, non farglielo notare.
- Nelle tue frasi scrivi i nomi degli esami correttamente, con le maiuscole giuste, anche quando lo studente li scrive male: "tolc i" → "TOLC-I", "analisi 2" → "Analisi 2". (Nei campi *_testo ed esame_nome invece copi le sue parole esatte.)

LA DOMANDA SUCCESSIVA
- prossima_chiave è la PRIMA, nell'ordine di priorità, che dopo questo messaggio è ancora senza risposta e che non compare in <gia_chieste>. Una cosa già detta non si chiede. Una cosa già chiesta non si richiede, nemmeno se la risposta è stata vaga o non è arrivata.
- quando e avanzamento si chiedono solo se l'esame è noto: se dopo questo messaggio l'esame manca ancora, saltale e passa a tempo_al_giorno e poi a ostacolo.
- Se non ne resta nessuna, o se <domande_rimaste> è 0, prossima_chiave è "nessuna".
- domanda_successiva: UNA frase, una sola domanda, con parole tue, legata a quello che ha detto.

SE CHIEDE AIUTO
- Se nell'ultimo messaggio chiede aiuto in modo esplicito ("mi serve una mano", "un aiuto mi sarebbe utile", "mi aiuti?"), l'aiuto vince sul questionario: chiede_aiuto=true, prossima_chiave="nessuna", niente domanda, e chiudi con l'impegno.

SE L'ESAME È VICINO E LUI È IN DIFFICOLTÀ
- Se l'esame è entro 14 giorni da oggi e lo studente dice di essere in difficoltà ("sono messo male", "sono indietro", "non ce la faccio"), non si fanno altre domande: prossima_chiave="nessuna" e chiudi subito con l'impegno. Con pochi giorni davanti ogni domanda in più è tempo rubato.

SE NON VUOLE RISPONDERE
- Se <due_non_risposte_di_fila> è "sì", lo studente ha dato due non-risposte una dopo l'altra: non si insiste. prossima_chiave="nessuna", niente domanda, reazione "", e chiudi con l'impegno, senza rimprovero, senza ironia e senza dire che non ha risposto.

QUANDO IL DIALOGO SI CHIUDE (prossima_chiave "nessuna", per qualunque motivo)
- impegno è OBBLIGATORIO: UNA frase con un'azione che fai TU, in chat, appena finita questa conversazione. Una cosa concreta che prepari o scrivi per lui, legata all'esame e a quello che ha detto: una mini-simulazione con un numero preciso di domande, una serie di esercizi graduali su un argomento preciso, uno schema, il piano dei prossimi giorni. In prima persona: "Ti preparo…", "Ti scrivo…".
- L'impegno non è mai un consiglio che deve seguire da solo ("studia a blocchi", "metti via il telefono"), mai una promessa vaga ("ti aiuto", "ti seguo", "ti aspetto in chat") e non si rimanda: lo prepari adesso. Niente funzioni dell'app inventate.
- chiusura: facoltativa, UNA frase di consiglio che viene DOPO l'impegno e mai al suo posto. "" se non serve. Non è un riassunto.

In tutto la battuta non supera le tre frasi.`;

/** Le sezioni del manuale del professore che servono al dialogo: chi è, il lato umano, l'onestà. */
export const SEZIONI_MANUALE_DIALOGO = [1, 7, 8];

/**
 * Il system prompt del dialogo: le sezioni 1, 7 e 8 del manuale (col nome del
 * bot) e, dopo, le regole del dialogo, che hanno la precedenza.
 */
export function systemDialogo(nomeBot?: string | null): string {
  return `${sezioniManuale(SEZIONI_MANUALE_DIALOGO, nomeBot)}

---

ISTRUZIONI DEL DIALOGO (hanno la precedenza sul manuale: qui sono fissati il formato JSON della risposta, il numero di frasi e l'ordine delle domande; il manuale ti dice chi sei, come stare accanto allo studente e quando non inventare)

${SYSTEM}`;
}

function testoConversazione(conversazione: Messaggio[]): string {
  return conversazione
    .map((m) => `${m.ruolo === 'assistant' ? 'Tu' : 'Studente'}: ${m.contenuto}`)
    .join('\n');
}

/** Il messaggio di contesto per il modello: conversazione, profilo, chiavi mancanti, data di oggi. */
export function costruisciContesto(input: InputTurno): string {
  const p = input.profilo;
  const ultimo = input.conversazione[input.conversazione.length - 1]?.contenuto ?? '';
  const rimaste = Math.max(0, MAX_DOMANDE - input.chieste.length);
  return [
    `Ti chiami ${input.nomeBot}. Oggi è ${input.oggi}.`,
    `<libretto>media: ${typeof input.libretto.media === 'number' ? input.libretto.media.toFixed(2) : 'nessuna'}, CFU acquisiti: ${input.libretto.cfu}</libretto>`,
    `<esami_noti>\n${input.esami.length ? input.esami.map((e, i) => `${i + 1}. ${e.materia}`).join('\n') : '(nessuno in elenco)'}\n</esami_noti>`,
    `<gia_raccolto>${JSON.stringify({
      esame_target: p.esame_target.testo,
      quando: p.quando.testo,
      avanzamento: p.avanzamento.testo ?? p.avanzamento.livello,
      tempo_al_giorno: p.tempo_al_giorno.testo,
      ostacolo: p.ostacolo,
      contesto: p.contesto,
    })}</gia_raccolto>`,
    `<mancanti_prima_di_questo_messaggio>${mancanti(p).join(', ') || 'nessuna'}</mancanti_prima_di_questo_messaggio>`,
    `<gia_chieste>${input.chieste.join(', ') || 'nessuna'}</gia_chieste>`,
    `<domande_rimaste>${rimaste}</domande_rimaste>`,
    `<due_non_risposte_di_fila>${dueNonRisposte(input.conversazione) ? 'sì' : 'no'}</due_non_risposte_di_fila>`,
    `<esame_noto>${p.esame_target.nome ?? p.esame_target.testo ?? 'nessuno'}</esame_noto>`,
    `<conversazione>\n${testoConversazione(input.conversazione)}\n</conversazione>`,
    `<ultimo_messaggio_dello_studente>${ultimo}</ultimo_messaggio_dello_studente>`,
  ].join('\n');
}

/** Il corpo della chiamata a /v1/messages: risposta strutturata secondo lo schema. */
export function richiestaModello(input: InputTurno, system: string = systemDialogo(input.nomeBot)) {
  return {
    model: MODELLO,
    max_tokens: 1200,
    // Senza ragionamento esteso: questo modello lo attiva da solo, e sui messaggi
    // lunghi esauriva i token prima di arrivare alla risposta (oltre a rallentare).
    // Su questo modello si spegne cosi' ("disabled" viene rifiutato).
    thinking: { type: 'between_tools' },
    system,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: costruisciContesto(input) }],
  };
}

/**
 * La seconda (e ultima) richiesta quando il dialogo si chiude ma il modello non
 * ha scritto un impegno di Lode: stessa conversazione, con la correzione. Della
 * risposta si usa solo il campo impegno.
 */
export function richiestaRiprova(input: InputTurno, g: Grezzo, system: string = systemDialogo(input.nomeBot)) {
  const nota = `<riprova>Il dialogo si chiude adesso, ma quello che hai scritto non è un impegno che mantieni tu: "${pulisci(
    g.impegno,
    300
  )}". Riscrivi la risposta: impegno è OBBLIGATORIO, UNA frase in prima persona con una cosa concreta che prepari o scrivi per lui in chat appena finita questa conversazione (per esempio "Ti preparo subito in chat una mini-simulazione di ... da 15 domande, per capire da dove partire."). Il consiglio, se serve, va in chiusura.</riprova>`;
  return {
    ...richiestaModello(input, system),
    messages: [{ role: 'user', content: `${costruisciContesto(input)}\n${nota}` }],
  };
}

/** Estrae il JSON dalla risposta di /v1/messages. Null se non c'e' o non e' valido. */
export function leggiGrezzo(risposta: unknown): Grezzo | null {
  try {
    const blocchi = (oggetto(risposta).content ?? []) as { type?: string; text?: string }[];
    const testo = blocchi.find((b) => b?.type === 'text')?.text;
    if (!testo) return null;
    const g = JSON.parse(testo);
    return g && typeof g === 'object' && typeof g.reazione === 'string' ? (g as Grezzo) : null;
  } catch {
    return null;
  }
}

// ---------- il turno ----------

export type EsitoTurno = {
  risposta_bot: string;
  profilo: ProfiloStudio;
  /** le chiavi chieste dopo questo turno (compresa la prossima, se c'e') */
  chieste: Chiave[];
  /** la chiave della domanda contenuta in risposta_bot, null se il dialogo e' finito */
  prossima_chiave: Chiave | null;
  fine: boolean;
  /** true se si chiude perche' lo studente ha chiesto aiuto */
  aiuto: boolean;
  /** true se si chiude perche' l'esame e' vicino e lo studente e' in difficolta' */
  urgente?: boolean;
  /** true se il modello non ha scritto un impegno valido ed e' stato usato quello fisso */
  impegno_ripiego?: boolean;
};

/** Il testo e' fatto di parole che lo studente ha scritto davvero? */
function citazione(proposta: unknown, messaggio: string): string | null {
  const t = pulisci(proposta, 400);
  if (t.length < 2 || NON_RISPOSTA.test(t)) return null; // "non so", "boh": non sono risposte
  return normalizza(messaggio).includes(normalizza(t)) ? t : null;
}

/** true se il testo nomina un esame dell'elenco diverso dal target (o uno qualsiasi, se un target non c'e'). */
function nominaAltroEsame(testo: string, esami: EsameElenco[], nomeTarget: string | null): boolean {
  const t = ` ${normalizza(testo)} `;
  const target = nomeTarget ? normalizza(nomeTarget) : '';
  return esami.some((e) => {
    const n = normalizza(e.materia);
    return !!n && n !== target && t.includes(` ${n} `);
  });
}

function conNota(p: ProfiloStudio, input: InputTurno, risposta: string): ProfiloStudio {
  const messaggi = input.conversazione;
  const domanda = [...messaggi.slice(0, -1)].reverse().find((m) => m.ruolo === 'assistant')?.contenuto ?? '';
  return {
    ...p,
    note_libere: [
      ...p.note_libere,
      {
        domanda,
        risposta,
        il: new Date().toISOString(),
        chiave: input.chieste[input.chieste.length - 1] ?? null,
      },
    ],
  };
}

/**
 * Un turno del dialogo, dato cio' che ha restituito il modello. Tutto cio' che
 * conta e' deciso qui: cosa entra nel profilo, quale domanda si fa, quando si
 * chiude, quante frasi ha la battuta.
 */
export function elaboraTurno(input: InputTurno, g: Grezzo): EsitoTurno {
  const messaggio = pulisci(input.conversazione[input.conversazione.length - 1]?.contenuto, 1000);
  const chiesta = input.chieste[input.chieste.length - 1] ?? null;
  const prima = input.profilo;

  // 1) Estrazione: solo parole che lo studente ha scritto. Per la chiave appena
  // chiesta, se il modello dice che ha risposto ma la citazione non regge, si
  // tiene il messaggio intero; per le altre chiavi serve una citazione vera.
  const cita = (chiave: Chiave | 'contesto', proposta: unknown): string | null => {
    const c = citazione(proposta, messaggio);
    if (c) return c;
    const dichiarata = pulisci(proposta, 400).length >= 2;
    return dichiarata && chiave === chiesta && !NON_RISPOSTA.test(messaggio) ? messaggio.slice(0, 400) : null;
  };

  const p: ProfiloStudio = { ...prima };
  let dataPassata: string | null = null;

  const esameTesto = cita('esame_target', g.esame_testo);
  const scelto = input.esami[Number(g.esame_indice) - 1];
  if (esameTesto || scelto) {
    const citato = citazione(g.esame_nome, messaggio);
    const nome = scelto ? scelto.materia : citato ? nomeEsameCorretto(citato) : esameTesto;
    p.esame_target = { testo: esameTesto ?? nome, nome, id: scelto ? scelto.id : null };
  }

  const quandoTesto = cita('quando', g.quando_testo);
  if (quandoTesto) {
    let data = dataReale(String(g.quando_data ?? ''));
    const massimo = `${Number(input.oggi.slice(0, 4)) + 2}${input.oggi.slice(4)}`;
    if (data && data < input.oggi) {
      // Una data gia' passata non si registra come data: restano le sue parole.
      dataPassata = data;
      data = null;
    } else if (data && data > massimo) {
      data = null;
    }
    p.quando = { testo: quandoTesto, data: data ?? null };
  }

  const avanzTesto = cita('avanzamento', g.avanzamento_testo);
  if (avanzTesto) {
    const livello = ['non_iniziato', 'a_meta', 'ripasso'].includes(g.avanzamento_livello)
      ? (g.avanzamento_livello as Livello)
      : null;
    p.avanzamento = { testo: avanzTesto, livello };
  }

  const tempoTesto = cita('tempo_al_giorno', g.tempo_testo);
  if (tempoTesto) {
    const minuti = Number(g.tempo_minuti);
    p.tempo_al_giorno = {
      testo: tempoTesto,
      minuti: Number.isInteger(minuti) && minuti >= 5 && minuti <= 960 ? minuti : null,
    };
  }

  const ostacolo = cita('ostacolo', g.ostacolo_testo);
  if (ostacolo) p.ostacolo = ostacolo;

  const contesto = citazione(g.contesto_testo, messaggio);
  if (contesto) p.contesto = prima.contesto && prima.contesto !== contesto ? `${prima.contesto}; ${contesto}` : contesto;

  const profilo = conNota(p, input, messaggio);

  // 2) Cosa viene dopo: lo decide il codice sul profilo aggiornato.
  const aiuto = g.chiede_aiuto === true;
  // Due non-risposte di fila: non si fanno altre domande a chi non vuole rispondere.
  const basta = !aiuto && dueNonRisposte(input.conversazione);
  // Esame entro 14 giorni + difficolta' dichiarata: si chiude subito con l'impegno.
  const giorni = haRisposta(profilo, 'esame_target') ? giorniAllEsame(profilo, input.oggi, g.giorni_all_esame) : null;
  const urgente =
    !aiuto &&
    !basta &&
    giorni !== null &&
    giorni >= 0 &&
    giorni <= GIORNI_URGENZA &&
    (inDifficolta(input.conversazione) || g.in_difficolta === true);
  const prossima = aiuto || basta || urgente ? null : prossimaChiave(profilo, input.chieste);

  // 3) La battuta: reazione + (domanda | impegno | chiusura), mai piu' di tre frasi.
  const nomeTarget = profilo.esame_target.nome;
  const lecito = (pezzo: string) => (nominaAltroEsame(pezzo, input.esami, nomeTarget) ? '' : pezzo);
  let reazione = lecito(reazionePulita(pulisci(g.reazione, 500), MAX_FRASI - 1));
  if (dataPassata && !/passat/i.test(reazione)) {
    // Il modello non l'ha fatto notare: lo dice il codice, con garbo.
    reazione = [primeFrasi(reazione, 1), `Il ${dataInParole(dataPassata)} però è già passato: la data giusta la sistemiamo più avanti.`]
      .filter(Boolean)
      .join(' ');
  }

  let coda: string;
  let impegnoRipiego = false;
  if (prossima) {
    const delModello = g.prossima_chiave === prossima ? lecito(unaDomanda(pulisci(g.domanda_successiva, 300))) : '';
    coda = delModello || DOMANDE_FISSE[prossima];
  } else {
    // OGNI chiusura contiene un impegno di Lode, che la chat mantiene scrivendo
    // lei il primo messaggio. Il consiglio, se c'e', viene dopo e mai al suo posto.
    const proposto = lecito(reazionePulita(pulisci(g.impegno, 300), 1));
    impegnoRipiego = !impegnoDiLode(proposto);
    const testoImpegno = impegnoRipiego ? impegnoDiRipiego(nomeTarget) : proposto;
    const impegno: Impegno = { testo: testoImpegno, stato: 'da_mantenere', il: new Date().toISOString() };
    profilo.impegno = impegno;
    // Niente reazione a un "boh": solo una frase gentile prima dell'impegno.
    if (basta) reazione = CHIUSURA_GARBATA;
    const consiglio = basta ? '' : lecito(reazionePulita(pulisci(g.chiusura, 300), 1));
    const conConsiglio = consiglio && consiglio !== testoImpegno && !impegnoDiLode(consiglio);
    coda = [testoImpegno, conConsiglio ? consiglio : ''].filter(Boolean).join(' ');
  }
  const spazio = MAX_FRASI - frasi(coda).length;
  const nomi = [nomeTarget, ...input.esami.map((e) => e.materia)];
  const risposta_bot = correggiNomi(
    senzaAvvio([primeFrasi(reazione, Math.max(0, spazio)), coda].filter(Boolean).join(' ')) || coda,
    nomi
  );
  if (profilo.impegno && prossima === null) profilo.impegno = { ...profilo.impegno, testo: correggiNomi(profilo.impegno.testo, nomi) };

  return {
    risposta_bot,
    profilo,
    chieste: prossima ? [...input.chieste, prossima] : input.chieste,
    prossima_chiave: prossima,
    fine: prossima === null,
    aiuto,
    urgente,
    impegno_ripiego: prossima === null && impegnoRipiego,
  };
}

/**
 * Il turno quando il modello non risponde: nessuna estrazione, nessuna ricevuta.
 * Le parole dello studente valgono come risposta alla sola domanda fatta, si
 * passa alla domanda fissa successiva.
 */
export function turnoDiRipiego(input: InputTurno): EsitoTurno {
  const messaggio = pulisci(input.conversazione[input.conversazione.length - 1]?.contenuto, 1000);
  const chiesta = input.chieste[input.chieste.length - 1] ?? null;
  const p: ProfiloStudio = { ...input.profilo };
  if (chiesta && messaggio && !NON_RISPOSTA.test(messaggio)) {
    const testo = messaggio.slice(0, 400);
    if (chiesta === 'esame_target') p.esame_target = { testo, nome: null, id: null };
    else if (chiesta === 'quando') p.quando = { testo, data: null };
    else if (chiesta === 'avanzamento') p.avanzamento = { testo, livello: null };
    else if (chiesta === 'tempo_al_giorno') p.tempo_al_giorno = { testo, minuti: null };
    else p.ostacolo = testo;
  }
  const profilo = conNota(p, input, messaggio);
  const basta = dueNonRisposte(input.conversazione);
  const prossima = basta ? null : prossimaChiave(profilo, input.chieste);
  return {
    risposta_bot: prossima ? DOMANDE_FISSE[prossima] : chiusuraDiRipiego(profilo, basta),
    profilo,
    chieste: prossima ? [...input.chieste, prossima] : input.chieste,
    prossima_chiave: prossima,
    fine: prossima === null,
    aiuto: false,
  };
}

/**
 * Lo studente salta la domanda: nessuna risposta, si passa alla successiva. Il
 * salto si segna nelle note (risposta SALTATA) e conta come non-risposta: se
 * anche la risposta precedente era una non-risposta o un salto, il dialogo si
 * chiude con garbo invece di fare un'altra domanda.
 */
export function turnoSaltato(prima: ProfiloStudio, chieste: Chiave[], domanda = ''): EsitoTurno {
  const ultima = prima.note_libere[prima.note_libere.length - 1];
  const basta = !!ultima && nonRisposta(ultima.risposta);
  const profilo: ProfiloStudio = {
    ...prima,
    note_libere: [
      ...prima.note_libere,
      { domanda, risposta: SALTATA, il: new Date().toISOString(), chiave: chieste[chieste.length - 1] ?? null },
    ],
  };
  const prossima = basta ? null : prossimaChiave(profilo, chieste);
  return {
    risposta_bot: prossima
      ? `Nessun problema, ci torniamo. ${DOMANDE_FISSE[prossima]}`
      : chiusuraDiRipiego(profilo, basta),
    profilo,
    chieste: prossima ? [...chieste, prossima] : chieste,
    prossima_chiave: prossima,
    fine: prossima === null,
    aiuto: false,
  };
}
