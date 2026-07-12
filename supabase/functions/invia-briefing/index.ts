// Due modalità:
//  1) Cron (header x-cron-secret): manda la push agli utenti la cui ora_briefing
//     è già passata oggi e che non hanno ancora ricevuto il briefing.
//  2) Prova (JWT utente + body {prova:true}): genera e invia SUBITO all'utente
//     che chiama, ignorando l'orario. Serve per testare dalla dev build.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import {
  dataOggiRoma,
  generaBriefing,
  giornoSettimanaRoma,
  inviaPush,
  oraOraRoma,
  raccogliContesto,
  tokenPushUtente,
} from '../_shared/briefing.ts';

const TITOLO = 'Il tuo briefing ☀️';

function json(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { 'Content-Type': 'application/json' },
  });
}

function creaAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function inviaA(
  admin: ReturnType<typeof creaAdmin>,
  userId: string,
  corpo: string
): Promise<number> {
  const tokens = await tokenPushUtente(admin, userId);
  const { tokenDaRimuovere } = await inviaPush(tokens, TITOLO, corpo);
  if (tokenDaRimuovere.length) {
    await admin.from('push_tokens').delete().in('token', tokenDaRimuovere);
  }
  return tokens.length - tokenDaRimuovere.length;
}

Deno.serve(async (req) => {
  const admin = creaAdmin();
  const oggi = dataOggiRoma();

  // -- Modalità PROVA: JWT utente --
  const auth = req.headers.get('Authorization');
  const body = await req.json().catch(() => ({}));
  if (body?.prova && auth) {
    const clientUtente = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const {
      data: { user },
    } = await clientUtente.auth.getUser();
    if (!user) return json({ errore: 'NON_AUTORIZZATO' }, 401);

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      timeout: 30_000,
      maxRetries: 1,
    });
    const contesto = await raccogliContesto(admin, user.id, oggi, giornoSettimanaRoma());
    const { contenuto } = await generaBriefing(anthropic, contesto, oggi, giornoSettimanaRoma());

    // salva (sovrascrive quello di oggi) e marca come inviato
    await admin
      .from('briefings')
      .upsert({ user_id: user.id, data: oggi, contenuto, inviato: true }, { onConflict: 'user_id,data' });

    const inviati = await inviaA(admin, user.id, contenuto);
    return json({ ok: true, contenuto, push_inviate: inviati });
  }

  // -- Modalità CRON --
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ errore: 'NON_AUTORIZZATO' }, 401);
  }

  const adesso = oraOraRoma(); // "HH:MM" in fuso italiano
  const { data: dovuti, error } = await admin
    .from('briefings')
    .select('id, user_id, contenuto, profiles!inner(ora_briefing)')
    .eq('data', oggi)
    .eq('inviato', false);

  if (error) {
    console.error('Lettura briefing fallita:', error);
    return json({ errore: 'DB' }, 500);
  }

  let inviati = 0;
  for (const b of dovuti ?? []) {
    // la profiles!inner arriva come oggetto singolo
    const profilo = b.profiles as unknown as { ora_briefing: string };
    const ora = (profilo?.ora_briefing ?? '07:30').slice(0, 5);
    if (ora > adesso) continue; // non è ancora l'ora scelta da questo utente

    await inviaA(admin, b.user_id, b.contenuto);
    await admin.from('briefings').update({ inviato: true }).eq('id', b.id);
    inviati++;
  }

  return json({ ora: adesso, briefing_inviati: inviati });
});
