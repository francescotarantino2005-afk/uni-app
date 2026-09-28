-- Tappa 1 dell'accoglienza: profilo strutturato, stato del percorso, e lo
-- spazio per il dialogo (usato dalle tappe 3-4, creato ora una volta sola).
-- Tutte le colonne sono nullable o con default sicuro: le righe profiles
-- esistenti NON si rompono. In particolare accoglienza_stato resta NULL sui
-- profili gia' presenti = utente onboardato prima di questa tappa (legacy),
-- che l'app tratta come "accoglienza completata".
alter table profiles add column if not exists nome_bot text default 'Lode';
alter table profiles add column if not exists matricola boolean;
alter table profiles add column if not exists profilo_studio jsonb default '{}'::jsonb;
alter table profiles add column if not exists domande_in_coda jsonb default '[]'::jsonb;
alter table profiles add column if not exists accoglienza_stato text;
