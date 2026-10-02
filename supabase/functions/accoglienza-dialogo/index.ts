// Edge Function accoglienza-dialogo: UN turno del dialogo di accoglienza.
// Tutte le regole (cosa si estrae, quale domanda viene dopo, quando si chiude,
// quante frasi ha la battuta) stanno in logica.ts, che e' pura e coperta dai
// test. Il turno vero e proprio (tetto anti-abuso, chiamata al modello,
// scrittura dei messaggi in chat_messages, impegno) sta in servizio.ts. Qui c'e'
// solo il contorno HTTP: login e risposta.
// Se il dialogo chiude con un impegno ("ti preparo degli esercizi..."), dopo
// aver risposto la function chiede alla chat, in background, di scrivere il
// primo messaggio che lo MANTIENE (chat, azione "mantieni_impegno").
// L'unico ingresso e' quello autenticato: nessuna modalita' di prova.
//   input  -> nome_bot, conversazione (tutta), profilo_studio, chieste, libretto
//   output -> { risposta_bot, profilo_studio, chieste, prossima_chiave, fine, aiuto }
// Il profilo (profilo_studio, coda, stato) lo salva l'app col meccanismo
// dell'accoglienza.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { turnoServizio } from './servizio.ts';

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
    // 1) Solo utenti loggati.
    const autorizzazione = req.headers.get('Authorization') ?? '';
    const clientUtente = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: autorizzazione } } }
    );
    const {
      data: { user },
    } = await clientUtente.auth.getUser();
    if (!user) return json({ errore: 'NON_AUTORIZZATO' }, 401);

    // 2) Il turno.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const esito = await turnoServizio(
      admin,
      user.id,
      await req.json().catch(() => ({})),
      Deno.env.get('ANTHROPIC_API_KEY')!,
      // La chat mantiene l'impegno: stessa identita' dello studente, nessun segreto in piu'.
      async () => {
        const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            Authorization: autorizzazione,
            apikey: Deno.env.get('SUPABASE_ANON_KEY')!,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ azione: 'mantieni_impegno' }),
        });
        if (!r.ok) throw new Error(`chat ${r.status}`);
        return r.json();
      }
    );

    // 3) Il lavoro in background non fa aspettare la battuta di chiusura.
    if (esito.sfondo) {
      const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(esito.sfondo);
    }
    return json(esito.corpo, esito.stato);
  } catch (e) {
    console.error('Errore interno:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
