// Edge Function estrai-orario: foto/screenshot dell'orario → lezioni strutturate.
// La chiave ANTHROPIC_API_KEY vive SOLO nei secrets di questa funzione.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const LIMITE_GIORNALIERO = 10; // estrazioni per utente nelle ultime 24h
const TIMEOUT_MS = 30_000;
const MAX_BASE64 = 7_000_000; // ~5MB di immagine

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LezioneEstratta = {
  titolo: string;
  giorno: number;
  ora_inizio: string;
  ora_fine: string | null;
  aula: string | null;
};

// Tool forzato: garantisce output JSON valido rispetto allo schema (strict).
// Niente union types nello schema (limite strict): i campi opzionali usano ""
// e vengono convertiti in null qui sotto.
const STRUMENTO_ESTRAZIONE = {
  name: 'salva_orario',
  description:
    "Salva le lezioni universitarie estratte dalla foto di un orario settimanale. " +
    "Se l'immagine non contiene un orario leggibile, imposta leggibile=false e lezioni=[].",
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['leggibile', 'lezioni'],
    properties: {
      leggibile: {
        type: 'boolean',
        description: "false se l'immagine non è un orario o è troppo sfocata/tagliata per leggerlo",
      },
      lezioni: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['titolo', 'giorno', 'ora_inizio', 'ora_fine', 'aula'],
          properties: {
            titolo: { type: 'string', description: 'Nome della materia, es. "Analisi Matematica 1"' },
            giorno: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7], description: '1=lunedì … 7=domenica' },
            ora_inizio: { type: 'string', description: 'Formato HH:MM (24h), es. "09:00"' },
            ora_fine: { type: 'string', description: 'Formato HH:MM, oppure "" se non indicata' },
            aula: { type: 'string', description: 'Aula/edificio, oppure "" se non indicata' },
          },
        },
      },
    },
  },
};

const PROMPT = `Questa è la foto (o screenshot) dell'orario settimanale delle lezioni di uno studente universitario italiano.
Estrai TUTTE le lezioni che riesci a leggere e salvale con lo strumento salva_orario.
Regole:
- giorno: 1=lunedì, 2=martedì, 3=mercoledì, 4=giovedì, 5=venerdì, 6=sabato, 7=domenica
- ora_inizio e ora_fine in formato 24 ore HH:MM
- se una lezione si ripete in più giorni, crea una voce per ogni giorno
- titolo: il nome della materia, senza codici del corso se possibile
- se un dato non c'è (ora di fine, aula) usa la stringa vuota ""
- se l'immagine NON è un orario leggibile, imposta leggibile=false e lezioni=[]`;

function normalizzaOra(testo: string): string | null {
  const m = testo.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const ore = Number(m[1]);
  if (ore > 23 || Number(m[2]) > 59) return null;
  return `${String(ore).padStart(2, '0')}:${m[2]}`;
}

function rispondi(corpo: unknown, stato: number): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return rispondi({ errore: 'METODO_NON_VALIDO' }, 405);
  }

  try {
    // 1) Solo utenti loggati: verifichiamo il JWT del chiamante.
    const clientUtente = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const {
      data: { user },
    } = await clientUtente.auth.getUser();
    if (!user) {
      return rispondi({ errore: 'NON_AUTORIZZATO' }, 401);
    }

    // 2) Rate limiting per utente (tabella accessibile solo con service role).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('usage_estrazioni')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', da);
    if ((count ?? 0) >= LIMITE_GIORNALIERO) {
      return rispondi({ errore: 'LIMITE_RAGGIUNTO' }, 429);
    }

    // 3) Input: immagine base64 (+ media type).
    const { immagine, media_type } = await req.json().catch(() => ({}));
    if (!immagine || typeof immagine !== 'string') {
      return rispondi({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
    if (immagine.length > MAX_BASE64) {
      return rispondi({ errore: 'IMMAGINE_TROPPO_GRANDE' }, 413);
    }
    const tipiValidi = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const tipo = tipiValidi.includes(media_type) ? media_type : 'image/jpeg';

    // Il tentativo si conta prima della chiamata AI (anti-abuso).
    await admin.from('usage_estrazioni').insert({ user_id: user.id });

    // 4) Chiamata vision con tool forzato e timeout.
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });

    let risposta: Anthropic.Message;
    try {
      risposta = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        tools: [STRUMENTO_ESTRAZIONE],
        tool_choice: { type: 'tool', name: 'salva_orario' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: tipo, data: immagine } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      });
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) {
        return rispondi({ errore: 'TIMEOUT' }, 504);
      }
      if (e instanceof Anthropic.APIError && e.status === 429) {
        return rispondi({ errore: 'SERVIZIO_OCCUPATO' }, 503);
      }
      console.error('Errore Anthropic:', e);
      return rispondi({ errore: 'ERRORE_AI' }, 502);
    }

    const blocco = risposta.content.find((b) => b.type === 'tool_use');
    const estratto = blocco?.input as
      | { leggibile: boolean; lezioni: LezioneEstratta[] }
      | undefined;

    if (!estratto || estratto.leggibile === false) {
      return rispondi({ errore: 'FOTO_ILLEGGIBILE' }, 422);
    }

    // 5) Normalizzazione e validazione finale lato server.
    const lezioni = (estratto.lezioni ?? [])
      .map((l) => {
        const inizio = normalizzaOra(String(l.ora_inizio ?? ''));
        const giorno = Number(l.giorno);
        const titolo = String(l.titolo ?? '').trim();
        if (!inizio || !titolo || giorno < 1 || giorno > 7) return null;
        return {
          titolo: titolo.slice(0, 120),
          giorno,
          ora_inizio: inizio,
          ora_fine: normalizzaOra(String(l.ora_fine ?? '')),
          aula: String(l.aula ?? '').trim().slice(0, 60) || null,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lezioni.length === 0) {
      return rispondi({ errore: 'FOTO_ILLEGGIBILE' }, 422);
    }

    return rispondi({ lezioni }, 200);
  } catch (e) {
    console.error('Errore interno:', e);
    return rispondi({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
