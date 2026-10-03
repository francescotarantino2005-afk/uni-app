// Chat AI col contesto del profilo dello studente + memoria di lungo periodo.
// - verifica JWT (solo utenti loggati)
// - CAP giornaliero free verificato SERVER-SIDE (mai fidarsi del client)
// - idempotenza sull'id del messaggio (un retry non duplica)
// - costruisce il contesto dal DB (profilo, orario, scadenze, libretto) + le note
//   di memoria dello studente, lette col JWT dell'utente (RLS effettiva)
// - UNA chiamata a Claude Sonnet per rispondere (motore.ts), con il prompt
//   caching sulla parte stabile: il manuale del professore + le istruzioni
//   tecniche, poi note e dati dello studente
// - se la risposta porta il segno [[tipo_esame:...]] lo si toglie dal testo e,
//   se l'esame e' nel libretto e senza tipo, il tipo si salva in exams.tipo_esame
// - dopo la risposta, in background, una SECONDA chiamata dedicata SOLO
//   all'aggiornamento della memoria (memoria.ts: ogni 3 messaggi, sui messaggi
//   lunghi, e quando lo studente torna dopo una pausa; Haiku, strumento forzato
//   + validazione lato codice; al massimo una ventina di note, che si riassumono)
// - { azione: 'mantieni_impegno' }: la chat scrive DA SOLA il primo messaggio,
//   quello che mantiene la promessa fatta a fine accoglienza. La chiamano
//   accoglienza-dialogo (subito dopo la chiusura) e coda-domande (all'apertura
//   della chat, se la prima volta era fallita), col JWT dello studente. Non
//   conta nel tetto giornaliero e succede una volta sola. Se l'impegno e'
//   ancora da mantenere quando lo studente scrive, lo mantiene la risposta.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { dataOggiRoma } from '../_shared/briefing.ts';
import { aggiornaMemoria, mantieniImpegno, rispondi, salvaTipoEsame } from './motore.ts';
import { quandoAggiornare } from './memoria.ts';

const CAP_GIORNALIERO = 10; // messaggi/giorno per gli utenti free
const TIMEOUT_MS = 30_000;

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
    const { messaggio, id, azione, formato: formatoRichiesto } = await req.json().catch(() => ({}));
    // Le build vecchie non mandano il formato: restano sul testo semplice.
    const formato = formatoRichiesto === 'markdown' ? 'markdown' : 'testo';

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
      esito = await rispondi(admin, clientUtente, user.id, testo, anthropic, formato);
    } catch (e) {
      console.error('Chat AI fallita:', e);
      if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ errore: 'TIMEOUT' }, 504);
      return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);
    }
    const { risposta, storico, noteTutte } = esito;

    // 6) Persistenza + conteggio uso. Il messaggio utente è un UPSERT sull'id
    // (chiave di idempotenza): un retry con lo stesso id non crea duplicati.
    await admin
      .from('chat_messages')
      .upsert({ id: idMsg, user_id: user.id, ruolo: 'user', contenuto: testo }, { onConflict: 'id', ignoreDuplicates: true });
    const { data: rigaRisposta, error: erroreRisposta } = await admin
      .from('chat_messages')
      .insert({ user_id: user.id, ruolo: 'assistant', contenuto: risposta, metadati: esito.metadati })
      .select('id')
      .single();
    await admin.from('usage_chat').insert({ user_id: user.id, data: oggi });
    // 7) Se questa risposta ha mantenuto l'impegno dell'accoglienza, lo si segna
    // solo ora che il messaggio e' davvero scritto.
    if (!erroreRisposta) await esito.segnaMantenuto(rigaRisposta?.id ?? null);
    // Il tipo d'esame detto dallo studente (mai sovrascritto, mai indovinato).
    if (esito.tipoEsame) await salvaTipoEsame(admin, user.id, esito.tipoEsame);

    // 8) Memoria in background: ogni 3 messaggi, sui messaggi lunghi, e quando lo
    // studente torna dopo una pausa (la conversazione di prima e' finita). Non
    // rallenta la risposta.
    const { count: nUser } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ruolo', 'user');
    const { aggiorna } = quandoAggiornare({
      testo,
      messaggiStudente: nUser ?? 0,
      ultimoPrimaIl: storico.length ? (storico[storico.length - 1].created_at ?? null) : null,
      adessoMs: Date.now(),
    });
    if (aggiorna) {
      const trascrizione = [
        ...storico.slice(-8).map((m) => `${m.ruolo === 'assistant' ? 'Tutor' : 'Studente'}: ${m.contenuto}`),
        `Studente: ${testo}`,
        `Tutor: ${risposta}`,
      ].join('\n');
      const lavoro = aggiornaMemoria(anthropic, clientUtente, user.id, trascrizione, noteTutte, oggi);
      const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(lavoro);
      else lavoro.catch((e) => console.error('memoria:', e));
    }

    return json({ risposta });
  } catch (e) {
    console.error('Errore interno chat:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
