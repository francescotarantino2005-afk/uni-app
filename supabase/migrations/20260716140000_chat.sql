-- Chat AI col contesto del profilo (Sprint 5).

-- Storico dei messaggi: il client lo legge (RLS own data), il server li scrive
-- (service role, bypassa RLS).
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ruolo text not null check (ruolo in ('user', 'assistant')),
  contenuto text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_tempo on chat_messages (user_id, created_at);

alter table chat_messages enable row level security;
create policy "leggi i propri messaggi" on chat_messages
  for select to authenticated
  using (auth.uid() = user_id);

-- Log dell'uso chat per il CAP GIORNALIERO free (verificato server-side).
-- Nessuna policy: ci accede solo la Edge Function con la service role.
create table usage_chat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now()
);
create index usage_chat_user_data on usage_chat (user_id, data);
alter table usage_chat enable row level security;

-- Eventi analytics (es. "avvisami quando esce Plus", interesse referral).
-- Il client inserisce i propri eventi.
create table analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  evento text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
alter table analytics enable row level security;
create policy "inserisci i propri eventi" on analytics
  for insert to authenticated
  with check (auth.uid() = user_id);
