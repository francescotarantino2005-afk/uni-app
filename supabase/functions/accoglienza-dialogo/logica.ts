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
// - se lo studente chiede aiuto in modo esplicito il dialogo si chiude con un
//   impegno concreto e le chiavi mancanti vanno in coda; l'impegno si salva nel
//   profilo ("da_mantenere") e la chat lo mantiene scrivendo lei per prima;
// - due non-risposte di fila ("boh", "mah", "no", niente, o una domanda saltata
//   col tasto "Salta"): si chiude con garbo, senza altre domande, e le chiavi
//   mancanti vanno in coda. Il salto resta nelle note come risposta SALTATA,
//   cosi' conta anche per la function, che riceve la conversazione intera;
// - nessuna battuta comincia con "Va bene," o un'altra formula di avvio;
// - massimo tre frasi per battuta; mai una risposta che fa solo da ricevuta.

export const MODELLO = 'claude-sonnet-5-5';
export const MAX_DOMANDE = 5;
export const MAX_FRASI = 3;

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

/** Chiusura di ripiego: nomina l'esame solo se c'e', e non finge di sapere cio' che non sa. */
export function chiusuraFissa(nomeEsame: string | null): string {
  return nomeEsame
    ? `Ora so da dove partire: ${nomeEsame}. Ci vediamo dentro.`
    : 'Quando vuoi, dimmi quale esame hai davanti e partiamo da lì.';
}

const IMPEGNO_FISSO = 'Partiamo da lì: ti aspetto in chat e cominciamo subito.';

/** Chiusura dopo due non-risposte di fila: nessun rimprovero, la porta resta aperta. */
export const CHIUSURA_GARBATA = 'Le domande le lasciamo qui: quando ti va, scrivimi in chat da cosa vuoi partire.';

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
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'esame_testo', 'esame_nome', 'esame_indice', 'quando_testo', 'quando_data',
    'avanzamento_testo', 'avanzamento_livello', 'tempo_testo', 'tempo_minuti',
    'ostacolo_testo', 'contesto_testo',
    'chiede_aiuto', 'reazione', 'impegno', 'prossima_chiave', 'domanda_successiva', 'chiusura',
  ],
  properties: {
    esame_testo: { type: 'string', description: "Le parole ESATTE dell'ultimo messaggio con cui lo studente dice quale esame o prova deve dare. \"\" se non ne parla." },
    esame_nome: { type: 'string', description: "Solo il nome dell'esame, con le parole ESATTE dello studente (es. \"Tolc I\"). \"\" se non ne parla." },
    esame_indice: { type: 'integer', description: "Numero dell'esame in <esami_noti> se intende chiaramente quello, altrimenti 0." },
    quando_testo: { type: 'string', description: "Le parole ESATTE con cui dice quando deve dare l'esame, anche vaghe. \"\" se non ne parla." },
    quando_data: { type: 'string', description: 'AAAA-MM-GG solo se indica un giorno preciso; senza anno usa la ricorrenza più vicina a oggi, ANCHE se è già passata. "" altrimenti.' },
    avanzamento_testo: { type: 'string', description: 'Le parole ESATTE con cui dice a che punto è con la preparazione. "" se non ne parla.' },
    avanzamento_livello: { type: 'string', enum: ['non_iniziato', 'a_meta', 'ripasso', 'sconosciuto'], description: 'Solo se si capisce con certezza, altrimenti "sconosciuto".' },
    tempo_testo: { type: 'string', description: 'Le parole ESATTE con cui dice quanto tempo ha per studiare. "" se non ne parla.' },
    tempo_minuti: { type: 'integer', description: 'Minuti al giorno solo se dà una quantità ("2/3 ore" → 150). 0 altrimenti.' },
    ostacolo_testo: { type: 'string', description: 'Le parole ESATTE con cui dice cosa lo ostacola o cosa va storto quando studia. "" se non ne parla.' },
    contesto_testo: { type: 'string', description: 'Le parole ESATTE con cui dice qualcosa della sua vita che pesa sullo studio (lavora, è pendolare, fuorisede...). "" se non ne parla.' },
    chiede_aiuto: { type: 'boolean', description: "true SOLO se nell'ultimo messaggio chiede aiuto in modo esplicito." },
    reazione: { type: 'string', description: 'Una o due frasi che rispondono a quello che ha appena detto. Mai una domanda.' },
    impegno: { type: 'string', description: 'Solo se chiede_aiuto: UNA frase con un impegno concreto su ciò che ha detto. "" altrimenti.' },
    prossima_chiave: { type: 'string', enum: ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo', 'nessuna'], description: 'La chiave della prossima domanda, o "nessuna" se il dialogo finisce.' },
    domanda_successiva: { type: 'string', description: 'UNA frase: la domanda su prossima_chiave. "" se è "nessuna".' },
    chiusura: { type: 'string', description: 'Solo se prossima_chiave è "nessuna" e non chiede aiuto: UNA frase di chiusura. "" altrimenti.' },
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
- Esami: puoi nominare solo quelli in <esami_noti> o quello che lo studente ha scritto, con le sue parole. <esami_noti> è un elenco parziale: se nomina un esame che non c'è, va bene così, non farglielo notare.

LA DOMANDA SUCCESSIVA
- prossima_chiave è la PRIMA, nell'ordine di priorità, che dopo questo messaggio è ancora senza risposta e che non compare in <gia_chieste>. Una cosa già detta non si chiede. Una cosa già chiesta non si richiede, nemmeno se la risposta è stata vaga o non è arrivata.
- quando e avanzamento si chiedono solo se l'esame è noto: se dopo questo messaggio l'esame manca ancora, saltale e passa a tempo_al_giorno e poi a ostacolo.
- Se non ne resta nessuna, o se <domande_rimaste> è 0, prossima_chiave è "nessuna".
- domanda_successiva: UNA frase, una sola domanda, con parole tue, legata a quello che ha detto.

SE CHIEDE AIUTO
- Se nell'ultimo messaggio chiede aiuto in modo esplicito ("mi serve una mano", "un aiuto mi sarebbe utile", "mi aiuti?"), l'aiuto vince sul questionario: chiede_aiuto=true, prossima_chiave="nessuna", niente domanda.
- impegno: UNA frase con un impegno concreto e preciso, costruito su quello che ha detto lui (per esempio l'argomento da cui ripartire). Niente promesse vaghe e niente funzioni dell'app inventate.

SE NON VUOLE RISPONDERE
- Se <due_non_risposte_di_fila> è "sì", lo studente ha dato due non-risposte una dopo l'altra: non si insiste. prossima_chiave="nessuna", niente domanda, reazione "" e chiusura = UNA frase gentile che chiude le domande e lascia la porta aperta, senza rimprovero, senza ironia e senza dire che non ha risposto.

LA CHIUSURA
- Se prossima_chiave è "nessuna" e non ha chiesto aiuto: chiusura è UNA frase che dice da dove si parte, scegliendo la cosa più importante. Non è un riassunto e non elenca tutto.

In tutto la battuta non supera le tre frasi.`;

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
    `<conversazione>\n${testoConversazione(input.conversazione)}\n</conversazione>`,
    `<ultimo_messaggio_dello_studente>${ultimo}</ultimo_messaggio_dello_studente>`,
  ].join('\n');
}

/** Il corpo della chiamata a /v1/messages: risposta strutturata secondo lo schema. */
export function richiestaModello(input: InputTurno, system: string = SYSTEM) {
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
  /** true se si chiude perche' lo studente ha chiesto aiuto: la chat si apre su quello */
  aiuto: boolean;
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
    const nome = scelto ? scelto.materia : citazione(g.esame_nome, messaggio) ?? esameTesto;
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
  const prossima = aiuto || basta ? null : prossimaChiave(profilo, input.chieste);

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
  if (aiuto) {
    coda = lecito(reazionePulita(pulisci(g.impegno, 300), 1)) || IMPEGNO_FISSO;
    // La promessa si salva: la chat la mantiene scrivendo lei il primo messaggio.
    const impegno: Impegno = { testo: coda, stato: 'da_mantenere', il: new Date().toISOString() };
    profilo.impegno = impegno;
  } else if (basta) {
    // Niente reazione a un "boh": solo la chiusura, del modello se e' pulita.
    reazione = '';
    coda = lecito(reazionePulita(pulisci(g.chiusura, 300), 1)) || CHIUSURA_GARBATA;
  } else if (prossima) {
    const delModello = g.prossima_chiave === prossima ? lecito(unaDomanda(pulisci(g.domanda_successiva, 300))) : '';
    coda = delModello || DOMANDE_FISSE[prossima];
  } else {
    coda = lecito(reazionePulita(pulisci(g.chiusura, 300), 1)) || chiusuraFissa(nomeTarget);
  }
  const spazio = MAX_FRASI - frasi(coda).length;
  const risposta_bot =
    senzaAvvio([primeFrasi(reazione, Math.max(0, spazio)), coda].filter(Boolean).join(' ')) || coda;

  return {
    risposta_bot,
    profilo,
    chieste: prossima ? [...input.chieste, prossima] : input.chieste,
    prossima_chiave: prossima,
    fine: prossima === null,
    aiuto,
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
    risposta_bot: prossima
      ? DOMANDE_FISSE[prossima]
      : basta
        ? CHIUSURA_GARBATA
        : chiusuraFissa(profilo.esame_target.nome),
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
      : basta
        ? CHIUSURA_GARBATA
        : chiusuraFissa(profilo.esame_target.nome),
    profilo,
    chieste: prossima ? [...chieste, prossima] : chieste,
    prossima_chiave: prossima,
    fine: prossima === null,
    aiuto: false,
  };
}
