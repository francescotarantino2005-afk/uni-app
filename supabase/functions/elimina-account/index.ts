// Eliminazione account (requisito Apple 5.1.1(v)).
// Il client non può cancellare se stesso: questa funzione verifica il JWT del
// chiamante e, con la service role SOLO lato server, elimina l'utente in
// auth.users. Grazie alle FK `on delete cascade`, la cancellazione dell'utente
// elimina a cascata TUTTE le sue righe (profilo, orario, scadenze, libretto,
// piani, messaggi, note, usage...). `user.id` viene esclusivamente dal JWT
// verificato: un utente può eliminare soltanto sé stesso.
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    // 1) Verifica il JWT del chiamante.
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

    // 2) Cancella l'utente con la service role (mai nel client): la riga in
    // auth.users elimina a cascata tutti i suoi dati.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error('Eliminazione account fallita:', error);
      return json({ errore: 'ELIMINAZIONE_FALLITA' }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('Errore interno elimina-account:', e);
    return json({ errore: 'ERRORE_INTERNO' }, 500);
  }
});
