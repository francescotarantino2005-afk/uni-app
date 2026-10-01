// Edge Function accoglienza-dialogo: UN turno del dialogo di accoglienza.
// Cinque domande a intenzione fissa (esame_target, quando, avanzamento, tempo,
// ostacolo), risposta a testo libero. Per ogni turno:
//   input  → nome_bot, numero, risposta, profilo_studio, riassunto del libretto
//   output → { risposta_bot, chiave, valore, prossima_domanda }
// Il profilo (profilo_studio, coda, stato) lo salva l'app col meccanismo
// dell'accoglienza; qui si scrivono solo i messaggi in chat_messages (il client
// non può), così il dialogo diventa la prima conversazione della chat.
// Garanzie lato codice, oltre al prompt:
// - l'esame target viene dall'elenco passato (per indice) o dalle parole dello
//   studente: il modello non può introdurre un nome d'esame nel profilo;
// - date e minuti sono validati; un valore non valido diventa null;
// - dopo un chiarimento si va avanti comunque; la chiusura nomina l'esame target.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

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
  "a che punto è con la preparazione di quell'esame",
  'quanto tempo ha di solito per studiare in un giorno',
  'cosa va storto di solito quando studia',
];

// Testi fissi (gli stessi dell'app): usati quando il modello non formula la domanda.
const DOMANDE_FISSE = [
  'Qual è il primo esame che devi dare?',
  'Quando lo devi dare? Va bene anche a grandi linee.',
  'A che punto sei con la preparazione?',
  'Quanto tempo riesci a dedicare allo studio in una giornata normale?',
  'Cosa va storto di solito quando ti metti a studiare?',
];

const STRUMENTO = {
  name: 'turno',
  description: 'Registra il turno del dialogo: la battuta del bot e ciò che si capisce dalla risposta dello studente.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: [
      'risposta_bot',
      'non_risposta',
      'chiede_chiarimento',
      'esame_indice',
      'esame_nome',
      'data',
      'avanzamento',
      'minuti',
      'ostacolo',
    ],
    properties: {
      risposta_bot: { type: 'string', description: 'La battuta del bot: massimo due frasi, testo semplice.' },
      non_risposta: { type: 'boolean', description: 'true se lo studente non ha risposto davvero ("boh", "non so", fuori tema).' },
      chiede_chiarimento: { type: 'boolean', description: 'true se risposta_bot chiede un chiarimento invece di passare alla domanda successiva.' },
      esame_indice: { type: 'integer', description: "Domanda 1: numero dell'esame nell'elenco fornito (da 1). 0 se non è nell'elenco o non è la domanda 1." },
      esame_nome: { type: 'string', description: 'Domanda 1: il nome dell\'esame con le PAROLE dello studente. "" altrimenti.' },
      data: { type: 'string', description: 'Domanda 2: AAAA-MM-GG solo se lo studente indica un giorno preciso. "" se vago o altra domanda.' },
      avanzamento: { type: 'string', enum: ['non_iniziato', 'a_meta', 'ripasso', 'sconosciuto'], description: 'Domanda 3. "sconosciuto" se non si capisce o altra domanda.' },
      minuti: { type: 'integer', description: 'Domanda 4: minuti di studio al giorno se lo studente dà una quantità. 0 se vago o altra domanda.' },
      ostacolo: { type: 'string', description: "Domanda 5: l'ostacolo in poche parole, fedele a ciò che ha detto. \"\" altrimenti." },
    },
  },
};

const SYSTEM = `Sei l'assistente di studio dentro un'app per studenti universitari italiani. Stai facendo la conoscenza dello studente con cinque domande, una alla volta. Ricevi la domanda a cui ha appena risposto e scrivi la battuta successiva con lo strumento "turno".

Come scrivi risposta_bot:
- Massimo DUE frasi, in italiano, tono da compagno di corso sveglio. Testo semplice: niente markdown, niente elenchi, niente emoji.
- Reagisci a quello che ha detto, non riassumerlo e non ripeterglielo.
- Poi, nella stessa battuta, fai la domanda successiva con parole tue (l'intenzione ti viene indicata). Una sola domanda.
- Se è l'ultima domanda (la quinta): nessuna domanda, solo una frase di chiusura che nomina l'esame target, se c'è.

Esami — regola tassativa:
- Puoi nominare SOLO gli esami che compaiono in <esami_da_sostenere> oppure l'esame che lo studente stesso ha scritto, con le sue parole. Non inventare, non completare, non correggere e non dedurre mai un nome d'esame. Se non hai un nome sicuro, di' "quell'esame".
- Non citare voti, medie, CFU o date che non siano in <libretto> o nelle parole dello studente.

Risposte deboli:
- Se lo studente non risponde davvero ("boh", "non so", "vedremo", fuori tema): non_risposta=true. Non insistere e non ripetere la domanda: passaci sopra con una frase leggera e fai la domanda successiva.
- Se la risposta è ambigua ma contiene qualcosa, puoi chiedere UN chiarimento breve: chiede_chiarimento=true e risposta_bot contiene solo quel chiarimento. Se <chiarimento_gia_chiesto> è "sì", è vietato chiederne un altro: prendi quello che c'è e vai avanti.

Cosa estrai (solo per la domanda corrente, senza indovinare):
- Domanda 1: esame_indice = numero dell'esame in <esami_da_sostenere> se lo studente intende chiaramente quello, altrimenti 0; esame_nome = il nome come l'ha scritto lui.
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
    ? `Perfetto, ora so da dove partire: ${nomeEsame}. Ci vediamo dentro.`
    : 'Perfetto, ora so da dove partire. Ci vediamo dentro.';
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
      .eq('id', user.id)
      .maybeSingle();
    if (!String(profilo?.accoglienza_stato ?? '').startsWith('dialogo')) {
      return json({ errore: 'NON_IN_DIALOGO' }, 409);
    }
    const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', da);
    if ((count ?? 0) >= CAP_MESSAGGI_24H) return json({ errore: 'LIMITE_RAGGIUNTO' }, 429);

    // 4) Chiamata AI: un turno, tool forzato, timeout.
    const oggi = dataOggiRoma();
    const target = profiloStudio.esame_target as { nome?: unknown } | undefined;
    const nomeTargetPrima = pulisci(target?.nome, 120) || null;
    const ultima = numero === 5;

    const contesto = [
      `Ti chiami ${nomeBot}. Oggi è ${oggi}.`,
      `<libretto>media: ${typeof libretto.media === 'number' ? libretto.media.toFixed(2) : 'nessuna'}, CFU acquisiti: ${typeof libretto.cfu === 'number' ? libretto.cfu : 0}</libretto>`,
      `<esami_da_sostenere>\n${esami.length ? esami.map((e, i) => `${i + 1}. ${e.materia}`).join('\n') : '(nessuno in elenco)'}\n</esami_da_sostenere>`,
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
        ? 'Questa è l\'ultima domanda: scrivi solo la frase di chiusura.'
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
        model: 'claude-haiku-4-5',
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
      risposta_bot: string;
      non_risposta: boolean;
      chiede_chiarimento: boolean;
      esame_indice: number;
      esame_nome: string;
      data: string;
      avanzamento: string;
      minuti: number;
      ostacolo: string;
    } | null;
    if (!t) return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);

    // 5) Valore strutturato, validato qui. Non-risposta → null.
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

    // 6) Battuta e prossima domanda. Un solo chiarimento, mai sull'ultima né su un "boh".
    const chiarisce = t.chiede_chiarimento === true && !chiarimentoFatto && !nonRisposta && !ultima;
    let rispostaBot = pulisci(t.risposta_bot, MAX_TESTO_BOT);
    let prossima: number | null;
    if (chiarisce && rispostaBot) {
      prossima = numero;
    } else if (ultima) {
      prossima = null;
      // La chiusura nomina l'esame target: se il modello non l'ha fatto, testo fisso.
      if (!rispostaBot || (nomeTarget && !normalizza(rispostaBot).includes(normalizza(nomeTarget)))) {
        rispostaBot = chiusuraFissa(nomeTarget);
      }
    } else {
      prossima = numero + 1;
      // Si va avanti comunque: se la battuta non contiene una domanda, si aggiunge quella fissa.
      if (!rispostaBot.includes('?')) {
        rispostaBot = `${rispostaBot} ${DOMANDE_FISSE[numero]}`.trim();
      }
    }

    // 7) Il dialogo diventa la prima conversazione della chat. Prima i turni
    // rimasti indietro (function fallita in precedenza), senza duplicare quelli
    // già scritti; poi la risposta dello studente e la battuta del bot.
    const { data: recenti } = await admin
      .from('chat_messages')
      .select('ruolo, contenuto')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    const giaScritti = new Set((recenti ?? []).map((m) => `${m.ruolo}|${m.contenuto}`));
    const daScrivere: Messaggio[] = [
      ...arretrati.filter((m) => !giaScritti.has(`${m.ruolo}|${m.contenuto}`)),
      { ruolo: 'user', contenuto: risposta },
      { ruolo: 'assistant', contenuto: rispostaBot },
    ];
    // created_at espliciti e crescenti: l'ordine di rilettura è deterministico.
    const base = Date.now();
    const { error: erroreScrittura } = await admin.from('chat_messages').insert(
      daScrivere.map((m, i) => ({
        user_id: user.id,
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
