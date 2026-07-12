-- Supporto al briefing mattutino (Sprint 3).

-- Traccia l'ultimo accesso per saltare gli utenti inattivi da 14+ giorni
-- (difesa costi: niente chiamate AI per chi non apre l'app).
-- Default now() così gli utenti esistenti non vengono saltati subito.
alter table profiles
  add column if not exists ultimo_accesso timestamptz not null default now();

-- L'invio cerca i briefing di oggi non ancora spediti: indice dedicato.
create index if not exists briefings_data_inviato on briefings (data, inviato);
