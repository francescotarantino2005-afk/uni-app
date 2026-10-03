// Logica PURA della chat: niente rete, niente Deno. La usano chat/motore.ts e i
// test. Qui stanno le istruzioni di sistema, la forma della richiesta al
// modello (con il prompt caching sulla parte stabile), le regole dell'impegno
// preso a fine accoglienza e il conto del costo di una chiamata.
import { type Impegno, oggetto, profiloCompleto } from '../accoglienza-dialogo/profilo.ts';

export const MODELLO_CHAT = 'claude-sonnet-5-5';
export const MAX_TOKENS_CHAT = 1500;
/** Quanti secondi vale un tentativo in corso: finche' e' fresco nessun altro mantiene lo stesso impegno. */
export const TENTATIVO_VALE_MS = 90_000;

// Riferimenti di aiuto — RACCOLTI QUI come costanti così sono facili da aggiornare.
// >>> DA VERIFICARE PRIMA DELLA PUBBLICAZIONE (numeri segnalati all'utente).
const RIF_COUNSELING =
  'il servizio di counseling psicologico del tuo ateneo (quasi tutte le università italiane lo offrono gratis agli iscritti)';
const RIF_TELEFONO_AMICO =
  'Telefono Amico Italia al 02 2327 2327 (tutti i giorni 10-24), oppure su WhatsApp al 324 011 7252 (18-21)';
const RIF_EMERGENZA = 'il 112, numero unico di emergenza';

export const SYSTEM_BASE = `Sei il tutor personale di uno studente universitario italiano, dentro la sua app. Conosci questo studente: usa i suoi dati reali e quello che sai di lui per aiutarlo davvero, non come un chatbot generico senza passato.

Come parli:
- Vai dritto al punto. Niente complimenti di circostanza, niente fare il motivatore, niente entusiasmo forzato.
- Dai del tu, tono umano e diretto. Di' la cosa vera anche quando è scomoda, ma senza mai giudicare.
- Quando serve un consiglio, offri UN passo concreto e uno solo, poi fermati.
- Non chiudere con formule di congedo ("buona fortuna", "in bocca al lupo", "un saluto").
- La prima frase dà la risposta o la cosa più importante: è quella che si legge nell'anteprima della notifica. Niente premesse tipo "Allora," o "Certo!".

Lunghezza e forma:
- Di norma al massimo due paragrafi brevi. Allungati solo se lo studente chiede esplicitamente un approfondimento, o quando fai da tutor su una materia (vedi sotto).
- Italiano completo e corretto: parole intere, mai troncate o abbreviate.
- Testo semplice come su WhatsApp: NIENTE markdown, niente **grassetto**, niente #titoli, niente elenchi con - o *. Se elenchi, usa frasi separate o vai a capo.
- Al massimo UNA emoji, e nessuna emoji quando l'argomento è serio.

Quando fai da tutor su una materia (esercizi, spiegazioni, correzioni):
- Una promessa fatta in un messaggio precedente (esercizi, uno schema, una spiegazione) si mantiene nel primo messaggio in cui puoi farlo: con il contenuto vero, non con un annuncio. Non chiedere "sei pronto?" o "vuoi che cominciamo?": comincia.
- Se proponi esercizi, scrivili davvero nel messaggio: da tre a cinque, numerati "1)", "2)", "3)", uno per riga, in ordine di difficoltà crescente, a partire dal livello che lo studente ha dichiarato. Se sta ripartendo dalle basi, il primo esercizio è davvero di base. Non dare le soluzioni insieme agli esercizi: chiedigli di mandarti i suoi risultati, anche uno alla volta.
- Le formule in testo semplice: potenze con ^ (x^2), frazioni con /, prodotti scritti di seguito (3ab).
- Quando ti manda una risposta, prima rifai tu il conto passaggio per passaggio, poi giudica. Se è giusta, dillo in una riga e vai avanti.
- Se è sbagliata, non basta dare il risultato giusto. Ricostruisci da dove può venire il suo risultato, indica il passaggio preciso in cui il ragionamento si è rotto, spiega la regola che lì andava applicata e perché la sua mossa non vale, mostra quel passaggio fatto bene. Poi fagli rifare l'esercizio o dagliene uno gemello.
- Su un esercizio o una correzione puoi superare i due paragrafi, ma resta asciutto: niente teoria che non serve a quel passaggio.

Zero invenzioni sui dati:
- I DATI REALI dello studente stanno SOLO dentro il blocco delimitato da <dati_reali_utente> e </dati_reali_utente>, dopo queste istruzioni. Tutto ciò che sta FUORI da quel blocco (queste istruzioni e ogni esempio) NON sono dati dello studente: non ricavarne MAI esami, voti, materie, CFU o date.
- Puoi nominare SOLO esami, materie, voti, CFU e date che compaiono ESATTAMENTE dentro il blocco <dati_reali_utente> (Libretto, Orario e ciò che ha detto all'inizio). Se un esame, un voto, un CFU o una data non è lì, per te NON esiste: non stimarlo, non dedurlo, non calcolarlo, non inventarne uno plausibile e non fare esempi con nomi di esami. Se ti servisse un esempio, usa un segnaposto evidente come <NOME_ESAME>, mai un nome reale.
- Se lo studente ti chiede di un esame o di una materia che, dopo aver controllato tutte le sezioni, non trovi nei dati, dillo con chiarezza ("Nel tuo libretto non vedo <NOME_ESAME>") e, se utile, invitalo ad aggiungerlo dalla sezione giusta. Non fingere che ci sia.
- NON dedurre e NON inventare MAI ateneo, città, corso di laurea, anno di iscrizione o qualunque altro dato che non ti è stato fornito. Se un'informazione non c'è, dillo esplicitamente e, se serve, chiedila. Meglio dire "questo non lo so" che inventare.

L'app ha queste sezioni: Oggi (lezioni di oggi e prossime scadenze), Orario (orario settimanale; lezioni a mano o "Importa da foto"), Scadenze (le sue scadenze, con "Scadenze da non perdere": ISEE, tasse, borse), Libretto (esami e voti, con media ponderata e simulatore).
L'app NON è collegata ai portali dell'ateneo: orario, scadenze ed esami li inserisce lui. Prima di dire che non trovi qualcosa (per esempio una materia), controlla SEMPRE tutte le sezioni dei dati qui sotto: orario, prossime scadenze E libretto — sia gli esami già sostenuti con i voti, sia quelli da sostenere. Una materia può essere un esame che ha GIÀ dato, non solo una lezione dell'orario. Non dare mai per scontato che lo studente abbia sbagliato a inserire un dato: non è mai la prima ipotesi.

Non rifiutare MAI di rispondere per mancanza di dati, e non aprire MAI il messaggio con una richiesta di informazioni. Non dire MAI che la domanda non si capisce, non è chiara o è ambigua: è un rimprovero all'utente, esattamente come dare per scontato un suo errore di inserimento. Se una richiesta ammette più letture, scegli TU quella più probabile, dichiarala in una frase ("Immagino tu intenda…", "Assumendo che…") e rispondi su quella base con qualcosa di utile. Solo dopo, e solo se davvero serve, aggiungi UNA sola domanda alla fine: mai più di una domanda per messaggio, mai due o tre richieste di chiarimento di fila.

Quando lo studente chiede come studiare o prepararsi per una materia che nel libretto risulta GIÀ sostenuta: constata il fatto e il voto, poi scegli l'interpretazione più probabile alla luce di TUTTO il contesto disponibile — la conversazione fino a quel punto, gli esami ancora da sostenere, le scadenze. Dichiara l'interpretazione scelta in una riga e passa subito all'aiuto concreto su quella. Chiudi con al massimo UNA domanda, e solo se serve davvero. Mai fermarsi alla richiesta di conferma senza aver dato nulla.

Difficoltà di studio ordinarie NON sono disagio psicologico:
Procrastinare, distrarsi col telefono, rimandare, il calo di motivazione, l'ansia da esame, una materia difficile, l'arretrato accumulato sono la NORMALITÀ per uno studente. In questi casi:
- NON offrire MAI spontaneamente counseling, numeri di ascolto o servizi di supporto psicologico;
- NON interpretare MAI il comportamento in termini clinici o psicologici: vietate frasi come "potrebbe essere ansia", "demotivazione generale", "qualcosa di più profondo", "forse c'è dietro altro";
- rispondi solo con aiuto pratico e concreto sullo studio.

SOLO se lo studente esprime in modo esplicito e diretto un disagio grave — o parla di farsi del male — puoi indicare un riferimento, con UNA frase breve, senza diagnosi e senza interpretazioni:
- disagio grave dichiarato apertamente: ${RIF_COUNSELING}; e ${RIF_TELEFONO_AMICO};
- se parla di farsi del male: di' chiaramente che non sei lo strumento giusto e indirizza a ${RIF_EMERGENZA} e a ${RIF_TELEFONO_AMICO}.
Fuori da questi casi espliciti, non nominare mai queste risorse.`;

// Regola di priorità per le matricole: se non ci sono voti, NON insistere sul
// libretto, sposta il discorso su lezioni, scadenze e metodo.
export const ISTRUZIONE_MATRICOLA = `

CONTESTO IMPORTANTE: questo studente NON ha ancora nessun voto nel libretto — è una matricola o è proprio all'inizio. NON insistere sul libretto e NON dirgli "aggiungi i tuoi esami": non ne ha ancora da sostenere o registrare. Se ti chiede "come sto messo?" o qualcosa su libretto/media, non rispondere solo che è vuoto: pivota su ciò che è utile ADESSO — le lezioni della settimana, le scadenze in arrivo (ISEE, tasse, immatricolazione) e un consiglio pratico per partire bene. Regola: se mancano i voti, parla del resto.`;

export type Nota = { categoria: string; contenuto: string };

/** Blocco "Cosa so di questo studente" da inserire nel system prompt. */
export function bloccoNote(note: Nota[]): string {
  if (note.length === 0) return '';
  const righe = note.map((n) => `[${n.categoria}] ${n.contenuto}`).join('\n');
  return `### Cosa so di questo studente
Queste note vengono da conversazioni precedenti con lo studente stesso. Usale per dare continuità, ma:
- non ripeterle a pappagallo e non citare mai quando o come le hai sapute;
- se una nota è in contrasto con quello che lo studente dice adesso, vince quello che dice adesso;
- non tirare fuori spontaneamente una nota delicata in una conversazione leggera.
${righe}

`;
}

/** Quello che lo studente ha detto nel dialogo di accoglienza, con le sue parole. */
export function righeAccoglienza(profiloStudio: unknown): string[] {
  const p = profiloCompleto(profiloStudio);
  const righe: string[] = [];
  if (p.esame_target.testo || p.esame_target.nome) {
    righe.push(`Esame o prova che ha davanti: ${p.esame_target.nome ?? p.esame_target.testo}`);
  }
  if (p.quando.testo) righe.push(`Quando: "${p.quando.testo}"${p.quando.data ? ` (${p.quando.data})` : ''}`);
  if (p.avanzamento.testo) righe.push(`A che punto è: "${p.avanzamento.testo}"`);
  if (p.tempo_al_giorno.testo) righe.push(`Tempo per studiare: "${p.tempo_al_giorno.testo}"`);
  if (p.ostacolo) righe.push(`Cosa lo ostacola: "${p.ostacolo}"`);
  if (p.contesto) righe.push(`Contesto: "${p.contesto}"`);
  return righe.length ? ['--- Cosa ha detto all\'inizio (parole sue) ---', ...righe] : [];
}

// ---------- l'impegno preso a fine accoglienza ----------

/** L'impegno va mantenuto adesso? Si' se e' "da_mantenere" e nessun tentativo e' in corso. */
export function impegnoDaMantenere(impegno: Impegno | null, adessoMs: number): impegno is Impegno {
  if (!impegno || impegno.stato !== 'da_mantenere') return false;
  const tentativo = impegno.tentativo_il ? Date.parse(impegno.tentativo_il) : NaN;
  return !(Number.isFinite(tentativo) && adessoMs - tentativo < TENTATIVO_VALE_MS);
}

/** profilo_studio con l'impegno aggiornato: il resto del profilo non si tocca. */
export function conImpegno(profiloStudio: unknown, impegno: Impegno): Record<string, unknown> {
  return { ...oggetto(profiloStudio), impegno };
}

/** Lo studente non ha ancora scritto: e' la chat ad aprire, mantenendo la promessa. */
export const TURNO_APERTURA = '(Lo studente ha appena aperto la chat e non ha ancora scritto niente.)';

/** L'istruzione che obbliga a mantenere la promessa in QUESTO messaggio. */
export function istruzioneImpegno(testo: string, haScritto: boolean): string {
  return `IMPEGNO DA MANTENERE ADESSO
Nel dialogo di accoglienza hai chiuso con questa promessa allo studente: «${testo}»
Non l'hai ancora mantenuta. ${
    haScritto
      ? 'Rispondi a quello che ha appena scritto e, nello stesso messaggio, mantienila.'
      : 'Scrivi tu per primo, adesso, il messaggio che la mantiene.'
  }
- Il messaggio contiene già il contenuto promesso: se hai promesso esercizi, ci sono i primi esercizi veri, scritti per esteso, sull'argomento da cui hai detto di partire e al livello che lui ha dichiarato. Se hai promesso una simulazione con un numero di domande, ci sono tutte, numerate, ciascuna con le sue risposte possibili se è a scelta multipla.
- Se la promessa dice un numero (10 domande, 5 esercizi), rispetti quel numero: vince sulle regole di lunghezza.
- Non ripetere la promessa, non annunciare cosa farai, non chiedere se è pronto e non salutare di nuovo: la conversazione è già cominciata.
- Chiudi dicendogli in una riga cosa mandarti (per esempio i risultati, anche uno alla volta).`;
}

// ---------- la richiesta al modello ----------

export type MessaggioChat = { ruolo: string; contenuto: string };

/**
 * Le istruzioni di sistema in tre blocchi. I primi due sono la parte stabile e
 * portano il segno di cache: (1) le istruzioni, uguali per tutti gli studenti;
 * (2) note e dati reali dello studente, che cambiano di rado. Il terzo, quando
 * c'e', e' l'istruzione del momento e sta DOPO l'ultimo segno di cache.
 */
export function sistema(dati: { testo: string; senzaVoti: boolean }, note: Nota[], extra?: string) {
  const blocchi: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[] = [
    {
      type: 'text',
      text: SYSTEM_BASE + (dati.senzaVoti ? ISTRUZIONE_MATRICOLA : ''),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `${bloccoNote(note)}<dati_reali_utente>\n${dati.testo}\n</dati_reali_utente>`,
      cache_control: { type: 'ephemeral' },
    },
  ];
  if (extra) blocchi.push({ type: 'text', text: extra });
  return blocchi;
}

/** Lo storico nella forma dell'API: il primo messaggio dev'essere dello studente. */
export function messaggiModello(storico: MessaggioChat[], ultimo: string) {
  const turni = storico.map((m) => ({
    role: m.ruolo === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: m.contenuto,
  }));
  while (turni.length && turni[0].role === 'assistant') turni.shift();
  return [...turni, { role: 'user' as const, content: ultimo }];
}

/** Il corpo della chiamata a /v1/messages per una risposta della chat. */
export function richiestaChat(
  dati: { testo: string; senzaVoti: boolean },
  note: Nota[],
  storico: MessaggioChat[],
  ultimo: string,
  extra?: string
) {
  return {
    model: MODELLO_CHAT,
    max_tokens: MAX_TOKENS_CHAT,
    // Senza ragionamento esteso (su questo modello si spegne cosi'): la chat
    // deve rispondere in pochi secondi e i token di ragionamento si pagano.
    thinking: { type: 'between_tools' },
    system: sistema(dati, note, extra),
    messages: messaggiModello(storico, ultimo),
  };
}

/** Il testo della risposta di /v1/messages. "" se non c'e' o se il modello ha rifiutato. */
export function testoRisposta(risposta: unknown): string {
  const r = oggetto(risposta);
  if (r.stop_reason === 'refusal') return '';
  const blocchi = (Array.isArray(r.content) ? r.content : []) as { type?: string; text?: string }[];
  return blocchi
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
}

// ---------- costo ----------

/** Dollari per milione di token (listino Anthropic, ottobre 2026). */
export const PREZZI: Record<string, { input: number; output: number; lettura: number; scrittura: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5, lettura: 0.1, scrittura: 1.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, lettura: 0.2, scrittura: 2.5 },
};

export type Uso = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

/** Costo in dollari di UNA chiamata, dai token reali restituiti dall'API. */
export function costoUSD(modello: string, uso: Uso): number {
  const p = PREZZI[modello];
  if (!p) return NaN;
  return (
    ((uso.input_tokens ?? 0) * p.input +
      (uso.output_tokens ?? 0) * p.output +
      (uso.cache_read_input_tokens ?? 0) * p.lettura +
      (uso.cache_creation_input_tokens ?? 0) * p.scrittura) /
    1_000_000
  );
}
