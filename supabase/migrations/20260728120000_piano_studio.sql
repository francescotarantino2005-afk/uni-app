-- Sprint 6 "AI presente": piano di studio + suggerimento proattivo in home.

-- Il briefing porta anche un suggerimento del giorno (una frase) che collega
-- piano di studio, ore libere e scadenze imminenti.
alter table briefings add column if not exists suggerimento text;

-- Log della generazione piani, per il cap mensile (max 5/mese per utente,
-- verificato server-side). Nessuna policy: ci accede solo la Edge Function
-- con la service role.
create table usage_piani (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index usage_piani_user_tempo on usage_piani (user_id, created_at);
alter table usage_piani enable row level security;

-- study_plans esiste già con RLS "own data" (for all): il client legge e
-- aggiorna il proprio piano (ricalcolo deterministico lato app), il server
-- lo scrive con la service role. Aggiungiamo solo un indice per trovare
-- il piano attivo di un esame in fretta.
create index if not exists study_plans_user_exam on study_plans (user_id, exam_id, created_at desc);
