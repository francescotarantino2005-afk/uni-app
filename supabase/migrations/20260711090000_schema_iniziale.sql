-- Schema iniziale — FASE 3 della guida tecnica (docs/guida-tecnica-build.md)
-- 8 tabelle + Row Level Security su tutto: un utente vede solo i suoi dati.

-- ============================================================
-- TABELLE
-- ============================================================

-- profilo (estende auth.users di Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  ateneo text,
  corso text,
  anno int,
  fuorisede boolean default false,
  regione text,
  ora_briefing time default '07:30',
  premium boolean default false,
  created_at timestamptz default now()
);

-- eventi orario (lezioni ricorrenti)
create table schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  titolo text not null,          -- "Analisi Matematica 1"
  giorno int not null,           -- 1=lunedì ... 7=domenica
  ora_inizio time not null,
  ora_fine time,
  aula text,
  colore text
);

-- scadenze (personali + copiate dai template)
create table deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  titolo text not null,
  data date not null,
  categoria text,                -- 'tasse' | 'isee' | 'borsa' | 'affitto' | 'esame' | 'altro'
  spiegazione text,              -- il "cosa fare" in italiano semplice
  completata boolean default false,
  fonte text default 'utente'    -- 'utente' | 'template'
);

-- template scadenze curati da noi (senza user_id: globali)
create table deadline_templates (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  data date,
  regione text,                  -- null = nazionale
  ateneo text,                   -- null = tutti
  categoria text,
  spiegazione text
);

-- esami e libretto
create table exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  materia text not null,
  cfu int,
  data_esame date,
  voto int,                      -- null = da sostenere
  lode boolean default false
);

-- piani di studio generati
create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade,
  piano jsonb,                   -- giorni → obiettivi
  created_at timestamptz default now()
);

-- briefing generati (log + idempotenza: uno per utente per giorno)
create table briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  data date not null,
  contenuto text,
  inviato boolean default false,
  unique(user_id, data)
);

-- token push del dispositivo
create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text primary key,
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table schedule_events enable row level security;
alter table deadlines enable row level security;
alter table deadline_templates enable row level security;
alter table exams enable row level security;
alter table study_plans enable row level security;
alter table briefings enable row level security;
alter table push_tokens enable row level security;

-- profiles: la chiave dell'utente è id (non user_id)
create policy "own data" on profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "own data" on schedule_events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data" on deadlines
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data" on exams
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data" on study_plans
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data" on briefings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data" on push_tokens
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- deadline_templates: globali, sola lettura per gli utenti autenticati.
-- Nessuna policy di insert/update/delete: la scrittura dal client è negata;
-- i template si caricano con la service role (dashboard o script server-side).
create policy "templates in sola lettura" on deadline_templates
  for select to authenticated
  using (true);
