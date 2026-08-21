-- Memoria dello studente: fatti stabili che l'assistente ricorda tra le sessioni
-- per comportarsi da tutor personale (non da chatbot senza passato).
-- Scritte e lette SOLO col JWT dell'utente (RLS effettiva): mai con la service role.
-- La FK verso auth.users con ON DELETE CASCADE garantisce che la cancellazione
-- dell'account elimini automaticamente anche queste note.
create table note_studente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null check (
    categoria in ('percorso', 'obiettivi', 'metodo_studio', 'ostacoli', 'preferenze', 'contesto')
  ),
  -- un fatto solo per riga; massimo 300 caratteri
  contenuto text not null check (char_length(contenuto) <= 300),
  importanza smallint not null default 2 check (importanza in (1, 2, 3)),
  archiviata boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index note_studente_utente
  on note_studente (user_id, archiviata, importanza desc, updated_at desc);

alter table note_studente enable row level security;

-- Ogni policy limita l'accesso alle sole righe dell'utente autenticato.
create policy "note: leggi le proprie" on note_studente
  for select to authenticated
  using (auth.uid() = user_id);

create policy "note: inserisci le proprie" on note_studente
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "note: aggiorna le proprie" on note_studente
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "note: cancella le proprie" on note_studente
  for delete to authenticated
  using (auth.uid() = user_id);
