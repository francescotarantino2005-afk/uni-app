// Edge Function estrai-libretto: una o più foto del libretto → esami strutturati.
// Stesso schema di estrai-orario (JWT, rate limit condiviso, tool forzato,
// normalizzazione lato server). Tutte le foto vanno in UNA sola chiamata.
// Regola: questa funzione NON scrive nulla nel libretto. Restituisce solo ciò
// che ha letto; il salvataggio avviene nell'app dopo la conferma dello studente.
// Un campo che non si legge torna vuoto (null): mai indovinare voto, data o CFU.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const LIMITE_GIORNALIERO = 10; // estrazioni per utente nelle ultime 24h (condiviso con estrai-orario)
const TIMEOUT_MS = 60_000; // più foto = lettura più lunga dell'orario
const MAX_FOTO = 8;
const MAX_BASE64 = 7_000_000; // ~5MB per immagine
const MAX_BASE64_TOTALE = 20_000_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Esito = 'voto' | 'idoneita' | 'nessun_esito';

type RigaModello = {
  materia: string;
  esito: Esito;
  voto: string;
  lode: boolean;
  cfu: string;
  data: string;
};

type EsameLetto = {
  materia: string;
  esito: Esito;
  /** 18-30, null se non c'è o non si legge */
  voto: number | null;
  lode: boolean;
  cfu: number | null;
  /** ISO AAAA-MM-GG */
  data_esame: string | null;
};

// Tool forzato con schema strict: niente union types, i campi non letti
// arrivano come "" e diventano null nella normalizzazione qui sotto.
const STRUMENTO_ESTRAZIONE = {
  name: 'salva_libretto',
  description:
    'Salva gli esami letti dalle foto del libretto universitario. ' +
    'Se nessuna immagine contiene un libretto leggibile, imposta leggibile=false e esami=[].',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['leggibile', 'esami'],
    properties: {
      leggibile: {
        type: 'boolean',
        description: 'false se le immagini non sono un libretto o sono troppo sfocate/tagliate per leggerlo',
      },
      esami: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['materia', 'esito', 'voto', 'lode', 'cfu', 'data'],
          properties: {
            materia: { type: 'string', description: 'Nome dell\'insegnamento, es. "Analisi Matematica 1"' },
            esito: {
              type: 'string',
              enum: ['voto', 'idoneita', 'nessun_esito'],
              description:
                'voto = superato con voto numerico; idoneita = superato senza voto (idoneo, approvato, superato, ID, APP); nessun_esito = ancora da sostenere',
            },
            voto: {
              type: 'string',
              description: 'Solo il numero da 18 a 30, es. "27". Per 30 e lode scrivi "30" e lode=true. "" se esito non è voto o se il numero non si legge',
            },
            lode: { type: 'boolean', description: 'true solo se il voto è 30 e lode (30L, 30 e lode, 30/30L)' },
            cfu: { type: 'string', description: 'Numero di CFU/crediti, es. "9". "" se non indicato o non leggibile' },
            data: { type: 'string', description: 'Data dell\'esame in formato GG/MM/AAAA. "" se non indicata o non leggibile' },
          },
        },
      },
    },
  },
};

const PROMPT = `Queste sono una o più foto (o screenshot) del libretto universitario di uno studente italiano: libretto cartaceo, pagina "Libretto" del portale d'ateneo (es. Esse3) o app dell'università. Le foto possono essere pagine diverse dello stesso libretto.
Leggi TUTTE le righe d'esame di TUTTE le immagini e salvale con lo strumento salva_libretto.

Per ogni esame:
- materia: il nome dell'insegnamento, senza codici numerici se possibile.
- esito:
  - "voto" se l'esame è superato con un voto numerico (18-30);
  - "idoneita" se è superato SENZA voto: idoneo, idoneità, approvato, superato, giudizio positivo, sigle come ID, IDO, APP, SUP. Dà crediti ma non ha voto;
  - "nessun_esito" se l'esame c'è ma non è ancora stato sostenuto (nessun voto, stato pianificato/frequentato/da sostenere).
- voto: solo il numero. "30 e lode", "30L", "30/30L", "30 cum laude" → voto "30" e lode=true. Mai scrivere la lode dentro il voto.
- cfu: i crediti (colonna CFU, crediti, peso).
- data: la data dell'esame in GG/MM/AAAA.

Regole ferree:
- Se un campo non si legge con certezza, lascialo vuoto (""). NON indovinare mai un voto, una data o dei CFU, neanche se ti sembrano probabili.
- Se il voto di un esame superato non si legge, usa esito "voto" con voto "".
- Se lo stesso esame compare in più foto (pagine sovrapposte), riportalo UNA sola volta.
- Ignora righe che non sono esami (totali, medie, intestazioni, tasse, dati anagrafici).
- Se nessuna immagine è un libretto leggibile, imposta leggibile=false e esami=[].`;

// --- normalizzazione ---

function leggiVoto(testo: string): number | null {
  const m = testo.trim().match(/^(\d{2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 18 && n <= 30 ? n : null;
}

function leggiCfu(testo: string): number | null {
  const t = testo.trim().replace(',', '.');
  if (!/^\d+(\.0+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : null;
}

function leggiData(testo: string): string | null {
  const m = testo.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const giorno = Number(m[1]);
  const mese = Number(m[2]);
  const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const annoMax = new Date().getFullYear() + 2;
  if (anno < 1990 || anno > annoMax || mese < 1 || mese > 12 || giorno < 1) return null;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCMonth() !== mese - 1) return null; // es. 31/02
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

function normalizza(r: RigaModello): EsameLetto | null {
  const materia = String(r.materia ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!materia) return null;
  const esito: Esito = ['voto', 'idoneita', 'nessun_esito'].includes(r.esito) ? r.esito : 'nessun_esito';
  const voto = esito === 'voto' ? leggiVoto(String(r.voto ?? '')) : null;
  return {
    materia,
    esito,
    voto,
    // la lode vale solo sul 30 letto
    lode: voto === 30 && r.lode === true,
    cfu: leggiCfu(String(r.cfu ?? '')),
    data_esame: leggiData(String(r.data ?? '')),
  };
}

/** Chiave per riconoscere lo stesso esame in foto diverse. */
function chiave(materia: string): string {
  return materia
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const RANGO_ESITO: Record<Esito, number> = { nessun_esito: 0, idoneita: 1, voto: 2 };

/**
 * Unisce due letture dello stesso esame. Un campo presente in una sola lettura
 * si tiene; due valori DIVERSI per lo stesso campo non si scelgono a caso:
 * il campo torna vuoto e lo studente lo completa nella conferma.
 */
function unisci(a: EsameLetto, b: EsameLetto): EsameLetto {
  const esito = RANGO_ESITO[b.esito] > RANGO_ESITO[a.esito] ? b.esito : a.esito;
  const campo = <T>(x: T | null, y: T | null): T | null =>
    x == null ? y : y == null ? x : x === y ? x : null;
  const votoA = a.esito === 'voto' ? a.voto : null;
  const votoB = b.esito === 'voto' ? b.voto : null;
  const voto = esito === 'voto' ? campo(votoA, votoB) : null;
  return {
    materia: a.materia,
    esito,
    voto,
    lode: voto === 30 && (a.lode || b.lode),
    cfu: campo(a.cfu, b.cfu),
    data_esame: campo(a.data_esame, b.data_esame),
  };
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

    // 2) Rate limiting per utente (stessa tabella di estrai-orario).
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

    // 3) Input: lista di immagini base64 (+ media type).
    const { immagini } = await req.json().catch(() => ({}));
    if (!Array.isArray(immagini) || immagini.length === 0) {
      return rispondi({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
    if (immagini.length > MAX_FOTO) {
      return rispondi({ errore: 'TROPPE_FOTO' }, 413);
    }
    const tipiValidi = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    let totale = 0;
    const blocchiImmagine: Anthropic.ImageBlockParam[] = [];
    for (const img of immagini) {
      const dati = img?.immagine;
      if (!dati || typeof dati !== 'string') {
        return rispondi({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
      }
      if (dati.length > MAX_BASE64) {
        return rispondi({ errore: 'IMMAGINE_TROPPO_GRANDE' }, 413);
      }
      totale += dati.length;
      const tipo = tipiValidi.includes(img.media_type) ? img.media_type : 'image/jpeg';
      blocchiImmagine.push({ type: 'image', source: { type: 'base64', media_type: tipo, data: dati } });
    }
    if (totale > MAX_BASE64_TOTALE) {
      return rispondi({ errore: 'IMMAGINE_TROPPO_GRANDE' }, 413);
    }

    // Il tentativo si conta prima della chiamata AI (anti-abuso): una chiamata = un'estrazione.
    await admin.from('usage_estrazioni').insert({ user_id: user.id });

    // 4) Una sola chiamata vision con tutte le foto, tool forzato e timeout.
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });

    let risposta: Anthropic.Message;
    try {
      risposta = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 8192,
        tools: [STRUMENTO_ESTRAZIONE],
        tool_choice: { type: 'tool', name: 'salva_libretto' },
        messages: [
          {
            role: 'user',
            content: [...blocchiImmagine, { type: 'text', text: PROMPT }],
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
    const estratto = blocco?.input as { leggibile: boolean; esami: RigaModello[] } | undefined;

    if (!estratto || estratto.leggibile === false) {
      return rispondi({ errore: 'FOTO_ILLEGGIBILE' }, 422);
    }

    // 5) Normalizzazione e deduplica lato server (stesso esame in più foto → una riga).
    const perChiave = new Map<string, EsameLetto>();
    for (const r of estratto.esami ?? []) {
      const e = normalizza(r);
      if (!e) continue;
      const k = chiave(e.materia);
      const gia = perChiave.get(k);
      perChiave.set(k, gia ? unisci(gia, e) : e);
    }
    const esami = [...perChiave.values()];

    if (esami.length === 0) {
      return rispondi({ errore: 'FOTO_ILLEGGIBILE' }, 422);
    }

    return rispondi({ esami }, 200);
  } catch (e) {
    console.error('Errore interno:', e);
    return rispondi({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
