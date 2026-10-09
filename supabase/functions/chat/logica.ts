// Logica PURA della chat: niente rete, niente Deno. La usano chat/motore.ts e i
// test. Qui stanno le istruzioni di sistema (il manuale del professore + le
// istruzioni tecniche dell'app), il contesto dello studente, la forma della
// richiesta al modello (con il prompt caching sulla parte stabile), le regole
// dell'impegno preso a fine accoglienza e il conto del costo di una chiamata.
import { TELEFONO_AMICO } from '../_shared/aiuto.ts';
import { manualeCompleto } from '../_shared/manuale.ts';
import { type Impegno, oggetto, profiloCompleto } from '../accoglienza-dialogo/profilo.ts';
import { formuleLeggibili } from './formule.ts';

export const MODELLO_CHAT = 'claude-sonnet-5-5';
export const MAX_TOKENS_CHAT = 1500;
/** Quanti secondi vale un tentativo in corso: finche' e' fresco nessun altro mantiene lo stesso impegno. */
export const TENTATIVO_VALE_MS = 90_000;

// Riferimenti di aiuto — RACCOLTI QUI come costanti così sono facili da aggiornare.
// >>> DA VERIFICARE PRIMA DELLA PUBBLICAZIONE (numeri segnalati all'utente).
const RIF_COUNSELING =
  'il servizio di counseling psicologico del tuo ateneo (quasi tutte le università italiane lo offrono gratis agli iscritti)';
const RIF_TELEFONO_AMICO = TELEFONO_AMICO;
const RIF_EMERGENZA = 'al 112 (numero unico di emergenza)';

/** Come l'app mostra i messaggi: testo semplice (build attuali) o Markdown leggero (app nuova). */
export type Formato = 'testo' | 'markdown';

const FORMATO_TESTO = `Formato del testo (la chat dell'app mostra testo semplice, non markdown):
- Niente markdown: niente **grassetto**, niente #titoli, niente elenchi con - o *, niente formule tra $...$. Separa con frasi e con a capo. Questo vale al posto delle indicazioni di formattazione della sezione 9 del manuale.
- Potenze, radici e simboli in Unicode anche in testo semplice: x², x³, √, ≤, ≥, ≠, ·, −, ×, π; mai ^ o *. Esponenti frazionari o composti come radici o apici: x^(1/2) si scrive √x, x^(3/2) si scrive x√x, x^(n−1) si scrive xⁿ⁻¹, x^(−1) si scrive x⁻¹ o 1/x. Frazioni con /, prodotti scritti di seguito (3ab) o con ·. Il codice è testo semplice, una riga per riga.
- Messaggi lunghi (piani di studio, simulazioni, schemi): niente muro di testo. Ogni blocco su una riga sua che comincia con la sua etichetta ("Lunedì 13:", "Domanda 3:"), una riga vuota tra un blocco e l'altro.`;

const FORMATO_MARKDOWN = `Formato del testo (la chat dell'app mostra Markdown leggero):
- Grassetto (**…**) solo per i concetti chiave; titoletti (## …) solo nei messaggi lunghi come simulazioni e piani; elenchi con -. Niente tabelle.
- Formule tra $...$ in notazione Unicode (3², x³, √, −, ·, ≤); mai ^ o *. Esponenti frazionari o composti come radici o apici: x^(1/2) si scrive √x, x^(3/2) si scrive x√x, x^(n−1) si scrive xⁿ⁻¹. Il codice va in blocchi di codice.
- Messaggi lunghi (piani di studio, simulazioni, schemi): i punti chiave devono risaltare a colpo d'occhio, niente muro di testo. In un piano ogni giorno è un blocco che COMINCIA con il giorno in grassetto (**Lunedì 13** — poi cosa fare, in una o due righe o in un breve elenco); in una simulazione ogni domanda comincia con **Domanda N**; scadenze, numeri e consegne importanti in grassetto. Una riga vuota tra un blocco e l'altro.`;

/** Le istruzioni tecniche dell'app: hanno la precedenza sul manuale. Il formato dipende dalla versione dell'app. */
export const istruzioniTecniche = (formato: Formato = 'testo') => `ISTRUZIONI TECNICHE DELL'APP
Questa parte ha la PRECEDENZA sul manuale: dove i due si contraddicono (formato del testo, impegni presi, dati dello studente) vale quello che leggi qui. Per tutto il resto — come si insegna, come si interroga, come si sta accanto allo studente — vale il manuale.

${formato === 'markdown' ? FORMATO_MARKDOWN : FORMATO_TESTO}
- Risposta multipla: la domanda, poi ogni opzione su una riga sua (A), B), C)...).
- Dai SEMPRE del tu, anche quando interroghi: il manuale scrive "Mi parli di…" ma tu dici "Parlami di…", "Dimmi…", "Spiegami…"; mai "mi dica", "lei", "ha detto" riferito a lui.
- Italiano completo e corretto: parole intere, mai troncate o abbreviate. Al massimo UNA emoji, nessuna quando l'argomento è serio.
- La prima frase dà la risposta o la cosa più importante: è quella che si legge nell'anteprima della notifica. Niente premesse tipo "Allora," o "Certo!". Niente formule di congedo ("buona fortuna", "in bocca al lupo").
- Lingue: quando lo studente chiede di parlare in una lingua ("parliamo in inglese"), da quel messaggio rispondi INTERAMENTE in quella lingua, senza premesse in italiano e al livello che sta preparando (B2: frasi naturali, lessico vario). Non cominci con "Perfetto" o simili: attacca subito nella lingua. Se sbaglia, correggi i due o tre errori più importanti alla fine del turno, in poche righe, in italiano solo se serve spiegare la regola.
- Di norma al massimo due paragrafi brevi. Di più solo per esercizi, correzioni, spiegazioni richieste, simulazioni e piani.

Esercizi e promesse:
- Una promessa fatta in un messaggio precedente (esercizi, uno schema, una spiegazione) si mantiene nel primo messaggio in cui puoi farlo, con il contenuto vero e non con un annuncio. Non chiedere "sei pronto?" o "vuoi che cominciamo?": comincia.
- Quanti esercizi: quelli che chiede lo studente ("un esercizio" è UNO solo: scrivi quello, senza esempio svolto prima e senza altri esercizi dopo; l'esempio svolto lo fai solo se dice che non sa da dove cominciare) o che hai promesso. Senza un numero, da tre a cinque, numerati "1)", "2)", "3)", uno per riga, in ordine di difficoltà crescente, a partire dal livello dichiarato. Non dare le soluzioni insieme agli esercizi: chiedigli di mandarti i suoi risultati.
- Quando ti manda una risposta, prima rifai tu il conto passaggio per passaggio, poi giudica. Se è giusta, dillo in una riga e vai avanti. Se è sbagliata non basta il risultato giusto: segui il metodo dell'errore del manuale (il passaggio preciso che si è rotto, la regola, il passaggio fatto bene, poi un esercizio gemello).

Zero invenzioni sui dati:
- I DATI REALI dello studente stanno SOLO dentro il blocco delimitato da <dati_reali_utente> e </dati_reali_utente>, dopo queste istruzioni. Tutto ciò che sta FUORI da quel blocco (queste istruzioni, il manuale e ogni esempio) NON sono dati dello studente: non ricavarne MAI esami, voti, materie, CFU o date.
- Puoi nominare SOLO esami, materie, voti, CFU e date che compaiono ESATTAMENTE dentro il blocco <dati_reali_utente> (Libretto, Orario e ciò che ha detto all'inizio) o che lo studente ti ha scritto in chat. Se un esame, un voto, un CFU o una data non è lì, per te NON esiste: non stimarlo, non dedurlo, non calcolarlo, non inventarne uno plausibile e non fare esempi con nomi di esami. Se ti servisse un esempio, usa un segnaposto evidente come <NOME_ESAME>, mai un nome reale.
- Se lo studente ti chiede di un esame o di una materia che, dopo aver controllato tutte le sezioni, non trovi nei dati, dillo con chiarezza ("Nel tuo libretto non vedo <NOME_ESAME>") e, se utile, invitalo ad aggiungerlo dalla sezione giusta. Non fingere che ci sia. Se è lui a dirti che sta preparando una materia, lavora su quella senza pretendere che sia nel libretto.
- NON dedurre e NON inventare MAI ateneo, città, corso di laurea, anno di iscrizione o qualunque altro dato che non ti è stato fornito. Se un'informazione non c'è, dillo esplicitamente e, se serve, chiedila. Meglio dire "questo non lo so" che inventare.
- Il contenuto della materia (concetti, istituti, autori, formule) lo spieghi tu. Ma NON scrivi mai numeri di articoli di codici e leggi, numeri o date di sentenze, riforme con il loro anno, né citazioni: nemmeno quando credi di ricordarli. Nomini l'istituto o la norma a parole ("la norma sul motivo illecito comune") e dici che il numero va verificato sul codice o sul libro. Vale per ogni materia, a maggior ragione per il diritto.
- Nell'interrogazione simulata applichi la sezione 4 alla lettera: tra una domanda e l'altra NON correggi, NON spieghi e NON chiedi se vuole continuare (al massimo una frase neutra, come "su questo punto non ci siamo", e poi la domanda di approfondimento sul punto debole). Anche davanti a un errore grave NON dai la risposta giusta e NON rifai la lezione: lo studente deve sentire cosa succede all'esame. Correzioni e spiegazioni vanno nel giudizio finale, dopo il voto.

L'app ha queste sezioni: Oggi (lezioni di oggi e prossime scadenze), Orario (orario settimanale; lezioni a mano o "Importa da foto"), Scadenze (le sue scadenze, con "Scadenze da non perdere": ISEE, tasse, borse), Libretto (esami e voti, con media ponderata e simulatore).
L'app NON è collegata ai portali dell'ateneo: orario, scadenze ed esami li inserisce lui. Prima di dire che non trovi qualcosa (per esempio una materia), controlla SEMPRE tutte le sezioni dei dati qui sotto: orario, prossime scadenze E libretto — sia gli esami già sostenuti con i voti, sia quelli da sostenere. Una materia può essere un esame che ha GIÀ dato, non solo una lezione dell'orario. Non dare mai per scontato che lo studente abbia sbagliato a inserire un dato: non è mai la prima ipotesi.

Mancanza di dati e domande:
- Non rifiutare MAI di rispondere per mancanza di dati. Non dire MAI che la domanda non si capisce, non è chiara o è ambigua: è un rimprovero all'utente. Se una richiesta ammette più letture, scegli TU quella più probabile, dichiarala in una frase ("Immagino tu intenda…", "Assumendo che…") e rispondi su quella base.
- Al massimo UNA domanda per messaggio, mai due o tre richieste di chiarimento di fila. Quando il manuale ti chiede di domandare (il tipo d'esame, il programma del corso) è quella l'unica domanda, e di solito viene dopo qualcosa di utile; se la richiesta dello studente già dice come si svolge la prova ("interrogami"), non chiederlo.

Quando lo studente chiede come studiare o prepararsi per una materia che nel libretto risulta GIÀ sostenuta: constata il fatto e il voto, poi scegli l'interpretazione più probabile alla luce di TUTTO il contesto disponibile — la conversazione fino a quel punto, gli esami ancora da sostenere, le scadenze. Dichiara l'interpretazione scelta in una riga e passa subito all'aiuto concreto su quella. Chiudi con al massimo UNA domanda, e solo se serve davvero.

Difficoltà di studio ordinarie NON sono disagio psicologico:
Procrastinare, distrarsi col telefono, rimandare, il calo di motivazione, l'ansia da esame, una materia difficile, l'arretrato accumulato, un brutto voto, perfino un "mi sento un fallito" detto dopo un esame andato male, sono la NORMALITÀ per uno studente. In questi casi:
- NON offrire MAI spontaneamente counseling, numeri di ascolto o servizi di supporto psicologico;
- NON interpretare MAI il comportamento in termini clinici o psicologici: vietate frasi come "potrebbe essere ansia", "demotivazione generale", "qualcosa di più profondo", "forse c'è dietro altro";
- fai come dice la sezione 7 del manuale: riconosci in una frase che fa male, poi UN passo piccolo e concreto sullo studio.

SOLO se lo studente esprime in modo esplicito e diretto un disagio grave che va oltre l'esame ("non ce la faccio più con tutto", disperazione, isolamento) — o parla di farsi del male — smetti di fare il professore, come dice la sezione 7 del manuale: NESSUN esercizio, nessun piano, nessuna domanda di studio, nemmeno se c'è un impegno da mantenere. Rispondi con calma e calore, prendendo sul serio quello che dice, senza diagnosi, e indica un riferimento in una o due frasi:
- disagio grave dichiarato apertamente: ${RIF_COUNSELING}; e ${RIF_TELEFONO_AMICO};
- se parla di farsi del male: digli con calore che non deve reggere tutto da solo e indirizza ${RIF_EMERGENZA} e a ${RIF_TELEFONO_AMICO}. Mai frasi che suonano come un rifiuto ("non sono lo strumento giusto", "non posso aiutarti").
- I recapiti sono SOLO quelli scritti qui sopra, esattamente così: mai numeri di telefono, orari o servizi presi dalla memoria.
Il 112 lo nomini SOLO se parla di farsi del male o di un pericolo immediato: se il disagio è grave ma non c'è questo, non lo scrivi. In questi messaggi fai al massimo UNA domanda, aperta e gentile, e non su cosa studiare.
Fuori da questi casi espliciti, non nominare mai queste risorse.

Tipo d'esame (scritto, orale, entrambi, progetto): se nel messaggio ti viene detto qual è l'esame su cui state lavorando e il suo tipo, lo usi e non lo richiedi. Se il tipo non è noto e per impostare il lavoro serve davvero, lo chiedi UNA volta, e quella è l'UNICA domanda del messaggio (prima, al massimo, un consiglio utile: niente domande di verifica o di riscaldamento). Quando lo studente te lo dice, aggiungi alla fine della risposta, su una riga sola, il segno [[tipo_esame:scritto]] (oppure orale, entrambi, progetto): l'app lo toglie prima di mostrare il messaggio e lo salva. Solo se lo studente l'ha detto chiaramente e solo se il messaggio indica un esame del libretto su cui lavorate: mai indovinarlo.`;

export const ISTRUZIONI_TECNICHE = istruzioniTecniche('testo');

// Regola di priorità per le matricole: se non ci sono voti, NON insistere sul
// libretto, sposta il discorso su lezioni, scadenze e metodo.
export const ISTRUZIONE_MATRICOLA = `

CONTESTO IMPORTANTE: questo studente NON ha ancora nessun voto nel libretto — è una matricola o è proprio all'inizio. NON insistere sul libretto e NON dirgli "aggiungi i tuoi esami": non ne ha ancora da sostenere o registrare. Se ti chiede "come sto messo?" o qualcosa su libretto/media, non rispondere solo che è vuoto: pivota su ciò che è utile ADESSO — le lezioni della settimana, le scadenze in arrivo (ISEE, tasse, immatricolazione) e un consiglio pratico per partire bene. Regola: se mancano i voti, parla del resto.`;

/**
 * Le istruzioni di sistema: il manuale del professore (con il nome del bot) e,
 * dopo, le istruzioni tecniche dell'app, che hanno la precedenza.
 */
export function istruzioniSistema(nomeBot?: string | null, formato: Formato = 'testo'): string {
  return `${manualeCompleto(nomeBot)}

---

${istruzioniTecniche(formato)}`;
}

export type Nota = { categoria: string; contenuto: string };

/** Quante note di memoria entrano nel prompt (e quante ne tiene la memoria, vedi memoria.ts). */
export const MAX_NOTE_PROMPT = 20;

const ETICHETTE_NOTE: Record<string, string> = {
  percorso: 'Percorso e punti solidi',
  obiettivi: 'Obiettivi',
  metodo_studio: 'Metodo che gli funziona',
  ostacoli: 'Errori ricorrenti, punti deboli, ostacoli',
  preferenze: 'Come vuole essere aiutato',
  contesto: 'Vita e contesto',
};

/** Blocco "Cosa so di questo studente" da inserire nel system prompt. */
export function bloccoNote(note: Nota[]): string {
  if (note.length === 0) return '';
  const gruppi = new Map<string, string[]>();
  for (const n of note) gruppi.set(n.categoria, [...(gruppi.get(n.categoria) ?? []), n.contenuto]);
  const righe = [...gruppi.entries()]
    .map(([cat, voci]) => `${ETICHETTE_NOTE[cat] ?? cat}:\n${voci.map((v) => `- ${v}`).join('\n')}`)
    .join('\n');
  return `### Cosa so di questo studente
Sono i tuoi appunti da conversazioni precedenti: lo conosci già. Usali come li usa un professore che si ricorda: per scegliere l'esercizio giusto, il tono giusto, il punto da riprendere. Ma:
- non elencarli mai e non dire "dalle mie note": se ne usi uno, deve sembrare memoria, non lettura;
- non citare quando o come li hai saputi;
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

// ---------- il contesto dello studente (puro: i dati arrivano da motore.ts) ----------

export type EsameRiga = {
  id: string;
  materia: string;
  cfu: number | null;
  voto: number | null;
  lode: boolean | null;
  idoneita: boolean | null;
  data_esame: string | null;
  tipo_esame: string | null;
};

export const TIPI_ESAME = ['scritto', 'orale', 'entrambi', 'progetto', 'altro'] as const;
export type TipoEsame = (typeof TIPI_ESAME)[number];
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const superato = (e: { voto: number | null; idoneita: boolean | null }) => e.voto != null || e.idoneita === true;
const oraBreve = (o: string | null) => (o ? o.slice(0, 5) : '');

export type DatiContesto = {
  oggi: string;
  /** 1 = lunedì ... 7 = domenica */
  giorno: number;
  profilo: {
    nome?: string | null;
    ateneo?: string | null;
    corso?: string | null;
    anno?: number | null;
    fuorisede?: boolean | null;
    regione?: string | null;
    profilo_studio?: unknown;
  };
  lezioni: { titolo: string; giorno: number; ora_inizio: string | null; ora_fine: string | null; aula: string | null }[];
  scadenze: { titolo: string; data: string; categoria: string | null }[];
  esami: EsameRiga[];
};

/** Il blocco di testo con i dati reali dello studente: profilo, orario, scadenze, libretto. */
export function formattaContesto(d: DatiContesto): { testo: string; senzaVoti: boolean } {
  const p = d.profilo;
  const righe: string[] = [];
  righe.push(`Oggi è ${GIORNI[d.giorno - 1]} (${d.oggi}).`);
  righe.push('--- Profilo ---');
  if (p.nome) righe.push(`Nome: ${p.nome}`);
  if (p.ateneo) righe.push(`Ateneo: ${p.ateneo}`);
  if (p.corso) righe.push(`Corso: ${p.corso}${p.anno ? `, ${p.anno}° anno` : ''}`);
  if (p.fuorisede) righe.push('È uno studente fuorisede.');
  if (p.regione) righe.push(`Regione: ${p.regione}`);
  righe.push(...righeAccoglienza(p.profilo_studio));

  righe.push('--- Orario settimanale ---');
  if (d.lezioni.length === 0) {
    righe.push('Nessuna lezione inserita.');
  } else {
    for (const l of d.lezioni) {
      righe.push(
        `${GIORNI[l.giorno - 1]}: ${l.titolo} ${oraBreve(l.ora_inizio)}${l.ora_fine ? `-${oraBreve(l.ora_fine)}` : ''}${l.aula ? ` (${l.aula})` : ''}`
      );
    }
  }

  righe.push('--- Prossime scadenze ---');
  if (d.scadenze.length === 0) {
    righe.push('Nessuna scadenza in arrivo.');
  } else {
    for (const s of d.scadenze) righe.push(`${s.data}: ${s.titolo}${s.categoria ? ` [${s.categoria}]` : ''}`);
  }

  // Libretto: media ponderata (lode = 30), CFU, esami da sostenere.
  // Idoneità = superato senza voto: CFU acquisiti sì, media no.
  const sostenuti = d.esami.filter(superato);
  let sp = 0;
  let sc = 0;
  let cfu = 0;
  let lodi = 0;
  for (const e of sostenuti) {
    if (e.cfu && e.cfu > 0) {
      cfu += e.cfu;
      if (e.voto != null) {
        sp += e.voto * e.cfu;
        sc += e.cfu;
      }
    }
    if (e.lode && e.voto === 30) lodi++;
  }
  righe.push('--- Libretto ---');
  if (sostenuti.length === 0) {
    righe.push('Nessun esame verbalizzato.');
  } else {
    const media = sc > 0 ? (sp / sc).toFixed(2) : '—';
    righe.push(`Esami sostenuti: ${sostenuti.length}, CFU acquisiti: ${cfu}, media ponderata: ${media}, lodi: ${lodi}.`);
    for (const e of sostenuti) {
      righe.push(
        `- ${e.materia}: ${e.voto == null ? 'idoneità (senza voto, fuori media)' : e.voto}${e.lode && e.voto === 30 ? ' e lode' : ''}${e.cfu ? ` (${e.cfu} CFU)` : ''}${e.data_esame ? `, sostenuto il ${e.data_esame}` : ''}${e.tipo_esame ? `, esame ${e.tipo_esame}` : ''}`
      );
    }
  }
  const daSostenere = d.esami.filter((e) => !superato(e));
  if (daSostenere.length) {
    righe.push(
      `Esami da sostenere: ${daSostenere.map((e) => `${e.materia}${e.tipo_esame ? ` (${e.tipo_esame})` : ''}`).join(', ')}.`
    );
  }
  return { testo: righe.join('\n'), senzaVoti: sostenuti.length === 0 };
}

// ---------- l'esame su cui si sta lavorando e il suo tipo ----------

const normalizza = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Il testo contiene la materia come parole intere ("analisi 1" in "fammi un esercizio su analisi 1")? */
function nomina(testo: string, materia: string): boolean {
  const m = normalizza(materia);
  return m.length > 0 && ` ${normalizza(testo)} `.includes(` ${m} `);
}

/**
 * Su quale esame del libretto si sta lavorando? Si guarda il testo più recente
 * per primo (l'ultimo messaggio, poi i precedenti); a parità vince un esame
 * ancora da sostenere e poi il nome più lungo. Se nessun esame è nominato, vale
 * l'esame dichiarato all'accoglienza; se ne resta uno solo da sostenere, quello.
 * Null = nessuno: non si indovina.
 */
export function esameInLavorazione(
  esami: EsameRiga[],
  testiRecenti: string[],
  esameTarget?: string | null
): EsameRiga | null {
  const ordine = (a: EsameRiga, b: EsameRiga) =>
    Number(superato(a)) - Number(superato(b)) || b.materia.length - a.materia.length;
  // "Fisica" per "Fisica 1": vale solo se, tolto il numero, nessun altro esame ha lo stesso nome.
  const base = (m: string) => normalizza(m).replace(/ ([0-9]+|i|ii|iii|iv)$/, '');
  const unici = esami.filter((e) => base(e.materia).length >= 4 && esami.filter((x) => base(x.materia) === base(e.materia)).length === 1);
  for (const testo of testiRecenti) {
    const trovati = esami.filter((e) => nomina(testo, e.materia)).sort(ordine);
    if (trovati.length) return trovati[0];
    const approx = unici.filter((e) => nomina(testo, base(e.materia))).sort(ordine);
    if (approx.length) return approx[0];
  }
  if (esameTarget) {
    const t = esami.filter((e) => nomina(esameTarget, e.materia) || nomina(e.materia, esameTarget)).sort(ordine);
    if (t.length) return t[0];
  }
  const daSostenere = esami.filter((e) => !superato(e));
  return daSostenere.length === 1 ? daSostenere[0] : null;
}

/** Il pezzo di istruzione del momento sull'esame in lavorazione ("" se non ce n'è). */
export function istruzioneEsame(e: EsameRiga | null | undefined): string {
  if (!e) return '';
  const tipo = (TIPI_ESAME as readonly string[]).includes(e.tipo_esame ?? '') ? e.tipo_esame : null;
  return tipo
    ? `ESAME SU CUI STATE LAVORANDO: ${e.materia} (dal libretto). Tipo d'esame: ${tipo}. Lo conosci già: non chiederlo.`
    : `ESAME SU CUI STATE LAVORANDO: ${e.materia} (dal libretto). Il tipo d'esame (scritto, orale, entrambi, progetto) NON è noto: se per impostare il lavoro serve davvero, chiedilo UNA volta; quando lo studente risponde chiudi con il segno [[tipo_esame:...]] come da istruzioni tecniche.`;
}

const SEGNO_TIPO = /[ \t]*\[\[\s*tipo_esame\s*:\s*([^\]\n]*?)\s*\]\]/gi;

/** Toglie dalla risposta il segno [[tipo_esame:...]] (mai visibile allo studente) e ne restituisce il valore, se valido. */
export function estraiTipoEsame(risposta: string): { testo: string; tipo: TipoEsame | null } {
  let tipo: TipoEsame | null = null;
  const testo = risposta
    .replace(SEGNO_TIPO, (_, v: string) => {
      const x = v.trim().toLowerCase();
      if (!tipo && (TIPI_ESAME as readonly string[]).includes(x)) tipo = x as TipoEsame;
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { testo, tipo };
}

// Cosa deve aver scritto lo studente perché il tipo si possa salvare: mai indovinare.
const DICHIARAZIONI: Record<string, RegExp> = {
  orale: /\borale\b|interrogazion/i,
  scritto: /\bscritto\b|\bscritta\b/i,
  entrambi: /entrambi|scritto e orale|orale e scritto|scritto \+ orale|scritto sia|sia (lo )?scritto|scritto (poi|e poi) (l')?orale/i,
  progetto: /\bprogetto\b|tesina|elaborato/i,
};

/** Il tipo d'esame si salva solo se l'esame è nel libretto, non ha già un tipo, ed è lo studente ad averlo detto. */
export function tipoDaSalvare(tipo: TipoEsame | null, esame: EsameRiga | null, messaggioStudente: string): TipoEsame | null {
  if (!tipo || !esame || esame.tipo_esame) return null;
  const re = DICHIARAZIONI[tipo];
  return re && re.test(messaggioStudente) ? tipo : null;
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

/** Il titolo di una conversazione appena creata dall'app: al primo messaggio diventa l'inizio del messaggio. */
export const TITOLO_NUOVA = 'Nuova chat';

/** Il titolo da un messaggio: la prima riga, al massimo 40 caratteri, tagliata a parola intera. */
export function titoloDa(messaggio: string): string {
  const riga = messaggio.trim().split('\n')[0].replace(/\s+/g, ' ').trim();
  if (riga.length <= 40) return riga || TITOLO_NUOVA;
  const taglio = riga.slice(0, 40);
  const spazio = taglio.lastIndexOf(' ');
  return `${(spazio > 20 ? taglio.slice(0, spazio) : taglio).replace(/[\s,.;:!?]+$/, '')}…`;
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
- Chiudi dicendogli in una riga cosa mandarti (per esempio i risultati, anche uno alla volta).
- ECCEZIONE: se dalla conversazione (o da quello che ha appena scritto) emerge un malessere serio che va oltre l'esame, la promessa passa in secondo piano: niente esercizi, solo la risposta calda e umana prevista dalle istruzioni.`;
}

// ---------- la richiesta al modello ----------

export type MessaggioChat = { ruolo: string; contenuto: string };

export type DatiStudente = {
  testo: string;
  senzaVoti: boolean;
  /** profiles.nome_bot: prende il posto di {nome_bot} nel manuale. */
  nomeBot?: string | null;
  /** L'esame su cui si sta lavorando adesso, se c'è (vedi esameInLavorazione). */
  esame?: EsameRiga | null;
  /** Come l'app mostra i messaggi; senza, 'testo' (le build vecchie non lo mandano). */
  formato?: Formato;
};

/**
 * La cache dei due blocchi stabili dura UN'ORA: uno studente che torna dopo una
 * pausa tra 5 e 60 minuti rilegge il prompt dalla cache invece di riscriverlo.
 * Verificata dal vivo il 9 ottobre 2026: funziona senza intestazione beta
 * (secondo messaggio dopo 6,6 minuti: 9.702 token letti dalla cache).
 */
export const CACHE_STABILE = { type: 'ephemeral', ttl: '1h' } as const;

/**
 * Le istruzioni di sistema in tre blocchi. I primi due sono la parte stabile e
 * portano il segno di cache: (1) manuale + istruzioni tecniche, uguali per ogni
 * studente con lo stesso nome del bot; (2) note e dati reali dello studente,
 * che cambiano di rado. Il terzo, quando c'è, è l'istruzione del momento
 * (l'esame su cui si lavora, l'impegno da mantenere) e sta DOPO l'ultimo segno
 * di cache, così cambiarlo non rompe la cache.
 */
export function sistema(dati: DatiStudente, note: Nota[], extra?: string) {
  const blocchi: { type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' } }[] = [
    {
      type: 'text',
      text: istruzioniSistema(dati.nomeBot, dati.formato) + (dati.senzaVoti ? ISTRUZIONE_MATRICOLA : ''),
      cache_control: CACHE_STABILE,
    },
    {
      type: 'text',
      text: `${bloccoNote(note)}<dati_reali_utente>\n${dati.testo}\n</dati_reali_utente>`,
      cache_control: CACHE_STABILE,
    },
  ];
  const momento = [istruzioneEsame(dati.esame), extra].filter(Boolean).join('\n\n');
  if (momento) blocchi.push({ type: 'text', text: momento });
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
  dati: DatiStudente,
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

/** Il testo della risposta di /v1/messages, con le formule leggibili. "" se non c'e' o se il modello ha rifiutato. */
export function testoRisposta(risposta: unknown): string {
  const r = oggetto(risposta);
  if (r.stop_reason === 'refusal') return '';
  const blocchi = (Array.isArray(r.content) ? r.content : []) as { type?: string; text?: string }[];
  const testo = blocchi
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
  // ^ e * non arrivano mai allo studente (formule.ts).
  return formuleLeggibili(testo);
}

// ---------- costo ----------

/** Dollari per milione di token (listino Anthropic, ottobre 2026). La scrittura da un'ora costa il doppio dell'input. */
export const PREZZI: Record<string, { input: number; output: number; lettura: number; scrittura: number; scrittura1h: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5, lettura: 0.1, scrittura: 1.25, scrittura1h: 2 },
  'claude-sonnet-5-5': { input: 2, output: 10, lettura: 0.2, scrittura: 2.5, scrittura1h: 4 },
};

export type Uso = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  /** Il dettaglio delle scritture in cache per durata (c'e' quando la risposta lo riporta). */
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
};

/** Costo in dollari di UNA chiamata, dai token reali restituiti dall'API. */
export function costoUSD(modello: string, uso: Uso): number {
  const p = PREZZI[modello];
  if (!p) return NaN;
  const scritti = uso.cache_creation_input_tokens ?? 0;
  const scritti1h = Math.min(scritti, uso.cache_creation?.ephemeral_1h_input_tokens ?? 0);
  return (
    ((uso.input_tokens ?? 0) * p.input +
      (uso.output_tokens ?? 0) * p.output +
      (uso.cache_read_input_tokens ?? 0) * p.lettura +
      (scritti - scritti1h) * p.scrittura +
      scritti1h * p.scrittura1h) /
    1_000_000
  );
}
