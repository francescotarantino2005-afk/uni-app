// Edge Function coda-domande: ripropone in chat, UNA alla volta, le domande
// rimaste in profiles.domande_in_coda. Due azioni:
//   { azione: 'apri' }                      -> lo studente ha aperto la chat: se le
//        regole lo permettono (logica.ts) scrive la domanda come messaggio del bot.
//        Nessuna chiamata AI.
//   { azione: 'risposta', messaggio, id }   -> lo studente ha scritto mentre una
//        domanda era in attesa: UNA chiamata AI decide se e' una risposta. Se si',
//        salva il dato in profilo_studio e la domanda passa a "fatta"; se no, e'
//        "ignorata" (alla seconda volta "saltata") e l'app manda il messaggio
//        alla chat normale.
// Prima di tutto il CODICE allinea la coda al profilo: una chiave che ha gia'
// una risposta (data nel dialogo o altrove) non si chiede, e la sua domanda
// passa a "fatta". Lo stato della coda lo scrive solo questa funzione.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import {
  daProporre,
  esameEntro48Ore,
  inAttesa,
  leggiCoda,
  segnaIgnorata,
  segnaProposta,
  segnaRisposta,
  testoProposta,
} from './logica.ts';
import { allineaCoda, profiloCompleto } from '../accoglienza-dialogo/profilo.ts';

const MODELLO = 'claude-haiku-4-5';
const TIMEOUT_MS = 20_000;
const MAX_MESSAGGIO = 2000;
const CONFERMA_FISSA = 'Segnato, grazie.';
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

function dataOggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

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

/** Una frase sola, senza punti interrogativi: altrimenti "". */
function unaAffermazione(testo: string): string {
  const prima = testo.split(/(?<=[.!?…])\s+/).map((f) => f.trim()).filter(Boolean)[0] ?? '';
  return prima.includes('?') ? '' : prima;
}

function dataValida(testo: string, oggi: string): string | null {
  const m = testo.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null;
  const massimo = `${Number(oggi.slice(0, 4)) + 2}${oggi.slice(4)}`;
  return testo >= oggi && testo <= massimo ? testo : null;
}

const STRUMENTO = {
  name: 'giudizio',
  description: 'Dice se il messaggio dello studente risponde alla domanda in attesa e cosa se ne ricava.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['risponde', 'conferma', 'esame_indice', 'esame_nome', 'data', 'avanzamento', 'minuti', 'ostacolo'],
    properties: {
      risponde: { type: 'boolean', description: 'true solo se il messaggio risponde davvero alla domanda in attesa.' },
      conferma: { type: 'string', description: 'UNA frase breve che prende atto della risposta. Mai una domanda. "" se risponde=false.' },
      esame_indice: { type: 'integer', description: "Domanda sull'esame: numero dell'esame nell'elenco (da 1), 0 se non e in elenco o altra domanda." },
      esame_nome: { type: 'string', description: 'Domanda sull\'esame: il nome con le PAROLE dello studente. "" altrimenti.' },
      data: { type: 'string', description: 'Domanda sul quando: AAAA-MM-GG solo se indica un giorno preciso. "" altrimenti.' },
      avanzamento: { type: 'string', enum: ['non_iniziato', 'a_meta', 'ripasso', 'sconosciuto'], description: 'Domanda sulla preparazione. "sconosciuto" se non si capisce o altra domanda.' },
      minuti: { type: 'integer', description: 'Domanda sul tempo: minuti al giorno se da una quantita. 0 altrimenti.' },
      ostacolo: { type: 'string', description: "Domanda sull'ostacolo: in poche parole sue. \"\" altrimenti." },
    },
  },
};

const SYSTEM = `Sei l'assistente di studio dentro un'app per studenti universitari italiani. Poco fa hai fatto allo studente una domanda rimasta in sospeso; ora lui ha scritto un messaggio. Decidi con lo strumento "giudizio" se quel messaggio è la risposta alla tua domanda.

- risponde=true solo se il messaggio risponde davvero alla domanda, anche in modo vago ma sincero ("a gennaio credo", "poco").
- risponde=false se parla d'altro, fa una sua domanda, o non risponde ("boh", "non so", "dopo", una battuta). In quel caso non estrarre nulla e lascia conferma "".
- conferma: UNA frase breve, in italiano, che prende atto. Niente domande, niente complimenti di circostanza, niente emoji, niente calcoli sul tempo.
- Esami: puoi nominare SOLO gli esami in <esami_noti> o quello che lo studente ha scritto, con le sue parole. Mai inventare o correggere un nome. L'elenco è parziale: un esame che non c'è va bene così.
- Estrai solo il dato che riguarda la domanda in attesa, senza indovinare: gli altri campi restano vuoti ("" / 0 / sconosciuto).`;

type Giudizio = {
  risponde: boolean;
  conferma: string;
  esame_indice: number;
  esame_nome: string;
  data: string;
  avanzamento: string;
  minuti: number;
  ostacolo: string;
};

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

    const corpo = await req.json().catch(() => ({}));
    const azione = corpo.azione;
    if (azione !== 'apri' && azione !== 'risposta') return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const [profiloR, esamiR] = await Promise.all([
      admin
        .from('profiles')
        .select('accoglienza_stato, profilo_studio, domande_in_coda')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('exams')
        .select('id, materia, data_esame')
        .eq('user_id', user.id)
        .is('voto', null)
        .eq('idoneita', false),
    ]);
    const profilo = profiloR.data;
    // La coda si ripropone solo ad accoglienza finita.
    const stato = profilo?.accoglienza_stato ?? null;
    if (!profilo || (stato !== null && stato !== 'completata')) {
      return json(azione === 'apri' ? { messaggio: null } : { tipo: 'nessuna' });
    }
    // Una chiave gia' piena non si chiede: la sua domanda passa a "fatta" e la
    // coda corretta viene salvata subito, qualunque cosa succeda dopo.
    const studio = profiloCompleto(profilo.profilo_studio);
    const letta = leggiCoda(profilo.domande_in_coda);
    const coda = leggiCoda(allineaCoda(letta, studio, false));
    if (JSON.stringify(coda) !== JSON.stringify(letta)) {
      await admin.from('profiles').update({ domande_in_coda: coda }).eq('id', user.id);
    }
    const esami = (esamiR.data ?? []) as { id: string; materia: string; data_esame: string | null }[];
    const oggi = dataOggiRoma();

    // --- APRI: proporre o tacere, senza AI ---
    if (azione === 'apri') {
      const domanda = daProporre(coda, oggi, esameEntro48Ore(esami.map((e) => e.data_esame), oggi));
      if (!domanda) return json({ messaggio: null });
      const testo = testoProposta(domanda);
      const { error: erroreMsg } = await admin
        .from('chat_messages')
        .insert({ user_id: user.id, ruolo: 'assistant', contenuto: testo });
      if (erroreMsg) return json({ messaggio: null });
      await admin
        .from('profiles')
        .update({ domande_in_coda: segnaProposta(coda, domanda.id, oggi) })
        .eq('id', user.id);
      return json({ messaggio: testo });
    }

    // --- RISPOSTA: il messaggio risponde alla domanda in attesa? ---
    const pendente = inAttesa(coda);
    if (!pendente) return json({ tipo: 'nessuna' });
    const messaggio = pulisci(corpo.messaggio, MAX_MESSAGGIO);
    if (!messaggio) return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    const idMsg = typeof corpo.id === 'string' && UUID_RE.test(corpo.id) ? corpo.id : crypto.randomUUID();

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });
    const contesto = [
      `Oggi è ${oggi} (ti serve solo per capire le date che dice lo studente).`,
      `<esami_noti>\n${esami.length ? esami.map((e, i) => `${i + 1}. ${e.materia}`).join('\n') : '(nessuno in elenco)'}\n</esami_noti>`,
      `<domanda_in_attesa argomento="${pendente.chiave}">${pendente.testo}</domanda_in_attesa>`,
      `<messaggio_studente>${messaggio}</messaggio_studente>`,
    ].join('\n');

    let t = null as Giudizio | null;
    try {
      const out = await anthropic.messages.create({
        model: MODELLO,
        max_tokens: 300,
        system: SYSTEM,
        tools: [STRUMENTO],
        tool_choice: { type: 'tool', name: 'giudizio' },
        messages: [{ role: 'user', content: contesto }],
      });
      const blocco = out.content.find((b) => b.type === 'tool_use');
      t = (blocco && 'input' in blocco ? blocco.input : null) as Giudizio | null;
    } catch (e) {
      console.error('Giudizio AI fallito:', e);
    }
    // AI non disponibile: la domanda resta in attesa, il messaggio va alla chat normale.
    if (!t) return json({ tipo: 'errore' });

    // Se risponde, la chiave salva SEMPRE le parole dello studente; data, minuti
    // e livello sono in piu', solo quando si riescono a ricavare con certezza.
    let valore: unknown = null;
    let nomeEsame: string | null = null;
    const testo = messaggio.slice(0, 400);
    if (t.risponde === true) {
      if (pendente.chiave === 'esame_target') {
        const scelto = esami[Number(t.esame_indice) - 1];
        const proposto = pulisci(t.esame_nome, 120);
        const scritto = proposto && normalizza(messaggio).includes(normalizza(proposto)) ? proposto : null;
        nomeEsame = scelto ? scelto.materia : scritto;
        valore = { testo, nome: nomeEsame, id: scelto ? scelto.id : null };
      } else if (pendente.chiave === 'quando') {
        valore = { testo, data: dataValida(String(t.data ?? ''), oggi) };
      } else if (pendente.chiave === 'avanzamento') {
        valore = {
          testo,
          livello: ['non_iniziato', 'a_meta', 'ripasso'].includes(t.avanzamento) ? t.avanzamento : null,
        };
      } else if (pendente.chiave === 'tempo_al_giorno') {
        const minuti = Number(t.minuti);
        valore = {
          testo,
          minuti: Number.isInteger(minuti) && minuti >= 5 && minuti <= 960 ? minuti : null,
        };
      } else if (pendente.chiave === 'ostacolo') {
        valore = testo;
      }
    }

    if (valore == null) {
      await admin
        .from('profiles')
        .update({ domande_in_coda: segnaIgnorata(coda, pendente.id) })
        .eq('id', user.id);
      return json({ tipo: 'ignorata' });
    }

    // Risposta valida: dato nel profilo, nota grezza sempre, domanda "fatta".
    const { error: erroreProfilo } = await admin
      .from('profiles')
      .update({
        profilo_studio: {
          ...studio,
          [pendente.chiave]: valore,
          note_libere: [
            ...studio.note_libere,
            { domanda: pendente.testo, risposta: messaggio, il: new Date().toISOString(), chiave: pendente.chiave },
          ],
        },
        domande_in_coda: segnaRisposta(coda, pendente.id),
      })
      .eq('id', user.id);
    if (erroreProfilo) {
      console.error('Salvataggio risposta fallito:', erroreProfilo);
      return json({ tipo: 'errore' });
    }

    // La conferma non nomina esami diversi da quello appena scelto.
    let conferma = unaAffermazione(pulisci(t.conferma, 200));
    const altro = esami.some((e) => {
      const n = normalizza(e.materia);
      return n !== normalizza(nomeEsame ?? '') && ` ${normalizza(conferma)} `.includes(` ${n} `);
    });
    if (!conferma || altro) conferma = CONFERMA_FISSA;

    const base = Date.now();
    await admin
      .from('chat_messages')
      .upsert(
        { id: idMsg, user_id: user.id, ruolo: 'user', contenuto: messaggio, created_at: new Date(base).toISOString() },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    await admin.from('chat_messages').insert({
      user_id: user.id,
      ruolo: 'assistant',
      contenuto: conferma,
      created_at: new Date(base + 1).toISOString(),
    });

    return json({ tipo: 'risposta', risposta: conferma });
  } catch (e) {
    console.error('Errore interno coda-domande:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
