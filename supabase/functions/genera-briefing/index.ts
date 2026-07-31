// Cron notturno (~04:00 Europe/Rome): genera il briefing del giorno per ogni utente attivo.
// Idempotente: se un briefing per (user, oggi) esiste già, non lo tocca.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import {
  briefingGiornataLibera,
  briefingStaticoDaDati,
  dataOggiRoma,
  generaBriefing,
  giornoSettimanaRoma,
  raccogliContesto,
  suggerimentoStatico,
} from '../_shared/briefing.ts';

const INATTIVO_GIORNI = 14;
const MAX_UTENTI = 2000; // tetto di sicurezza per esecuzione
const MAX_AI = 1500; // tetto duro di chiamate AI per esecuzione (protezione costi)

Deno.serve(async (req) => {
  // Auth: solo il cron con il nostro segreto.
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('non autorizzato', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const anthropic = new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    timeout: 30_000,
    maxRetries: 1,
  });

  const oggi = dataOggiRoma();
  const giorno = giornoSettimanaRoma();
  const sogliaInattivita = new Date(Date.now() - INATTIVO_GIORNI * 86_400_000).toISOString();

  // Solo utenti attivi negli ultimi 14 giorni.
  const { data: profili, error } = await admin
    .from('profiles')
    .select('id')
    .gte('ultimo_accesso', sogliaInattivita)
    .limit(MAX_UTENTI);

  if (error) {
    console.error('Lettura profili fallita:', error);
    return new Response(JSON.stringify({ errore: 'DB' }), { status: 500 });
  }

  let generati = 0;
  let saltati = 0;
  let conAI = 0;

  for (const p of profili ?? []) {
    // Idempotenza: se esiste già un briefing di oggi, salta (niente costo AI).
    const { data: esistente } = await admin
      .from('briefings')
      .select('id')
      .eq('user_id', p.id)
      .eq('data', oggi)
      .maybeSingle();
    if (esistente) {
      saltati++;
      continue;
    }

    const contesto = await raccogliContesto(admin, p.id, oggi, giorno);
    const vuoto =
      contesto.lezioniOggi.length +
        contesto.scadenze.length +
        contesto.esami.length === 0 && contesto.sessione === null;

    let testo: string;
    let suggerimento: string;
    if (vuoto) {
      // Nessun impegno: briefing statico, ZERO chiamate AI.
      testo = briefingGiornataLibera();
      suggerimento = suggerimentoStatico(contesto, oggi);
    } else if (conAI < MAX_AI) {
      const esito = await generaBriefing(anthropic, contesto, oggi, giorno);
      testo = esito.contenuto;
      suggerimento = esito.suggerimento;
      if (esito.usaAI) conAI++;
    } else {
      // Superato il tetto AI dell'esecuzione: degrado a statico dai dati.
      testo = briefingStaticoDaDati(contesto, oggi);
      suggerimento = suggerimentoStatico(contesto, oggi);
    }

    const { error: errIns } = await admin
      .from('briefings')
      .upsert(
        { user_id: p.id, data: oggi, contenuto: testo, suggerimento, inviato: false },
        { onConflict: 'user_id,data', ignoreDuplicates: true }
      );
    if (!errIns) generati++;
  }

  return new Response(
    JSON.stringify({ data: oggi, generati, saltati, conAI }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
