// Chat AI col contesto del profilo dello studente + memoria di lungo periodo.
// - verifica JWT (solo utenti loggati)
// - CAP giornaliero free verificato SERVER-SIDE (mai fidarsi del client)
// - idempotenza sull'id del messaggio (un retry non duplica)
// - costruisce il contesto dal DB (profilo, orario, scadenze, libretto) + le note
//   di memoria dello studente, lette col JWT dell'utente (RLS effettiva)
// - UNA chiamata a Claude Sonnet per rispondere (motore.ts), con il prompt
//   caching sulla parte stabile: istruzioni di sistema e dati dello studente
// - dopo la risposta, in background, una SECONDA chiamata dedicata SOLO
//   all'estrazione della memoria (Haiku, tool use forzato + validazione lato codice)
// - { azione: 'mantieni_impegno' }: la chat scrive DA SOLA il primo messaggio,
//   quello che mantiene la promessa fatta a fine accoglienza. La chiamano
//   accoglienza-dialogo (subito dopo la chiusura) e coda-domande (all'apertura
//   della chat, se la prima volta era fallita), col JWT dello studente. Non
//   conta nel tetto giornaliero e succede una volta sola. Se l'impegno e'
//   ancora da mantenere quando lo studente scrive, lo mantiene la risposta.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { dataOggiRoma } from '../_shared/briefing.ts';
import { mantieniImpegno, rispondi } from './motore.ts';

const CAP_GIORNALIERO = 10; // messaggi/giorno per gli utenti free
const TIMEOUT_MS = 30_000;

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
    const { messaggio, id, azione } = await req.json().catch(() => ({}));

    // La chat scrive da sola il messaggio che mantiene l'impegno dell'accoglienza.
    if (azione === 'mantieni_impegno') {
      const esito = await mantieniImpegno(
        createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
        clientUtente,
        user.id,
        new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')!, timeout: TIMEOUT_MS, maxRetries: 1 })
      );
      return json(esito);
    }

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

    // 5) Contesto, storico breve, note di memoria e chiamata AI (Sonnet, con
    // degrado grazioso): tutto nel motore.
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
    });

    let esito: Awaited<ReturnType<typeof rispondi>>;
    try {
      esito = await rispondi(admin, clientUtente, user.id, testo, anthropic);
    } catch (e) {
      console.error('Chat AI fallita:', e);
      if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ errore: 'TIMEOUT' }, 504);
      return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);
    }
    const { risposta, storico, note } = esito;

    // 6) Persistenza + conteggio uso. Il messaggio utente è un UPSERT sull'id
    // (chiave di idempotenza): un retry con lo stesso id non crea duplicati.
    await admin
      .from('chat_messages')
      .upsert({ id: idMsg, user_id: user.id, ruolo: 'user', contenuto: testo }, { onConflict: 'id', ignoreDuplicates: true });
    const { data: rigaRisposta, error: erroreRisposta } = await admin
      .from('chat_messages')
      .insert({ user_id: user.id, ruolo: 'assistant', contenuto: risposta })
      .select('id')
      .single();
    await admin.from('usage_chat').insert({ user_id: user.id, data: oggi });
    // 7) Se questa risposta ha mantenuto l'impegno dell'accoglienza, lo si segna
    // solo ora che il messaggio e' davvero scritto.
    if (!erroreRisposta) await esito.segnaMantenuto(rigaRisposta?.id ?? null);

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
