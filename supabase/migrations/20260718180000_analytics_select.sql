-- L'utente può rileggere i propri eventi analytics (coerente con le altre
-- tabelle "own data"). Serve anche per verificare che il tracciamento
-- funzioni davvero: registraEvento() è best-effort e ingoia gli errori,
-- quindi senza lettura un fallimento silenzioso passerebbe inosservato.
create policy "leggi i propri eventi" on analytics
  for select to authenticated
  using (auth.uid() = user_id);
