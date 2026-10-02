// Edge Function accoglienza-dialogo: UN turno del dialogo di accoglienza.
// Tutte le regole (cosa si estrae, quale domanda viene dopo, quando si chiude,
// quante frasi ha la battuta) stanno in logica.ts, che e' pura e coperta dai
// test. Qui c'e' solo il contorno: login, tetto anti-abuso, chiamata al modello,
// scrittura dei messaggi in chat_messages (il client non puo'), cosi' il dialogo
// diventa la prima conversazione della chat.
// L'unico ingresso e' quello autenticato: nessuna modalita' di prova.
//   input  -> nome_bot, conversazione (tutta), profilo_studio, chieste, libretto
//   output -> { risposta_bot, profilo_studio, chieste, prossima_chiave, fine, aiuto }
// Il profilo (profilo_studio, coda, stato) lo salva l'app col meccanismo
// dell'accoglienza.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  CHIAVI,
  type Chiave,
  type EsameElenco,
  type Messaggio,
  elaboraTurno,
  leggiGrezzo,
  profiloCompleto,
  pulisci,
  richiestaModello,
} from './logica.ts';

const TIMEOUT_MS = 25_000;
const MAX_MESSAGGIO = 1000;
const MAX_CONVERSAZIONE = 14;
const MAX_ARRETRATI = 12;
const MAX_ESAMI = 60;
const CAP_MESSAGGI_24H = 60; // anti-abuso: il dialogo ne scrive una dozzina

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

function messaggi(valore: unknown, massimo: number): Messaggio[] {
  return (Array.isArray(valore) ? valore : [])
    .slice(-massimo)
    .map((m: { ruolo?: unknown; contenuto?: unknown }) => ({
      ruolo: m?.ruolo === 'assistant' ? ('assistant' as const) : ('user' as const),
      contenuto: pulisci(m?.contenuto, MAX_MESSAGGIO),
    }))
    .filter((m: Messaggio) => m.contenuto);
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
    const conversazione = messaggi(corpo.conversazione, MAX_CONVERSAZIONE);
    const ultimo = conversazione[conversazione.length - 1];
    const chieste = (Array.isArray(corpo.chieste) ? corpo.chieste : []).filter(
      (k: unknown, i: number, tutte: unknown[]) =>
        (CHIAVI as readonly unknown[]).includes(k) && tutte.indexOf(k) === i
    ) as Chiave[];
    if (!ultimo || ultimo.ruolo !== 'user' || chieste.length === 0) {
      return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
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
    const arretrati = messaggi(corpo.arretrati, MAX_ARRETRATI);

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

    // 4) Chiamata al modello: una per turno, con timeout.
    const input = {
      nomeBot: pulisci(corpo.nome_bot, 40) || 'Lode',
      oggi: dataOggiRoma(),
      conversazione,
      profilo: profiloCompleto(corpo.profilo_studio),
      chieste,
      esami,
      libretto: {
        media: typeof libretto.media === 'number' ? libretto.media : null,
        cfu: typeof libretto.cfu === 'number' ? libretto.cfu : 0,
      },
    };
    const controllo = new AbortController();
    const scadenza = setTimeout(() => controllo.abort(), TIMEOUT_MS);
    let grezzo = null;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controllo.signal,
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(richiestaModello(input)),
      });
      if (r.ok) grezzo = leggiGrezzo(await r.json());
      else console.error('Dialogo AI: risposta', r.status, (await r.text()).slice(0, 300));
    } catch (e) {
      console.error('Dialogo AI fallito:', e);
      if (controllo.signal.aborted) return json({ errore: 'TIMEOUT' }, 504);
    } finally {
      clearTimeout(scadenza);
    }
    // Senza una risposta valida del modello l'app usa il suo ripiego (testi fissi).
    if (!grezzo) return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);

    // 5) Il turno lo decide la logica: profilo, prossima domanda, battuta.
    const esito = elaboraTurno(input, grezzo);

    // 6) Il dialogo diventa la prima conversazione della chat. Prima i turni
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
      { ruolo: 'user', contenuto: ultimo.contenuto },
      { ruolo: 'assistant', contenuto: esito.risposta_bot },
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
      risposta_bot: esito.risposta_bot,
      profilo_studio: esito.profilo,
      chieste: esito.chieste,
      prossima_chiave: esito.prossima_chiave,
      fine: esito.fine,
      aiuto: esito.aiuto,
      messaggi_salvati: !erroreScrittura,
    });
  } catch (e) {
    console.error('Errore interno:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
