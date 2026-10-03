-- Stato per messaggio (es. l'interrogazione guidata dal codice). Solo un campo, con default.
alter table chat_messages add column if not exists metadati jsonb not null default '{}'::jsonb;
