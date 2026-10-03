// L'interrogazione guidata dal CODICE, come il dialogo di accoglienza: lo stato
// (a che domanda siamo, quando si chiude) lo tiene il codice, non il modello.
// Logica PURA: niente rete, niente Deno. Lo stato sta in
// chat_messages.metadati.interrogazione, scritto sull'ultimo messaggio di Lode.
//
// Come funziona:
// - inizia quando lo studente chiede di essere interrogato (o dice di si' a una
//   proposta di Lode); argomento e numero di domande (default 4) si leggono dal
//   messaggio;
// - a ogni turno il modello riceve "domanda N di MASSIMO": una domanda alla
//   volta, niente risposta giusta, niente voti;
// - il server controlla il turno: se contiene un voto o spiega la soluzione lo
//   fa rigenerare una volta con un richiamo; se ricapita toglie le frasi con
//   il voto;
// - alla domanda MASSIMO (dopo la risposta dello studente), o se lo studente
//   dice basta, il codice forza la chiusura: voto, cosa ha funzionato, cosa
//   mancava, le risposte giuste, su cosa lavorare.

export const DOMANDE_DEFAULT = 4;
export const DOMANDE_MIN = 2;
export const DOMANDE_MAX = 8;

export type StatoInterrogazione = {
  attiva: boolean;
  argomento: string;
  domande_fatte: number;
  massimo: number;
};

export type Fase = 'nessuna' | 'inizio' | 'domanda' | 'chiusura';

export type Decisione = {
  fase: Fase;
  /** lo stato da scrivere sul messaggio di Lode che risponde a questo turno */
  stato: StatoInterrogazione | null;
  /** l'istruzione del momento da passare al modello ("" se non c'e' interrogazione) */
  istruzione: string;
};

const NUOVA: StatoInterrogazione = { attiva: false, argomento: '', domande_fatte: 0, massimo: DOMANDE_DEFAULT };

/** Lo stato letto dai metadati di un messaggio (difensivo). Null se non c'e'. */
export function leggiStato(metadati: unknown): StatoInterrogazione | null {
  const m = (metadati && typeof metadati === 'object' ? (metadati as Record<string, unknown>).interrogazione : null) as
    | Record<string, unknown>
    | null;
  if (!m || typeof m !== 'object') return null;
  const n = (v: unknown, d: number) => (Number.isInteger(v) ? (v as number) : d);
  return {
    attiva: m.attiva === true,
    argomento: typeof m.argomento === 'string' ? m.argomento.slice(0, 120) : '',
    domande_fatte: Math.max(0, n(m.domande_fatte, 0)),
    massimo: Math.min(DOMANDE_MAX, Math.max(DOMANDE_MIN, n(m.massimo, DOMANDE_DEFAULT))),
  };
}

/** Lo stato in vigore: quello dell'ultimo messaggio di Lode che ne porta uno. */
export function statoDaStorico(storico: { ruolo: string; metadati?: unknown }[]): StatoInterrogazione | null {
  for (let i = storico.length - 1; i >= 0; i--) {
    if (storico[i].ruolo !== 'assistant') continue;
    return leggiStato(storico[i].metadati);
  }
  return null;
}

// ---------- quando inizia e quando finisce ----------

const CHIEDE_INTERROGAZIONE =
  /\binterrog(?:a|ami|armi|azione|are|hi)\b|\bfammi (?:delle |alcune |qualche |\d+ )?domande\b|\bsimulazione (?:di |dell')\s*(?:esame|orale|interrogazione)|\bsimula(?:mi)? (?:l')?(?:esame|orale)\b/i;
const ACCETTA = /^\s*(?:s[iì]|ok|okay|va bene|certo|volentieri|iniziamo|partiamo|pronto|pronta|dai|facciamo|d'accordo)(?![\p{L}])/iu;
const PROPONE = /\binterrog|\bsimulazione d'esame|\bdomande come all'esame/i;
// "basta" da solo NON vale: in un'esposizione si dice "basta che le parti siano d'accordo".
const BASTA =
  /^\s*(?:basta|stop)\b[\s.!]*$|\b(?:basta così|può bastare|per oggi basta|mi fermo|fermiamoci|finiamo qui|chiudiamo qui|smettiamo qui|non voglio più (?:continuare|rispondere)|non ne posso più di (?:domande|interrogazione))(?![\p{L}])/iu;

/** Lo studente chiede di essere interrogato, o accetta la proposta fatta da Lode nel messaggio prima. */
export function iniziaInterrogazione(messaggio: string, ultimoDiLode: string | null): boolean {
  if (CHIEDE_INTERROGAZIONE.test(messaggio)) return true;
  return !!ultimoDiLode && ACCETTA.test(messaggio) && messaggio.length < 60 && PROPONE.test(ultimoDiLode) && ultimoDiLode.trim().endsWith('?');
}

export function vuoleFermarsi(messaggio: string): boolean {
  return BASTA.test(messaggio);
}

/** "interrogami sui contratti" -> "contratti"; senza argomento esplicito, quello che si sa dell'esame. */
export function argomentoDa(messaggio: string, esame: string | null): string {
  const verbo = messaggio.match(CHIEDE_INTERROGAZIONE);
  const dopo = verbo ? messaggio.slice((verbo.index ?? 0) + verbo[0].length) : messaggio;
  const m = dopo.match(/\b(?:sui|sulle|sulla|sul|sullo|sugli|su|di|dello|della|degli|delle|del|dei)\s+([^.,?!;]{3,70})/i);
  const arg = (m?.[1] ?? '').trim();
  return (arg && !/^(?:tutto|qualcosa|un po)\b/i.test(arg) ? arg : esame ?? '').slice(0, 120);
}

/** "fammi 3 domande" / "tre domande": il numero chiesto, nei limiti. */
export function domandeChieste(messaggio: string): number {
  const parole: Record<string, number> = { due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8 };
  const m = messaggio.match(/\b(\d+|due|tre|quattro|cinque|sei|sette|otto)\s+domande\b/i);
  if (!m) return DOMANDE_DEFAULT;
  const n = parole[m[1].toLowerCase()] ?? Number(m[1]);
  return Math.min(DOMANDE_MAX, Math.max(DOMANDE_MIN, n || DOMANDE_DEFAULT));
}

// ---------- la decisione del turno ----------

/**
 * Cosa succede in questo turno, dato lo stato e il messaggio dello studente.
 * Decide il codice: il modello riceve solo l'istruzione.
 */
export function decidi(
  stato: StatoInterrogazione | null,
  messaggio: string,
  ultimoDiLode: string | null,
  esame: string | null,
  formato: 'testo' | 'markdown' = 'testo'
): Decisione {
  const attiva = !!stato && stato.attiva;
  if (!attiva) {
    if (!iniziaInterrogazione(messaggio, ultimoDiLode)) return { fase: 'nessuna', stato: stato && !stato.attiva ? stato : null, istruzione: '' };
    const massimo = domandeChieste(messaggio);
    const argomento = argomentoDa(messaggio, esame);
    return {
      fase: 'inizio',
      stato: { attiva: true, argomento, domande_fatte: 1, massimo },
      istruzione: istruzioneInizio(argomento, massimo),
    };
  }
  const s = stato!;
  if (vuoleFermarsi(messaggio) || s.domande_fatte >= s.massimo) {
    return {
      fase: 'chiusura',
      stato: { ...s, attiva: false },
      istruzione: istruzioneChiusura(s, vuoleFermarsi(messaggio), formato),
    };
  }
  const n = s.domande_fatte + 1;
  return {
    fase: 'domanda',
    stato: { ...s, domande_fatte: n },
    istruzione: istruzioneDomanda(s, n),
  };
}

export function istruzioneInizio(argomento: string, massimo: number): string {
  return `INTERROGAZIONE GUIDATA: INIZIA ADESSO
Lo studente ha chiesto di essere interrogato${argomento ? ` su: ${argomento}` : ''}. L'interrogazione ha ${massimo} domande e il conteggio lo tiene l'app.
Questo messaggio: annuncia in una frase che inizia l'interrogazione e fai la DOMANDA 1 di ${massimo}. Una domanda sola, formulata come un professore (al tu). Niente altro: non spiegare, non dare indizi.`;
}

export function istruzioneDomanda(s: StatoInterrogazione, n: number): string {
  return `INTERROGAZIONE GUIDATA: DOMANDA ${n} DI ${s.massimo}${s.argomento ? ` (argomento: ${s.argomento})` : ''}
Lo studente ha appena risposto alla domanda ${n - 1}. Questo messaggio fa la DOMANDA ${n} di ${s.massimo}.
- Una domanda sola. Puoi dire in UNA frase che la risposta era incompleta o imprecisa e chiedere di approfondire quel punto, oppure passare a un altro punto del programma o a un collegamento.
- NON dai la risposta giusta, NON spieghi, NON rifai la lezione, NON dai né anticipi voti, punteggi o giudizi numerici ("ti darei", "siamo sul 22"). Il voto arriva solo alla fine.
- Massimo due frasi prima della domanda.`;
}

export function istruzioneChiusura(s: StatoInterrogazione, perBasta: boolean, formato: 'testo' | 'markdown' = 'testo'): string {
  return `INTERROGAZIONE GUIDATA: CHIUDI ORA — PRIORITÀ ASSOLUTA
Questo messaggio è il GIUDIZIO FINALE. Comincia con la riga "Voto: NN/30" (NN = il tuo voto) e NON fare altre domande d'esame, anche se nella conversazione le domande venivano una alla volta.
${perBasta ? 'Lo studente ha chiesto di fermarsi.' : `Lo studente ha risposto all'ultima domanda (la ${s.domande_fatte} di ${s.massimo}).`} L'interrogazione finisce con questo messaggio: nessuna altra domanda d'esame.
Scrivi, in quest'ordine:
1. il voto in trentesimi, onesto, con una frase di motivazione (contenuto, completezza, lessico tecnico, capacità di collegare, chiarezza);
2. cosa ha funzionato;
3. cosa mancava per il voto successivo;
4. le risposte giuste alle domande in cui ha sbagliato o è stato incompleto: qui SÌ, spiegale;
5. su cosa lavorare adesso, con un'azione concreta.
Se ha risposto a poche domande dillo e dai un voto prudente.${
    formato === 'testo'
      ? "\nForma: testo semplice. Niente # e niente elenchi con trattini: ogni punto è un paragrafo che comincia con la sua etichetta (\"Voto:\", \"Cosa ha funzionato:\", \"Cosa mancava:\", \"Le risposte giuste:\", \"Su cosa lavorare:\")."
      : ''
  }`;
}

// ---------- i controlli sul turno ----------

const VOTO = [
  /\b(?:1[89]|2\d|30)\s*(?:\/|su)\s*30\b/i,
  /\b(?:1[89]|2\d|30)\s*[-–/]\s*(?:1[89]|2\d|30)\b/,
  /\bti darei\b/i,
  /\bti do (?:un |il )?(?:voto |punteggio )?(?:1[89]|2\d|30)\b/i,
  /\b(?:voto|punteggio|valutazione)\b[^.?!\n]{0,40}\b(?:1[89]|2\d|30)\b/i,
  /\b(?:sei|saresti|siamo|saremmo|staresti) (?:sul|su un|a un|intorno al|attorno al|al livello di un) (?:1[89]|2\d|30)\b/i,
  /\bnon (?:va|andresti) oltre (?:il|un) (?:1[89]|2\d)\b/i,
  /\b(?:sufficienza piena|trenta e lode)\b/i,
];

/** Il testo anticipa un voto? */
export function anticipaVoto(testo: string): boolean {
  return VOTO.some((re) => re.test(testo));
}

const SPIEGA = [
  /\bla (?:risposta|soluzione|definizione|formulazione) (?:giusta|corretta|esatta)\b/i,
  /\b(?:la )?risposta (?:giusta|corretta|esatta) (?:è|sarebbe)\b/i,
  /\bquella giusta\b/i,
  /\bin realt[aà](?![\p{L}])/iu,
  /\bil punto è che\b/i,
  /\bper (?:chiarire|spiegarti)\b/i,
  /\bti spiego\b/i,
  /(?<![\p{L}])è (?:invece|piuttosto) (?:la|il|l'|un|una)(?![\p{L}])/iu,
];

/** Il testo spiega o rivela la soluzione? (Euristica: formule tipiche, e troppe parole prima della domanda.) */
export function spiegaSoluzione(testo: string): boolean {
  if (SPIEGA.some((re) => re.test(testo))) return true;
  const parole = testo.trim().split(/\s+/).length;
  return parole > 85;
}

/** Il testo contiene un voto in trentesimi (serve alla chiusura: senza voto non e' una chiusura)? */
export function contieneVoto(testo: string): boolean {
  return /\b(?:1[89]|2\d|30)\s*(?:\/|su)\s*30\b|\bvoto\b[^.\n]{0,40}\b(?:1[89]|2\d|30)\b|\b(?:1[89]|2\d|30)\s+trentesimi\b/i.test(testo);
}

/** Ultima difesa: toglie dal testo le frasi che contengono un voto. */
export function senzaVoti(testo: string): string {
  return testo
    .split(/(?<=[.!?])\s+/)
    .filter((f) => !anticipaVoto(f))
    .join(' ')
    .trim();
}

export const STATO_VUOTO = NUOVA;
