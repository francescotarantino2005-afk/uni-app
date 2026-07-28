// Chat AI col contesto del profilo dello studente.
// - verifica JWT (solo utenti loggati)
// - CAP giornaliero free verificato SERVER-SIDE (mai fidarsi del client)
// - costruisce il contesto dal DB (profilo, orario, scadenze, libretto)
// - UNA chiamata a Claude Haiku (modello piccolo/veloce, come da CLAUDE.md)
// - persiste lo scambio e registra l'uso
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { dataOggiRoma, giornoSettimanaRoma } from '../_shared/briefing.ts';

const CAP_GIORNALIERO = 10; // messaggi/giorno per gli utenti free
const MAX_STORICO = 10; // ultimi messaggi passati come contesto
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
    admin.from('exams').select('materia, cfu, voto, lode').eq('user_id', userId),
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

  // Libretto: media ponderata (lode = 30), CFU, esami da sostenere
  const esami = esamiR.data ?? [];
  const sostenuti = esami.filter((e: { voto: number | null }) => e.voto != null);
  let sp = 0;
  let sc = 0;
  let cfu = 0;
  let lodi = 0;
  for (const e of sostenuti) {
    if (e.cfu && e.cfu > 0) {
      sp += e.voto * e.cfu;
      sc += e.cfu;
      cfu += e.cfu;
    }
    if (e.lode && e.voto === 30) lodi++;
  }
  righe.push('--- Libretto ---');
  if (sostenuti.length === 0) {
    righe.push('Nessun esame verbalizzato.');
  } else {
    const media = sc > 0 ? (sp / sc).toFixed(2) : '—';
    righe.push(`Esami sostenuti: ${sostenuti.length}, CFU acquisiti: ${cfu}, media ponderata: ${media}, lodi: ${lodi}.`);
  }
  const daSostenere = esami.filter((e: { voto: number | null }) => e.voto == null);
  if (daSostenere.length) {
    righe.push(`Esami da sostenere: ${daSostenere.map((e: { materia: string }) => e.materia).join(', ')}.`);
  }

  return { testo: righe.join('\n'), senzaVoti: sostenuti.length === 0 };
}

const SYSTEM_BASE = `Sei l'assistente personale di uno studente universitario italiano, dentro la sua app.
Conosci i suoi dati reali (profilo, orario, scadenze, libretto), riportati qui sotto: usali per rispondere in modo concreto e personale.
Dai del tu, tono amichevole e sveglio, come un amico informato. Mai burocratese.

Regole di lunghezza e ordine (importanti):
- Massimo 3-4 frasi. Asciutto ma umano, mai un muro di testo.
- La PRIMA frase dà la risposta o la cosa più importante: è quella che si legge nell'anteprima della notifica. Niente premesse tipo "Allora," o "Certo!".
- Italiano completo e corretto: parole intere, mai troncate o abbreviate.
- Testo semplice come su WhatsApp: NIENTE markdown, niente **grassetto**, niente #titoli, niente elenchi con - o *. Se elenchi, usa frasi separate o vai a capo. Al massimo una emoji.
Non inventare voti, date o scadenze che non sono nei dati.

L'app ha queste sezioni: Oggi (lezioni di oggi e prossime scadenze), Orario (orario settimanale; lezioni a mano o "Importa da foto"), Scadenze (le sue scadenze, con "Scadenze da non perdere": ISEE, tasse, borse), Libretto (esami e voti, con media ponderata e simulatore).
L'app NON è collegata ai portali dell'ateneo: orario, scadenze ed esami li inserisce lui. Se un dato manca è perché non l'ha ancora inserito, non perché l'università non l'ha registrato: non mandarlo in segreteria. Quando manca un dato che serve, in una frase invitalo ad aggiungerlo nella sezione giusta (es. le lezioni dalla tab Orario). Se ti chiede qualcosa che non puoi sapere (es. un regolamento specifico del corso), dillo con onestà.`;

// Regola di priorità per le matricole: se non ci sono voti, NON insistere sul
// libretto, sposta il discorso su lezioni, scadenze e metodo.
const ISTRUZIONE_MATRICOLA = `

CONTESTO IMPORTANTE: questo studente NON ha ancora nessun voto nel libretto — è una matricola o è proprio all'inizio. NON insistere sul libretto e NON dirgli "aggiungi i tuoi esami": non ne ha ancora da sostenere o registrare. Se ti chiede "come sto messo?" o qualcosa su libretto/media, non rispondere solo che è vuoto: pivota su ciò che è utile ADESSO — le lezioni della settimana, le scadenze in arrivo (ISEE, tasse, immatricolazione) e un consiglio pratico per partire bene. Regola: se mancano i voti, parla del resto.`;

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
    const { messaggio } = await req.json().catch(() => ({}));
    if (!messaggio || typeof messaggio !== 'string' || !messaggio.trim()) {
      return json({ errore: 'RICHIESTA_NON_VALIDA' }, 400);
    }
    if (messaggio.length > 2000) return json({ errore: 'MESSAGGIO_TROPPO_LUNGO' }, 413);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3) CAP giornaliero (server-side). I premium non hanno cap.
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

    // 4) Contesto + storico breve (dal DB, non dal client)
    const [contesto, storicoR] = await Promise.all([
      costruisciContesto(admin, user.id),
      admin
        .from('chat_messages')
        .select('ruolo, contenuto')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_STORICO),
    ]);
    const storico = (storicoR.data ?? []).reverse();
    const system =
      SYSTEM_BASE +
      (contesto.senzaVoti ? ISTRUZIONE_MATRICOLA : '') +
      `\n\n### Dati dello studente\n${contesto.testo}`;

    // 5) Chiamata AI (Haiku, con degrado grazioso)
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
          { role: 'user' as const, content: messaggio.trim() },
        ],
      });
      risposta = out.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('')
        .trim();
      if (!risposta) throw new Error('risposta vuota');
    } catch (e) {
      // Degrado grazioso: se l'AI è giù o il budget è esaurito, niente crash.
      console.error('Chat AI fallita:', e);
      if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ errore: 'TIMEOUT' }, 504);
      return json({ errore: 'SERVIZIO_NON_DISPONIBILE' }, 503);
    }

    // 6) Persistenza + conteggio uso (dopo una risposta valida).
    // Due insert SEQUENZIALI: in un singolo insert le due righe avrebbero lo
    // stesso now() e l'ordine di rilettura non sarebbe deterministico.
    await admin.from('chat_messages').insert({ user_id: user.id, ruolo: 'user', contenuto: messaggio.trim() });
    await admin.from('chat_messages').insert({ user_id: user.id, ruolo: 'assistant', contenuto: risposta });
    await admin.from('usage_chat').insert({ user_id: user.id, data: oggi });

    return json({ risposta });
  } catch (e) {
    console.error('Errore interno chat:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
