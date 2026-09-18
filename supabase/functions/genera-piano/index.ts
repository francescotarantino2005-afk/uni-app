// Edge Function genera-piano: piano di studio a ritroso dalla data dell'esame.
// Legge le fasce ORARIE realmente libere (fuori dalle lezioni) e le scadenze
// nel periodo, poi chiama Claude Haiku con forced tool use e schema strict.
// La chiave ANTHROPIC_API_KEY vive SOLO nei secrets di questa funzione.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { dataOggiRoma } from '../_shared/briefing.ts';

const MAX_PIANI_MESE = 5;
const MAX_GIORNI_PIANO = 45; // orizzonte massimo pianificato in dettaglio
const FINESTRA_INIZIO = 8 * 60; // 08:00 in minuti
const FINESTRA_FINE = 22 * 60; // 22:00
const TIMEOUT_MS = 30_000;
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

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

// --- Utility date/orari (date pure, senza fuso: aritmetica in UTC) ---

function minutiToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function hhmmToMinuti(s: string | null): number | null {
  if (!s) return null;
  // Accetta "HH:MM" e "HH:MM:SS" (le lezioni arrivano come time Postgres "09:00:00").
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 0 && min <= 1440 ? min : null;
}

function normalizzaOra(s: string): string | null {
  const min = hhmmToMinuti(s);
  return min == null ? null : minutiToHHMM(min);
}

/** iso "AAAA-MM-GG" → giorno settimana 1=lun … 7=dom */
function giornoIso(iso: string): number {
  const [a, m, g] = iso.split('-').map(Number);
  const js = new Date(Date.UTC(a, m - 1, g)).getUTCDay(); // 0=dom
  return js === 0 ? 7 : js;
}

function aggiungiGiorni(iso: string, n: number): string {
  const [a, m, g] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function giorniTra(isoA: string, isoB: string): number {
  const [a1, m1, g1] = isoA.split('-').map(Number);
  const [a2, m2, g2] = isoB.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, g2) - Date.UTC(a1, m1 - 1, g1)) / 86_400_000);
}

/** Sottrae gli intervalli occupati dalla finestra [inizio,fine], ritorna le fasce libere. */
function fasceLibere(occupati: { start: number; end: number }[]): { start: number; end: number }[] {
  const ordinati = [...occupati].sort((x, y) => x.start - y.start);
  const libere: { start: number; end: number }[] = [];
  let cursore = FINESTRA_INIZIO;
  for (const o of ordinati) {
    const s = Math.max(o.start, FINESTRA_INIZIO);
    const e = Math.min(o.end, FINESTRA_FINE);
    if (s > cursore) libere.push({ start: cursore, end: s });
    cursore = Math.max(cursore, e);
  }
  if (cursore < FINESTRA_FINE) libere.push({ start: cursore, end: FINESTRA_FINE });
  return libere.filter((f) => f.end - f.start >= 30); // almeno mezz'ora
}

type Lezione = { giorno: number; ora_inizio: string; ora_fine: string | null };

/** Costruisce il testo con, per ogni giorno, le fasce libere e le scadenze. */
function contestoGiorni(
  inizio: string,
  esame: string,
  lezioni: Lezione[],
  scadenzePerData: Map<string, string[]>
): string {
  const righe: string[] = [];
  const totale = giorniTra(inizio, esame);
  for (let i = 0; i < totale; i++) {
    const iso = aggiungiGiorni(inizio, i);
    const g = giornoIso(iso);
    const occupati = lezioni
      .filter((l) => l.giorno === g)
      .map((l) => {
        const s = hhmmToMinuti(l.ora_inizio) ?? 0;
        const e = hhmmToMinuti(l.ora_fine) ?? s + 60; // durata di default 1h
        return { start: s, end: e };
      });
    const libere = fasceLibere(occupati);
    const testoFasce =
      libere.length === 0
        ? 'nessuna fascia libera'
        : libere.map((f) => `${minutiToHHMM(f.start)}-${minutiToHHMM(f.end)}`).join(', ');
    const scad = scadenzePerData.get(iso);
    righe.push(
      `${iso} (${GIORNI[g - 1]}): libero ${testoFasce}${scad ? ` — scadenza: ${scad.join('; ')}` : ''}`
    );
  }
  return righe.join('\n');
}

/** Fasce libere per data, come dati (per validare che le sessioni non tocchino le lezioni). */
function fasceLiberePerData(
  inizio: string,
  esame: string,
  lezioni: Lezione[]
): Map<string, { start: number; end: number }[]> {
  const mappa = new Map<string, { start: number; end: number }[]>();
  const totale = giorniTra(inizio, esame);
  for (let i = 0; i < totale; i++) {
    const iso = aggiungiGiorni(inizio, i);
    const g = giornoIso(iso);
    const occupati = lezioni
      .filter((l) => l.giorno === g)
      .map((l) => {
        const s = hhmmToMinuti(l.ora_inizio) ?? 0;
        const e = hhmmToMinuti(l.ora_fine) ?? s + 60;
        return { start: s, end: e };
      });
    mappa.set(iso, fasceLibere(occupati));
  }
  return mappa;
}

const STRUMENTO_PIANO = {
  name: 'salva_piano',
  description: 'Salva il piano di studio: le sessioni datate e i ripassi.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['sessioni', 'ripassi'],
    properties: {
      sessioni: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['data', 'ora_inizio', 'ora_fine', 'argomento', 'obiettivo'],
          properties: {
            data: { type: 'string', description: 'AAAA-MM-GG' },
            ora_inizio: { type: 'string', description: 'HH:MM' },
            ora_fine: { type: 'string', description: 'HH:MM' },
            argomento: { type: 'string', description: 'Cosa si studia, concreto' },
            obiettivo: { type: 'string', description: 'Traguardo misurabile della sessione' },
          },
        },
      },
      ripassi: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['data', 'argomenti_da_ripassare'],
          properties: {
            data: { type: 'string', description: 'AAAA-MM-GG' },
            argomenti_da_ripassare: { type: 'string', description: 'Elenco in una frase' },
          },
        },
      },
    },
  },
};

const SYSTEM = `Sei un tutor che prepara il piano di studio per l'esame di uno studente universitario italiano.
Ricevi: la data dell'esame, il materiale da coprire, quante ore al giorno può studiare, e per ogni giorno da oggi all'esame le fasce ORARIE LIBERE (fuori dalle lezioni).
Tutti i dati reali stanno SOLO dentro il blocco <dati_reali_utente>…</dati_reali_utente>: usa esclusivamente quelli, non inventare esami, materie o fasce che non compaiono lì dentro.
Costruisci il piano con lo strumento salva_piano, in italiano, rispettando queste regole ferree:
- Pianifica A RITROSO partendo dalla data dell'esame.
- Lascia SEMPRE liberi da nuove sessioni gli ultimi 3 giorni prima dell'esame: in quei giorni metti solo ripasso generale (nel campo "ripassi").
- Non superare MAI le ore al giorno indicate (la somma delle sessioni di uno stesso giorno).
- Metti le sessioni SOLO dentro le fasce libere fornite per quel giorno: mai dove c'è lezione, mai fuori dalle fasce, mai in un giorno con "nessuna fascia libera".
- Ogni sessione deve stare INTERAMENTE dentro UNA sola fascia libera: non farla iniziare in una fascia e finire dentro una lezione, e non unire due fasce separate da una lezione. Se una fascia è breve, fai una sessione breve.
- Nei giorni con una scadenza, alleggerisci: poche o nessuna sessione.
- Distribuisci il materiale in blocchi tematici sensati. Dopo circa 7 giorni dallo studio di un blocco, inserisci un ripasso di quel blocco nel campo "ripassi".
- data in formato AAAA-MM-GG, ora_inizio e ora_fine in HH:MM. Ogni sessione ha un argomento concreto e un obiettivo misurabile.
- Italiano corretto e naturale. Niente asterischi, niente markdown.`;

async function contaPianiUltimoMese(admin: SupabaseClient, userId: string): Promise<number> {
  const da = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count } = await admin
    .from('usage_piani')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', da);
  return count ?? 0;
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
    const body = await req.json().catch(() => ({}));
    const esameId = String(body?.esame_id ?? '');
    const dataEsame = String(body?.data_esame ?? '');
    const materiale = String(body?.materiale ?? '').trim();
    const oreAlGiorno = Number(body?.ore_al_giorno);

    if (!esameId || !/^\d{4}-\d{2}-\d{2}$/.test(dataEsame) || !materiale) {
      return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
    if (!Number.isFinite(oreAlGiorno) || oreAlGiorno < 1 || oreAlGiorno > 14) {
      return json({ errore: 'ORE_NON_VALIDE' }, 400);
    }
    if (materiale.length > 500) return json({ errore: 'MATERIALE_TROPPO_LUNGO' }, 413);

    const oggi = dataOggiRoma();
    if (dataEsame <= oggi) return json({ errore: 'DATA_PASSATA' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3) L'esame deve essere dell'utente (evita di pianificare su esami altrui)
    const { data: esame } = await admin
      .from('exams')
      .select('id, materia')
      .eq('id', esameId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!esame) return json({ errore: 'ESAME_NON_TROVATO' }, 404);

    // 4) Cap mensile (server-side)
    if ((await contaPianiUltimoMese(admin, user.id)) >= MAX_PIANI_MESE) {
      return json({ errore: 'LIMITE_RAGGIUNTO', cap: MAX_PIANI_MESE }, 429);
    }

    // 5) Fasce libere + scadenze nel periodo
    // Se l'esame è lontano, pianifichiamo in dettaglio solo gli ultimi MAX_GIORNI_PIANO giorni.
    const inizio =
      giorniTra(oggi, dataEsame) > MAX_GIORNI_PIANO ? aggiungiGiorni(dataEsame, -MAX_GIORNI_PIANO) : oggi;

    const [lezioniR, scadenzeR] = await Promise.all([
      admin.from('schedule_events').select('giorno, ora_inizio, ora_fine').eq('user_id', user.id),
      admin
        .from('deadlines')
        .select('titolo, data')
        .eq('user_id', user.id)
        .eq('completata', false)
        .gte('data', inizio)
        .lt('data', dataEsame),
    ]);

    const scadenzePerData = new Map<string, string[]>();
    for (const s of scadenzeR.data ?? []) {
      const arr = scadenzePerData.get(s.data) ?? [];
      arr.push(s.titolo);
      scadenzePerData.set(s.data, arr);
    }

    const contesto = contestoGiorni(inizio, dataEsame, lezioniR.data ?? [], scadenzePerData);

    const prompt = `<dati_reali_utente>
Esame di ${esame.materia}: ${dataEsame} (tra ${giorniTra(oggi, dataEsame)} giorni).
Ore di studio al giorno: ${oreAlGiorno}.
Materiale da coprire: ${materiale}.

Giorni disponibili con le fasce libere (usa SOLO queste):
${contesto}
</dati_reali_utente>`;

    // 6) Chiamata AI con forced tool use e timeout
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
    });

    let estratto: { sessioni: unknown[]; ripassi: unknown[] } | undefined;
    try {
      const risposta = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: SYSTEM,
        tools: [STRUMENTO_PIANO],
        tool_choice: { type: 'tool', name: 'salva_piano' },
        messages: [{ role: 'user', content: prompt }],
      });
      const blocco = risposta.content.find((b) => b.type === 'tool_use');
      estratto = blocco?.input as { sessioni: unknown[]; ripassi: unknown[] } | undefined;
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ errore: 'TIMEOUT' }, 504);
      console.error('Errore AI piano:', e);
      return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);
    }
    if (!estratto) return json({ errore: 'GENERAZIONE_FALLITA' }, 502);

    // 7) Validazione/normalizzazione server-side.
    // GARANZIA deterministica: nessuna sessione può toccare una lezione, a
    // prescindere da cosa produce il modello. Scartiamo ogni sessione che non
    // stia INTERAMENTE dentro una fascia libera di quel giorno.
    const fasce = fasceLiberePerData(inizio, dataEsame, lezioniR.data ?? []);
    // Lasciamo liberi gli ultimi 3 giorni (solo ripasso) quando c'è margine.
    const applicaUltimi3 = giorniTra(oggi, dataEsame) > 5;
    const limiteUltimi3 = aggiungiGiorni(dataEsame, -3);

    const sessioni = (estratto.sessioni ?? [])
      .map((s) => {
        const o = s as Record<string, string>;
        const inizioOra = normalizzaOra(String(o.ora_inizio ?? ''));
        const fineOra = normalizzaOra(String(o.ora_fine ?? ''));
        const data = String(o.data ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !inizioOra || !fineOra) return null;
        if (data < oggi || data >= dataEsame) return null;
        if (fineOra <= inizioOra) return null;
        if (applicaUltimi3 && data >= limiteUltimi3) return null; // ultimi 3 giorni = ripasso
        // La sessione deve stare tutta dentro una singola fascia libera.
        const si = hhmmToMinuti(inizioOra)!;
        const sf = hhmmToMinuti(fineOra)!;
        const finestre = fasce.get(data) ?? [];
        if (!finestre.some((f) => f.start <= si && sf <= f.end)) return null;
        return {
          data,
          ora_inizio: inizioOra,
          ora_fine: fineOra,
          argomento: String(o.argomento ?? '').slice(0, 200),
          obiettivo: String(o.obiettivo ?? '').slice(0, 300),
          stato: 'da_fare' as const,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => (a.data + a.ora_inizio).localeCompare(b.data + b.ora_inizio));

    const ripassi = (estratto.ripassi ?? [])
      .map((r) => {
        const o = r as Record<string, string>;
        const data = String(o.data ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
        return { data, argomenti_da_ripassare: String(o.argomenti_da_ripassare ?? '').slice(0, 300) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.data.localeCompare(b.data));

    if (sessioni.length === 0) return json({ errore: 'GENERAZIONE_FALLITA' }, 502);

    const piano = {
      materia: esame.materia,
      data_esame: dataEsame,
      materiale,
      ore_al_giorno: oreAlGiorno,
      creato_il: new Date().toISOString(),
      sessioni,
      ripassi,
    };

    // 8) Salva (un piano attivo per esame: sostituisce il precedente) + conta l'uso
    await admin.from('study_plans').delete().eq('user_id', user.id).eq('exam_id', esameId);
    const { error: errIns } = await admin
      .from('study_plans')
      .insert({ user_id: user.id, exam_id: esameId, piano });
    if (errIns) {
      console.error('Salvataggio piano fallito:', errIns);
      return json({ errore: 'ERRORE_INTERNO' }, 500);
    }
    await admin.from('usage_piani').insert({ user_id: user.id });

    return json({ piano });
  } catch (e) {
    console.error('Errore interno genera-piano:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
