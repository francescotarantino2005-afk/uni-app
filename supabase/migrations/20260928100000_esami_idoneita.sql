-- Tappa 2 dell'accoglienza (import del libretto da foto): idoneità.
-- Un'idoneità è un esame superato SENZA voto: dà CFU ma non entra nella media.
-- Stati di un esame:
--   con voto      → voto valorizzato,  idoneita = false
--   idoneità      → voto null,         idoneita = true
--   da sostenere  → voto null,         idoneita = false
-- Le righe esistenti prendono idoneita = false: restano quello che erano.
alter table exams add column if not exists idoneita boolean not null default false;

-- NB: applicata sul progetto insieme alla 20260918100000_esami_professore_tipo,
-- che fino ad allora mancava sul database remoto (professore, tipo_esame).
