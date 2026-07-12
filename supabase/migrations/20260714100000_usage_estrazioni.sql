-- Log delle estrazioni orario per il rate limiting della Edge Function estrai-orario.
-- Riferimento ad auth.users (non profiles): durante l'onboarding il profilo non esiste ancora.

create table usage_estrazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index usage_estrazioni_user_tempo on usage_estrazioni (user_id, created_at);

-- RLS senza policy: il client non può né leggere né scrivere.
-- Solo la Edge Function (service role) ci accede.
alter table usage_estrazioni enable row level security;
