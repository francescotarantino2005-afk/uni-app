// Edge Function accoglienza-dialogo: UN turno del dialogo di accoglienza.
// Cinque domande a intenzione fissa (esame_target, quando, avanzamento, tempo,
// ostacolo), risposta a testo libero. Per ogni turno:
//   input  -> nome_bot, numero, risposta, profilo_studio, riassunto del libretto
//   output -> { risposta_bot, chiave, valore, prossima_domanda }
// Il profilo (profilo_studio, coda, stato) lo salva l'app col meccanismo
// dell'accoglienza; qui si scrivono solo i messaggi in chat_messages (il client
// non puo'), cosi' il dialogo diventa la prima conversazione della chat.
//
// Il modello NON scrive la battuta intera: restituisce pezzi separati (reazione,
// domanda successiva, chiarimento, chiusura) e la battuta la compone il codice.
// Garanzie lato codice, oltre al prompt:
// - massimo due frasi: una di reazione e una di domanda (o la chiusura);
// - dopo una non-risposta la domanda successiva e' il testo fisso: il bot non
//   puo' insistere ne' ripetere la domanda;
// - un chiarimento e' una sola frase, una volta sola, mai insieme ad altro;
// - l'esame target viene dall'elenco passato (per indice) o dalle parole dello
//   studente: il modello non puo' introdurre un nome d'esame nel profilo;
// - date e minuti sono validati; un valore non valido diventa null;
// - la chiusura nomina l'esame target, altrimenti si usa il testo fisso;
// - un pezzo che nomina un esame dell'elenco DIVERSO dal target (o un esame
//   qualsiasi, se lo studente non ne ha scelto uno) viene scartato.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const MODELLO = 'claude-haiku-4-5';
const TIMEOUT_MS = 20_000;
const MAX_RISPOSTA = 1000;
const MAX_TESTO_BOT = 600;
const MAX_ARRETRATI = 12;
const MAX_ESAMI = 60;
const CAP_MESSAGGI_24H = 60; // anti-abuso: il dialogo ne scrive una dozzina

/** Oggi nel fuso italiano, "AAAA-MM-GG" (stessa logica di _shared/briefing.ts; qui per avere un file unico). */
function dataOggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

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

const CHIAVI = ['esame_target', 'quando', 'avanzamento', 'tempo_al_giorno', 'ostacolo'] as const;

const INTENZIONI = [
  'quale esame deve dare per primo',
  "quando deve dare quell'esame (va bene anche una risposta vaga)",
  "a che punto e' con la preparazione di quell'esame",
  'quanto tempo ha di solito per studiare in un giorno',
  'cosa va storto di solito quando studia',
];

// Testi fissi (gli stessi dell'app), una frase ciascuno: usati dopo una
// non-risposta e quando il modello non formula una domanda valida.
const DOMANDE_FISSE = [
  'Qual è il primo esame che devi dare?',
  'Quando lo devi dare, anche a grandi linee?',
  'A che punto sei con la preparazione?',
  'Quanto tempo riesci a dedicare allo studio in una giornata normale?',
  'Cosa va storto di solito quando ti metti a studiare?',
];

const PASSA_OLTRE = 'Nessun problema, ci torniamo.';
const PRESA_NOTA = 'Ok, segnato.';

const STRUMENTO = {
  name: 'turno',
  description: 'Registra il turno del dialogo: i pezzi della battuta del bot e cio che si capisce dalla risposta dello studente.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: [
      'reazione',
      'domanda_successiva',
      'chiarimento',
      'chiusura',
      'non_risposta',
      'esame_indice',
      'esame_nome',
      'data',
      'avanzamento',
      'minuti',
      'ostacolo',
    ],
    properties: {
      reazione: { type: 'string', description: 'UNA frase che reagisce a cio che ha detto lo studente. Mai una domanda, mai un punto interrogativo.' },
      domanda_successiva: { type: 'string', description: 'UNA frase: la domanda successiva, con un solo punto interrogativo. "" se e la quinta domanda.' },
      chiarimento: { type: 'string', description: 'UNA frase con un solo punto interrogativo, solo se serve un chiarimento sulla risposta appena data. "" altrimenti.' },
      chiusura: { type: 'string', description: 'Solo alla quinta domanda: UNA frase di chiusura che nomina l\'esame target. "" altrimenti.' },
      non_risposta: { type: 'boolean', description: 'true se lo studente non ha risposto davvero alla domanda.' },
      esame_indice: { type: 'integer', description: "Domanda 1: numero dell'esame nell'elenco fornito (da 1). 0 se non e nell'elenco o non e la domanda 1." },
      esame_nome: { type: 'string', description: 'Domanda 1: il nome dell\'esame con le PAROLE dello studente. "" altrimenti.' },
      data: { type: 'string', description: 'Domanda 2: AAAA-MM-GG solo se lo studente indica un giorno preciso. "" se vago o altra domanda.' },
      avanzamento: { type: 'string', enum: ['non_iniziato', 'a_meta', 'ripasso', 'sconosciuto'], description: 'Domanda 3. "sconosciuto" se non si capisce o altra domanda.' },
      minuti: { type: 'integer', description: 'Domanda 4: minuti di studio al giorno se lo studente da una quantita. 0 se vago o altra domanda.' },
      ostacolo: { type: 'string', description: "Domanda 5: l'ostacolo in poche parole, fedele a cio che ha detto. \"\" altrimenti." },
    },
  },
};

const SYSTEM = `Sei l'assistente di studio dentro un'app per studenti universitari italiani. Stai facendo la conoscenza dello studente con cinque domande, una alla volta. Ricevi la domanda a cui ha appena risposto e prepari il turno successivo con lo strumento "turno".

Come parli:
- Italiano corretto, tono da compagno di corso sveglio. Parli in prima persona singolare (io) e dai del tu.
- Testo semplice: niente markdown, niente elenchi, niente emoji.
- Niente complimenti di circostanza ("ottima scelta", "perfetto", "bene", "un buon ritmo") e niente prediche.
- Non fare calcoli sul tempo che manca o che serve (mesi, settimane, giorni) e non valutare se una data è vicina o lontana.
- Non promettere funzioni precise dell'app.
- Se <gia_raccolto> non ha un esame_target, lo studente non ha scelto nessun esame: non nominarne nessuno, nemmeno dall'elenco.

I pezzi del turno:
- reazione: UNA frase che reagisce a quello che ha appena detto, senza riassumerlo e senza ripeterglielo. Non è mai una domanda.
- domanda_successiva: UNA frase, la domanda sull'intenzione successiva che ti viene indicata, con parole tue. Riguarda SOLO quell'intenzione: non tornare sulla domanda appena fatta.
- chiarimento: quasi sempre "". Solo se la risposta è ambigua ma contiene qualcosa (per esempio indica un esame senza che si capisca quale), UNA domanda breve per chiarire. Se <chiarimento_gia_chiesto> è "sì", deve essere "".
- chiusura: solo se è la quinta domanda. UNA frase che chiude e nomina l'esame target, se c'è.

Esami — regola tassativa:
- Puoi nominare SOLO gli esami che compaiono in <esami_noti> oppure l'esame che lo studente stesso ha scritto, con le sue parole. Non inventare, non completare, non abbreviare, non correggere e non dedurre mai un nome d'esame. Se non hai un nome sicuro, di' "quell'esame".
- <esami_noti> è un elenco PARZIALE. Se lo studente nomina un esame che non c'è, è normale: prendilo con le sue parole e vai avanti. Non dirgli che non è in elenco, non metterlo in dubbio, non chiedere chiarimenti per questo.
- Non citare voti, medie, CFU o date che non siano in <libretto> o nelle parole dello studente.

Non-risposte:
- Se lo studente non risponde davvero ("boh", "non so", "non lo so, sono messo male", "vedremo", "mo vedo", "dipende", "non mi va", una provocazione, una battuta, una risposta fuori tema): non_risposta=true.
- In quel caso la reazione è una frase leggera che ci passa sopra. Non insistere, non riproporre la domanda, non elencargli opzioni, non offenderti e non giustificarti.
- Vale anche per una risposta che non c'entra con la domanda: se chiedi a che punto è con la preparazione e risponde con un voto o una spacconata ("30 e lode ovviamente"), è una battuta, non un'informazione. non_risposta=true e nessun dato estratto.
- Una risposta vaga ma sincera NON è una non-risposta: "zero, non ho tempo", "poco", "a gennaio credo" sono risposte. non_risposta=false, e il dato preciso che manca resta vuoto.

Cosa estrai (solo per la domanda corrente, senza indovinare):
- Domanda 1: esame_indice = numero dell'esame in <esami_noti> se lo studente intende chiaramente quello, altrimenti 0; esame_nome = il nome come l'ha scritto lui.
- Domanda 2: data solo se indica un giorno preciso (anche relativo, es. "dopodomani"); "a gennaio", "tra un po'" → "".
- Domanda 3: non_iniziato, a_meta, ripasso; se non si capisce, sconosciuto.
- Domanda 4: minuti al giorno solo se dà una quantità ("un paio d'ore" → 120); "dipende", "poco" → 0.
- Domanda 5: l'ostacolo in poche parole sue.
I campi delle altre domande restano vuoti ("" / 0 / sconosciuto).`;

type Messaggio = { ruolo: 'user' | 'assistant'; contenuto: string };
type EsameElenco = { id: string | null; materia: string };

function pulisci(testo: unknown, max: number): string {
  return typeof testo === 'string' ? testo.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Spezza in frasi sul punto fermo, esclamativo, interrogativo o sui puntini. */
function frasi(testo: string): string[] {
  return testo
    .split(/(?<=[.!?…])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Una frase sola, senza punti interrogativi: altrimenti "" (si usa il testo fisso). */
function unaAffermazione(testo: string): string {
  const prima = frasi(testo)[0] ?? '';
  return prima.includes('?') ? '' : prima;
}

/** Una frase sola con esattamente un punto interrogativo: altrimenti "". */
function unaDomanda(testo: string): string {
  const tutte = frasi(testo);
  const ultima = tutte[tutte.length - 1] ?? '';
  return (ultima.match(/\?/g) ?? []).length === 1 && ultima.endsWith('?') ? ultima : '';
}

/** Toglie il complimento di circostanza in testa alla frase ("Perfetto, ...", "Bene, ..."). */
function senzaComplimento(frase: string): string {
  const resto = frase.replace(/^(perfetto|benissimo|bene|ottimo|ottima scelta|okay|okkey|ok)[,.!]\s*/i, '');
  return resto ? resto.charAt(0).toUpperCase() + resto.slice(1) : '';
}

/**
 * true se il testo nomina un esame dell'elenco che NON e' il target (o un esame
 * qualsiasi dell'elenco, se un target non c'e'): lo studente non l'ha scelto.
 */
function nominaAltroEsame(testo: string, esami: EsameElenco[], nomeTarget: string | null): boolean {
  const t = ` ${normalizza(testo)} `;
  const target = nomeTarget ? normalizza(nomeTarget) : '';
  return esami.some((e) => {
    const n = normalizza(e.materia);
    return n !== target && t.includes(` ${n} `);
  });
}

/** AAAA-MM-GG reale, da oggi a due anni: altrimenti null (mai una data indovinata). */
function dataValida(testo: string, oggi: string): string | null {
  const m = testo.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null;
  const massimo = `${Number(oggi.slice(0, 4)) + 2}${oggi.slice(4)}`;
  return testo >= oggi && testo <= massimo ? testo : null;
}

function chiusuraFissa(nomeEsame: string | null): string {
  return nomeEsame
    ? `Ora so da dove partire: ${nomeEsame}. Ci vediamo dentro.`
    : 'Ora so da dove partire. Ci vediamo dentro.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ errore: 'METODO_NON_VALIDO' }, 405);

  try {
    // 1) Solo utenti loggati.
    const clientUtente = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const {
      data: { user },
    } = await clientUtente.auth.getUser();
    if (!user) return json({ errore: 'NON_AUTORIZZATO' }, 401);
    const userId = user.id;

    // 2) Input.
    const corpo = await req.json().catch(() => ({}));
    const numero = Number(corpo.numero);
    const risposta = pulisci(corpo.risposta, MAX_RISPOSTA);
    if (!Number.isInteger(numero) || numero < 1 || numero > 5 || !risposta) {
      return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
    const nomeBot = pulisci(corpo.nome_bot, 40) || 'Lode';
    const domandaTesto = pulisci(corpo.domanda_testo, MAX_TESTO_BOT) || DOMANDE_FISSE[numero - 1];
    const chiarimentoFatto = corpo.chiarimento === true;
    const profiloStudio = (corpo.profilo_studio && typeof corpo.profilo_studio === 'object'
      ? corpo.profilo_studio
      : {}) as Record<string, unknown>;
    const libretto = (corpo.libretto && typeof corpo.libretto === 'object' ? corpo.libretto : {}) as {
      media?: unknown;
      cfu?: unknown;
      da_sostenere?: unknown;
    };
    const esami: EsameElenco[] = (Array.isArray(libretto.da_sostenere) ? libretto.da_sostenere : [])
      .slice(0, MAX_ESAMI)
      .map((e: { id?: unknown; materia?: unknown }) => ({
        id: typeof e?.id === 'string' ? e.id : null,
        materia: pulisci(e?.materia, 120),
      }))
      .filter((e: EsameElenco) => e.materia);
    const arretrati: Messaggio[] = (Array.isArray(corpo.arretrati) ? corpo.arretrati : [])
      .slice(0, MAX_ARRETRATI)
      .map((m: { ruolo?: unknown; contenuto?: unknown }) => ({
        ruolo: m?.ruolo === 'assistant' ? ('assistant' as const) : ('user' as const),
        contenuto: pulisci(m?.contenuto, MAX_TESTO_BOT),
      }))
      .filter((m: Messaggio) => m.contenuto);

    // 3) Solo durante il dialogo di accoglienza, con un tetto anti-abuso.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: profilo } = await admin
      .from('profiles')
      .select('accoglienza_stato')
      .eq('id', userId)
      .maybeSingle();
    if (!String(profilo?.accoglienza_stato ?? '').startsWith('dialogo')) {
      return json({ errore: 'NON_IN_DIALOGO' }, 409);
    }
    const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', da);
    if ((count ?? 0) >= CAP_MESSAGGI_24H) return json({ errore: 'LIMITE_RAGGIUNTO' }, 429);

    // 4) Chiamata AI: un turno, tool forzato, timeout.
    const oggi = dataOggiRoma();
    const target = profiloStudio.esame_target as { nome?: unknown } | undefined;
    const nomeTargetPrima = pulisci(target?.nome, 120) || null;
    const ultima = numero === 5;

    const contesto = [
      `Ti chiami ${nomeBot}. Oggi è ${oggi} (ti serve solo per capire le date che dice lo studente).`,
      `<libretto>media: ${typeof libretto.media === 'number' ? libretto.media.toFixed(2) : 'nessuna'}, CFU acquisiti: ${typeof libretto.cfu === 'number' ? libretto.cfu : 0}</libretto>`,
      `<esami_noti>\n${esami.length ? esami.map((e, i) => `${i + 1}. ${e.materia}`).join('\n') : '(nessuno in elenco)'}\n</esami_noti>`,
      `<gia_raccolto>${JSON.stringify({
        esame_target: nomeTargetPrima,
        quando: (profiloStudio.quando as { testo?: unknown } | undefined)?.testo ?? null,
        avanzamento: profiloStudio.avanzamento ?? null,
      })}</gia_raccolto>`,
      `Domanda ${numero} di 5 — intenzione: ${INTENZIONI[numero - 1]}.`,
      `<battuta_del_bot>${domandaTesto}</battuta_del_bot>`,
      `<risposta_studente>${risposta}</risposta_studente>`,
      `<chiarimento_gia_chiesto>${chiarimentoFatto ? 'sì' : 'no'}</chiarimento_gia_chiesto>`,
      ultima
        ? 'Questa è la quinta e ultima domanda: domanda_successiva è "", scrivi reazione e chiusura.'
        : `Domanda successiva — intenzione: ${INTENZIONI[numero]}.`,
    ].join('\n');

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });

    let out: Anthropic.Message;
    try {
      out = await anthropic.messages.create({
        model: MODELLO,
        max_tokens: 400,
        system: SYSTEM,
        tools: [STRUMENTO],
        tool_choice: { type: 'tool', name: 'turno' },
        messages: [{ role: 'user', content: contesto }],
      });
    } catch (e) {
      console.error('Dialogo AI fallito:', e);
      if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ errore: 'TIMEOUT' }, 504);
      return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);
    }

    const blocco = out.content.find((b) => b.type === 'tool_use');
    const t = (blocco && 'input' in blocco ? blocco.input : null) as {
      reazione: string;
      domanda_successiva: string;
      chiarimento: string;
      chiusura: string;
      non_risposta: boolean;
      esame_indice: number;
      esame_nome: string;
      data: string;
      avanzamento: string;
      minuti: number;
      ostacolo: string;
    } | null;
    if (!t) return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);

    // 5) Valore strutturato, validato qui. Non-risposta -> null.
    const nonRisposta = t.non_risposta === true;
    let valore: unknown = null;
    let nomeTarget = nomeTargetPrima;
    if (!nonRisposta) {
      if (numero === 1) {
        const scelto = esami[Number(t.esame_indice) - 1];
        if (scelto) {
          valore = { nome: scelto.materia, id: scelto.id };
        } else {
          // Fuori elenco: vale solo un nome che lo studente ha scritto davvero.
          const proposto = pulisci(t.esame_nome, 120);
          const scritto = proposto && normalizza(risposta).includes(normalizza(proposto));
          valore = { nome: scritto ? proposto : risposta.slice(0, 120), id: null };
        }
        nomeTarget = (valore as { nome: string }).nome;
      } else if (numero === 2) {
        valore = { testo: risposta, data: dataValida(String(t.data ?? ''), oggi) };
      } else if (numero === 3) {
        valore = ['non_iniziato', 'a_meta', 'ripasso'].includes(t.avanzamento) ? t.avanzamento : null;
      } else if (numero === 4) {
        const minuti = Number(t.minuti);
        valore = {
          testo: risposta,
          minuti: Number.isInteger(minuti) && minuti >= 5 && minuti <= 960 ? minuti : null,
        };
      } else {
        valore = pulisci(t.ostacolo, 300) || risposta.slice(0, 300);
      }
    }

    // 6) La battuta la compone il codice, dai pezzi del modello.
    const lecito = (pezzo: string) => (nominaAltroEsame(pezzo, esami, nomeTarget) ? '' : pezzo);
    const reazione = senzaComplimento(lecito(unaAffermazione(pulisci(t.reazione, 300))));
    const chiarimento = unaDomanda(pulisci(t.chiarimento, 300));
    let rispostaBot: string;
    let prossima: number | null;
    if (chiarimento && !chiarimentoFatto && !nonRisposta && !ultima) {
      // Un solo chiarimento, da solo: si resta sulla stessa domanda.
      rispostaBot = chiarimento;
      prossima = numero;
    } else if (ultima) {
      prossima = null;
      const chiusura = senzaComplimento(lecito(unaAffermazione(pulisci(t.chiusura, 300))));
      const nominaTarget = !nomeTarget || normalizza(chiusura).includes(normalizza(nomeTarget));
      rispostaBot =
        chiusura && nominaTarget
          ? [reazione, chiusura].filter(Boolean).join(' ')
          : chiusuraFissa(nomeTarget);
    } else {
      prossima = numero + 1;
      // Dopo una non-risposta la domanda successiva e' quella fissa: niente insistenza.
      const domanda = nonRisposta
        ? DOMANDE_FISSE[numero]
        : lecito(unaDomanda(pulisci(t.domanda_successiva, 300))) || DOMANDE_FISSE[numero];
      rispostaBot = `${reazione || (nonRisposta ? PASSA_OLTRE : PRESA_NOTA)} ${domanda}`;
    }

    // 7) Il dialogo diventa la prima conversazione della chat. Prima i turni
    // rimasti indietro (function fallita in precedenza), senza duplicare quelli
    // gia' scritti; poi la risposta dello studente e la battuta del bot.
    const { data: recenti } = await admin
      .from('chat_messages')
      .select('ruolo, contenuto')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    const giaScritti = new Set((recenti ?? []).map((m) => `${m.ruolo}|${m.contenuto}`));
    const daScrivere: Messaggio[] = [
      ...arretrati.filter((m) => !giaScritti.has(`${m.ruolo}|${m.contenuto}`)),
      { ruolo: 'user', contenuto: risposta },
      { ruolo: 'assistant', contenuto: rispostaBot },
    ];
    // created_at espliciti e crescenti: l'ordine di rilettura e' deterministico.
    const base = Date.now();
    const { error: erroreScrittura } = await admin.from('chat_messages').insert(
      daScrivere.map((m, i) => ({
        user_id: userId,
        ruolo: m.ruolo,
        contenuto: m.contenuto,
        created_at: new Date(base + i).toISOString(),
      }))
    );
    if (erroreScrittura) console.error('Scrittura chat fallita:', erroreScrittura);

    return json({
      risposta_bot: rispostaBot,
      chiave: CHIAVI[numero - 1],
      valore,
      prossima_domanda: prossima,
      messaggi_salvati: !erroreScrittura,
    });
  } catch (e) {
    console.error('Errore interno:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
