-- Spazi per esame (1.0.1): le conversazioni della chat.
-- Nessuna cancellazione di dati: si aggiunge una tabella e una colonna
-- FACOLTATIVA su chat_messages; i messaggi esistenti finiscono, per ogni
-- studente, nella sua conversazione "Generale".
-- Compatibilita' con le build vecchie (fino alla 20): non mandano
-- conversazione_id, la function chat usa la "Generale". I messaggi scritti senza
-- conversazione (accoglienza, coda-domande, impegno) restano con
-- conversazione_id null e valgono come "Generale".

create table if not exists public.conversazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- l'esame dello spazio; se l'esame si cancella la conversazione resta, senza esame
  exam_id uuid references public.exams(id) on delete set null,
  titolo text not null default 'Nuova chat' check (char_length(btrim(titolo)) between 1 and 80),
  -- la conversazione di partenza di ogni studente: una sola, non si elimina
  generale boolean not null default false,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);

create unique index if not exists conversazioni_una_generale on public.conversazioni (user_id) where generale;
create index if not exists conversazioni_utente_recenti on public.conversazioni (user_id, aggiornata_il desc);

alter table public.conversazioni enable row level security;

-- Ognuno vede e gestisce solo le sue. L'esame, se c'e', dev'essere suo.
create policy "conversazioni: leggi le proprie" on public.conversazioni
  for select using (auth.uid() = user_id);
create policy "conversazioni: crea le proprie" on public.conversazioni
  for insert with check (
    auth.uid() = user_id
    and (exam_id is null or exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid()))
  );
create policy "conversazioni: rinomina le proprie" on public.conversazioni
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (exam_id is null or exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid()))
  );
create policy "conversazioni: elimina le proprie, non la Generale" on public.conversazioni
  for delete using (auth.uid() = user_id and not generale);

-- Il messaggio appartiene (facoltativamente) a una conversazione. Eliminare una
-- conversazione (dall'app, con conferma) elimina i suoi messaggi.
alter table public.chat_messages
  add column if not exists conversazione_id uuid references public.conversazioni(id) on delete cascade;
create index if not exists chat_messages_conversazione on public.chat_messages (conversazione_id, created_at);

-- Backfill: una "Generale" per ogni studente che ha gia' dei messaggi, e i suoi
-- messaggi dentro.
insert into public.conversazioni (user_id, titolo, generale, creata_il, aggiornata_il)
select m.user_id, 'Generale', true, min(m.created_at), max(m.created_at)
from public.chat_messages m
join public.profiles p on p.id = m.user_id
where not exists (select 1 from public.conversazioni c where c.user_id = m.user_id and c.generale)
group by m.user_id;

update public.chat_messages m
set conversazione_id = c.id
from public.conversazioni c
where c.user_id = m.user_id and c.generale and m.conversazione_id is null;
