-- 1.0.2 — dettagli esame opzionali sul libretto.
-- Solo campi, nessuna logica: tutti nullable, nessun default, nessun NOT NULL.
-- Le righe esistenti restano invariate (i nuovi campi sono NULL).
-- tipo_esame: valori attesi dall'app -> scritto | orale | entrambi | progetto | altro
alter table exams add column if not exists professore text;
alter table exams add column if not exists tipo_esame text;
