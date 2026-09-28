// Chat AI col contesto del profilo dello studente + memoria di lungo periodo.
// - verifica JWT (solo utenti loggati)
// - CAP giornaliero free verificato SERVER-SIDE (mai fidarsi del client)
// - idempotenza sull'id del messaggio (un retry non duplica)
// - costruisce il contesto dal DB (profilo, orario, scadenze, libretto) + le note
//   di memoria dello studente, lette col JWT dell'utente (RLS effettiva)
// - UNA chiamata a Claude Haiku per rispondere
// - dopo la risposta, in background, una SECONDA chiamata dedicata SOLO
//   all'estrazione della memoria (tool use forzato + validazione lato codice)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { dataOggiRoma, giornoSettimanaRoma } from '../_shared/briefing.ts';

const CAP_GIORNALIERO = 10; // messaggi/giorno per gli utenti free
const MAX_STORICO = 10; // ultimi messaggi passati come contesto
const MAX_NOTE = 40; // note di memoria caricate nel prompt
const TIMEOUT_MS = 30_000;
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

// Quando far partire l'estrazione della memoria: messaggio lungo OPPURE ogni 3 scambi.
const SOGLIA_ESTRAZIONE = 120;
const OGNI_N_SCAMBI = 3;

// Vincoli sulle note (identici alla migration + validati anche qui).
const CATEGORIE_NOTE = ['percorso', 'obiettivi', 'metodo_studio', 'ostacoli', 'preferenze', 'contesto'];
const MAX_LEN_NOTA = 300;
// Difesa in profondità: contenuti che NON devono mai finire in memoria (oltre al
// divieto nel prompt dell'estrattore). In caso di dubbio si scarta la nota.
// Area sanitaria/di cura vietata anche se detta in modo neutro o indiretto
// (medici/psicologi/psichiatri, terapie, visite/appuntamenti, farmaci, ricoveri,
// il fatto stesso di rivolgersi a un professionista sanitario). I confini di
// parola evitano di colpire i corsi di laurea "Medicina/Psicologia/Farmacia".
const NOTE_VIETATE =
  /diagnos|depress|bipolar|schizo|disturb|panico|suicid|autolesion|anoress|bulim|\bmedic[oi]\b|dottoress|\bdottor[ei]\b|\bpsicolog[oai]\b|psicologic|psichiatr|psicoterap|terapi[ae]|terapeut|\bfarmac[oi]\b|psicofarmac|antidepress|ansiolit|ricover|ospedal|ambulator|\bclinic|sanitar|consultorio|pronto soccorso|visita medic|visite medic|controllo medic|appuntamento (medic|sanitar)|professionista sanitar|religio|cattolic|musulman|\bebre|islam|orientamento sessuale|omosess|\betero|bisess|transgender|\betni|\brazz|partito|di destra|di sinistra/i;

// Riferimenti di aiuto — RACCOLTI QUI come costanti così sono facili da aggiornare.
// >>> DA VERIFICARE PRIMA DELLA PUBBLICAZIONE (numeri segnalati all'utente).
const RIF_COUNSELING =
  'il servizio di counseling psicologico del tuo ateneo (quasi tutte le università italiane lo offrono gratis agli iscritti)';
const RIF_TELEFONO_AMICO =
  'Telefono Amico Italia al 02 2327 2327 (tutti i giorni 10-24), oppure su WhatsApp al 324 011 7252 (18-21)';
const RIF_EMERGENZA = 'il 112, numero unico di emergenza';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function oraBreve(o: string | null): string {
  return o ? o.slice(0, 5) : '';
}

/** Costruisce il blocco di contesto con i dati reali dello studente. */
async function costruisciContesto(
  admin: SupabaseClient,
  userId: string
): Promise<{ testo: string; senzaVoti: boolean }> {
  const oggi = dataOggiRoma();
  const [profiloR, lezioniR, scadenzeR, esamiR] = await Promise.all([
    admin.from('profiles').select('nome, ateneo, corso, anno, fuorisede, regione').eq('id', userId).maybeSingle(),
    admin.from('schedule_events').select('titolo, giorno, ora_inizio, ora_fine, aula').eq('user_id', userId).order('giorno').order('ora_inizio'),
    admin.from('deadlines').select('titolo, data, categoria').eq('user_id', userId).eq('completata', false).gte('data', oggi).order('data').limit(15),
    admin.from('exams').select('materia, cfu, voto, lode, idoneita, data_esame').eq('user_id', userId),
  ]);

  const p = profiloR.data ?? {};
  const righe: string[] = [];

  righe.push(`Oggi è ${GIORNI[giornoSettimanaRoma() - 1]} (${oggi}).`);
  righe.push('--- Profilo ---');
  if (p.nome) righe.push(`Nome: ${p.nome}`);
  if (p.ateneo) righe.push(`Ateneo: ${p.ateneo}`);
  if (p.corso) righe.push(`Corso: ${p.corso}${p.anno ? `, ${p.anno}° anno` : ''}`);
  if (p.fuorisede) righe.push('È uno studente fuorisede.');
  if (p.regione) righe.push(`Regione: ${p.regione}`);

  const lezioni = lezioniR.data ?? [];
  righe.push('--- Orario settimanale ---');
  if (lezioni.length === 0) {
    righe.push('Nessuna lezione inserita.');
  } else {
    for (const l of lezioni) {
      righe.push(
        `${GIORNI[l.giorno - 1]}: ${l.titolo} ${oraBreve(l.ora_inizio)}${l.ora_fine ? `-${oraBreve(l.ora_fine)}` : ''}${l.aula ? ` (${l.aula})` : ''}`
      );
    }
  }

  const scadenze = scadenzeR.data ?? [];
  righe.push('--- Prossime scadenze ---');
  if (scadenze.length === 0) {
    righe.push('Nessuna scadenza in arrivo.');
  } else {
    for (const s of scadenze) {
      righe.push(`${s.data}: ${s.titolo}${s.categoria ? ` [${s.categoria}]` : ''}`);
    }
  }

  // Libretto: media ponderata (lode = 30), CFU, esami da sostenere.
  // Idoneità = superato senza voto: CFU acquisiti sì, media no.
  const esami = esamiR.data ?? [];
  const superato = (e: { voto: number | null; idoneita: boolean | null }) =>
    e.voto != null || e.idoneita === true;
  const sostenuti = esami.filter(superato);
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
        `- ${e.materia}: ${e.voto == null ? 'idoneità (senza voto, fuori media)' : e.voto}${e.lode && e.voto === 30 ? ' e lode' : ''}${e.cfu ? ` (${e.cfu} CFU)` : ''}${e.data_esame ? `, sostenuto il ${e.data_esame}` : ''}`
      );
    }
  }
  const daSostenere = esami.filter((e: { voto: number | null; idoneita: boolean | null }) => !superato(e));
  if (daSostenere.length) {
    righe.push(`Esami da sostenere: ${daSostenere.map((e: { materia: string }) => e.materia).join(', ')}.`);
  }

  return { testo: righe.join('\n'), senzaVoti: sostenuti.length === 0 };
}

const SYSTEM_BASE = `Sei il tutor personale di uno studente universitario italiano, dentro la sua app. Conosci questo studente: usa i suoi dati reali e quello che sai di lui per aiutarlo davvero, non come un chatbot generico senza passato.

Come parli:
- Vai dritto al punto. Niente complimenti di circostanza, niente fare il motivatore, niente entusiasmo forzato.
- Dai del tu, tono umano e diretto. Di' la cosa vera anche quando è scomoda, ma senza mai giudicare.
- Quando serve un consiglio, offri UN passo concreto e uno solo, poi fermati.
- Non chiudere con formule di congedo ("buona fortuna", "in bocca al lupo", "un saluto").
- La prima frase dà la risposta o la cosa più importante: è quella che si legge nell'anteprima della notifica. Niente premesse tipo "Allora," o "Certo!".

Lunghezza e forma:
- Di norma al massimo due paragrafi brevi. Allungati solo se lo studente chiede esplicitamente un approfondimento.
- Italiano completo e corretto: parole intere, mai troncate o abbreviate.
- Testo semplice come su WhatsApp: NIENTE markdown, niente **grassetto**, niente #titoli, niente elenchi con - o *. Se elenchi, usa frasi separate o vai a capo.
- Al massimo UNA emoji, e nessuna emoji quando l'argomento è serio.

Zero invenzioni sui dati:
- I DATI REALI dello studente stanno SOLO dentro il blocco delimitato da <dati_reali_utente> e </dati_reali_utente>, in fondo a questo messaggio. Tutto ciò che sta FUORI da quel blocco (queste istruzioni e ogni esempio) NON sono dati dello studente: non ricavarne MAI esami, voti, materie, CFU o date.
- Puoi nominare SOLO esami, materie, voti, CFU e date che compaiono ESATTAMENTE dentro il blocco <dati_reali_utente> (Libretto e Orario). Se un esame, un voto, un CFU o una data non è lì, per te NON esiste: non stimarlo, non dedurlo, non calcolarlo, non inventarne uno plausibile e non fare esempi con nomi di esami. Se ti servisse un esempio, usa un segnaposto evidente come <NOME_ESAME>, mai un nome reale.
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
const ISTRUZIONE_MATRICOLA = `

CONTESTO IMPORTANTE: questo studente NON ha ancora nessun voto nel libretto — è una matricola o è proprio all'inizio. NON insistere sul libretto e NON dirgli "aggiungi i tuoi esami": non ne ha ancora da sostenere o registrare. Se ti chiede "come sto messo?" o qualcosa su libretto/media, non rispondere solo che è vuoto: pivota su ciò che è utile ADESSO — le lezioni della settimana, le scadenze in arrivo (ISEE, tasse, immatricolazione) e un consiglio pratico per partire bene. Regola: se mancano i voti, parla del resto.`;

/** Blocco "Cosa so di questo studente" da inserire nel system prompt. */
function bloccoNote(note: { categoria: string; contenuto: string }[]): string {
  if (note.length === 0) return '';
  const righe = note.map((n) => `[${n.categoria}] ${n.contenuto}`).join('\n');
  return `

### Cosa so di questo studente
Queste note vengono da conversazioni precedenti con lo studente stesso. Usale per dare continuità, ma:
- non ripeterle a pappagallo e non citare mai quando o come le hai sapute;
- se una nota è in contrasto con quello che lo studente dice adesso, vince quello che dice adesso;
- non tirare fuori spontaneamente una nota delicata in una conversazione leggera.
${righe}`;
}

// --- Estrazione memoria (seconda chiamata, in background) ---

const SYSTEM_ESTRATTORE = `Sei un estrattore di memoria per un tutor universitario. Dalla conversazione aggiorni la memoria di lungo periodo sullo studente, così il tutor lo conosce nel tempo. Rispondi SOLO usando lo strumento "memoria".

Cosa si PUÒ memorizzare (solo ciò che serve a fare da tutor):
- percorso: corso di laurea e situazione accademica;
- obiettivi: obiettivi dichiarati (laurearsi entro X, una media, un esame specifico...);
- metodo_studio: come studia e cosa gli funziona;
- ostacoli: ostacoli concreti che incontra nello studio;
- preferenze: come vuole essere aiutato.

È VIETATO memorizzare, mai, in nessuna forma — nemmeno se detto in modo neutro o indiretto:
- diagnosi, condizioni di salute fisica o mentale, terapie o farmaci;
- medici, psicologi, psichiatri o altri professionisti sanitari, visite, appuntamenti, controlli, percorsi di cura, ricoveri, e persino il fatto che lo studente si sia rivolto — o voglia rivolgersi — a un professionista sanitario;
- origine etnica, religione, opinioni politiche, orientamento o vita sessuale;
- dati riferiti a terze persone.
Regola tassativa: se una nota non si può scrivere senza toccare l'area sanitaria o di cura, NON la scrivi. Nel dubbio, non scrivere la nota.
Se lo studente racconta un disagio, scrivi la nota SOLO in termini funzionali sullo studio (motivazione, concentrazione, organizzazione, dubbi sul percorso), senza alcun riferimento a salute, cura o professionisti sanitari. Ammesso: "fatica a rimanere motivato sugli esami e sta valutando di cambiare percorso". Vietato: qualunque cosa che nomini o alluda a medico/psicologo/terapia/farmaci/visite/diagnosi/una condizione.

Regole:
- Ogni nota è UN fatto solo, conciso, in italiano, al massimo 300 caratteri.
- Evita duplicati: se un fatto è già presente e invariato, non fare nulla su di esso.
- Se un fatto nuovo aggiorna o contraddice una nota esistente, usa "aggiorna" sul suo id (non aggiungere una nota incoerente).
- Se una nota non è più vera, usa "archivia" sul suo id.
- "aggiorna" e "archivia" devono riferirsi a un id presente nell'elenco fornito.
- Se non c'è niente di utile e stabile da salvare, restituisci una lista di operazioni vuota.`;

const SCHEMA_MEMORIA = {
  type: 'object',
  properties: {
    operazioni: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['aggiungi', 'aggiorna', 'archivia'] },
          id: { type: 'string', description: 'id della nota esistente (per aggiorna/archivia)' },
          categoria: { type: 'string', enum: CATEGORIE_NOTE },
          contenuto: { type: 'string', description: 'un fatto solo, max 300 caratteri' },
          importanza: { type: 'integer', enum: [1, 2, 3] },
        },
        required: ['tipo'],
        additionalProperties: false,
      },
    },
  },
  required: ['operazioni'],
  additionalProperties: false,
};

type Op = { tipo: string; id?: string; categoria?: string; contenuto?: string; importanza?: number };

/** Nota valida per la memoria? (validazione lato codice, oltre al prompt). */
function contenutoAmmesso(c: unknown): c is string {
  return typeof c === 'string' && c.trim().length > 0 && c.length <= MAX_LEN_NOTA && !NOTE_VIETATE.test(c);
}

/**
 * Seconda chiamata dedicata: estrae/aggiorna la memoria. Gira in background
 * (EdgeRuntime.waitUntil), quindi non rallenta la risposta della chat.
 * Scrive col JWT dell'utente (clientUtente) → RLS effettiva.
 */
async function estraiMemoria(
  anthropic: Anthropic,
  clientUtente: SupabaseClient,
  userId: string,
  trascrizione: string,
  noteEsistenti: { id: string; categoria: string; contenuto: string }[]
): Promise<void> {
  try {
    const elenco = noteEsistenti.length
      ? noteEsistenti.map((n) => `id=${n.id} [${n.categoria}] ${n.contenuto}`).join('\n')
      : '(nessuna nota esistente)';
    const input = `Note già in memoria:\n${elenco}\n\nUltime battute della conversazione:\n${trascrizione}`;

    const out = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: SYSTEM_ESTRATTORE,
      tools: [{ name: 'memoria', description: 'Registra le operazioni sulla memoria dello studente.', input_schema: SCHEMA_MEMORIA as never }],
      tool_choice: { type: 'tool', name: 'memoria' },
      messages: [{ role: 'user', content: input }],
    });

    const blocco = out.content.find((b) => b.type === 'tool_use');
    const ops = (blocco && 'input' in blocco ? (blocco.input as { operazioni?: Op[] }).operazioni : undefined) ?? [];
    const idValidi = new Set(noteEsistenti.map((n) => n.id));

    for (const op of ops) {
      if (op.tipo === 'aggiungi') {
        if (!op.categoria || !CATEGORIE_NOTE.includes(op.categoria)) continue;
        if (!contenutoAmmesso(op.contenuto)) continue;
        const imp = op.importanza && [1, 2, 3].includes(op.importanza) ? op.importanza : 2;
        await clientUtente
          .from('note_studente')
          .insert({ user_id: userId, categoria: op.categoria, contenuto: op.contenuto!.trim(), importanza: imp });
      } else if (op.tipo === 'aggiorna') {
        if (!op.id || !idValidi.has(op.id)) continue;
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (op.categoria) {
          if (!CATEGORIE_NOTE.includes(op.categoria)) continue;
          patch.categoria = op.categoria;
        }
        if (op.contenuto !== undefined) {
          if (!contenutoAmmesso(op.contenuto)) continue;
          patch.contenuto = op.contenuto.trim();
        }
        if (op.importanza && [1, 2, 3].includes(op.importanza)) patch.importanza = op.importanza;
        await clientUtente.from('note_studente').update(patch).eq('id', op.id);
      } else if (op.tipo === 'archivia') {
        if (!op.id || !idValidi.has(op.id)) continue;
        await clientUtente
          .from('note_studente')
          .update({ archiviata: true, updated_at: new Date().toISOString() })
          .eq('id', op.id);
      }
    }
  } catch (e) {
    console.error('Estrazione memoria fallita:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ errore: 'METODO_NON_VALIDO' }, 405);

  try {
    // 1) Auth
    const auth = req.headers.get('Authorization') ?? '';
    const clientUtente = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const {
      data: { user },
    } = await clientUtente.auth.getUser();
    if (!user) return json({ errore: 'NON_AUTORIZZATO' }, 401);

    // 2) Input
    const { messaggio, id } = await req.json().catch(() => ({}));
    if (!messaggio || typeof messaggio !== 'string' || !messaggio.trim()) {
      return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
    if (messaggio.length > 2000) return json({ errore: 'MESSAGGIO_TROPPO_LUNGO' }, 413);
    const testo = messaggio.trim();
    // id del messaggio: chiave di idempotenza. Se il client non ne manda uno valido, ne generiamo uno.
    const idMsg = typeof id === 'string' && UUID_RE.test(id) ? id : crypto.randomUUID();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3) IDEMPOTENZA: se questo messaggio (per id) è già stato elaborato, restituisci
    // la risposta già salvata senza rielaborare, riconteggiare il cap o duplicare.
    const { data: gia } = await admin
      .from('chat_messages')
      .select('created_at')
      .eq('id', idMsg)
      .maybeSingle();
    if (gia) {
      const { data: rispPrec } = await admin
        .from('chat_messages')
        .select('contenuto')
        .eq('user_id', user.id)
        .eq('ruolo', 'assistant')
        .gte('created_at', gia.created_at)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (rispPrec?.contenuto) return json({ risposta: rispPrec.contenuto });
      // caso raro (utente senza risposta salvata): prosegui e rielabora.
    }

    // 4) CAP giornaliero (server-side). I premium non hanno cap.
    const { data: profilo } = await admin.from('profiles').select('premium').eq('id', user.id).maybeSingle();
    const oggi = dataOggiRoma();
    if (!profilo?.premium) {
      const { count } = await admin
        .from('usage_chat')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('data', oggi);
      if ((count ?? 0) >= CAP_GIORNALIERO) {
        return json({ errore: 'CAP_RAGGIUNTO', cap: CAP_GIORNALIERO }, 429);
      }
    }

    // 5) Contesto + storico breve + note di memoria (le note col JWT dell'utente).
    const [contesto, storicoR, noteR] = await Promise.all([
      costruisciContesto(admin, user.id),
      admin
        .from('chat_messages')
        .select('ruolo, contenuto')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_STORICO),
      clientUtente
        .from('note_studente')
        .select('id, categoria, contenuto')
        .eq('archiviata', false)
        .order('importanza', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(MAX_NOTE),
    ]);
    const storico = (storicoR.data ?? []).reverse();
    const note = noteR.data ?? [];
    const system =
      SYSTEM_BASE +
      (contesto.senzaVoti ? ISTRUZIONE_MATRICOLA : '') +
      bloccoNote(note) +
      `\n\n<dati_reali_utente>\n${contesto.testo}\n</dati_reali_utente>`;

    // 6) Chiamata AI (Haiku, con degrado grazioso)
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
    });

    let risposta: string;
    try {
      const out = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system,
        messages: [
          ...storico.map((m) => ({
            role: m.ruolo === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.contenuto,
          })),
          { role: 'user' as const, content: testo },
        ],
      });
      risposta = out.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('')
        .trim();
      if (!risposta) throw new Error('risposta vuota');
    } catch (e) {
      console.error('Chat AI fallita:', e);
      if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ errore: 'TIMEOUT' }, 504);
      return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);
    }

    // 7) Persistenza + conteggio uso. Il messaggio utente è un UPSERT sull'id
    // (chiave di idempotenza): un retry con lo stesso id non crea duplicati.
    await admin
      .from('chat_messages')
      .upsert({ id: idMsg, user_id: user.id, ruolo: 'user', contenuto: testo }, { onConflict: 'id', ignoreDuplicates: true });
    await admin.from('chat_messages').insert({ user_id: user.id, ruolo: 'assistant', contenuto: risposta });
    await admin.from('usage_chat').insert({ user_id: user.id, data: oggi });

    // 8) Estrazione memoria in background: solo se il messaggio è lungo OPPURE
    // ogni 3 scambi (quello che viene prima). Non rallenta la risposta.
    const { count: nUser } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ruolo', 'user');
    const deveEstrarre = testo.length > SOGLIA_ESTRAZIONE || ((nUser ?? 0) % OGNI_N_SCAMBI === 0);
    if (deveEstrarre) {
      const trascrizione = [
        ...storico.slice(-4).map((m) => `${m.ruolo === 'assistant' ? 'Tutor' : 'Studente'}: ${m.contenuto}`),
        `Studente: ${testo}`,
        `Tutor: ${risposta}`,
      ].join('\n');
      const lavoro = estraiMemoria(anthropic, clientUtente, user.id, trascrizione, note);
      const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(lavoro);
      else lavoro.catch((e) => console.error('estrazione:', e));
    }

    return json({ risposta });
  } catch (e) {
    console.error('Errore interno chat:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
