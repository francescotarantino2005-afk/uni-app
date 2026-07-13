-- Template di scadenze curati (deadline_templates): scadenze tipiche dello
-- studente universitario italiano, che l'utente può aggiungere alle proprie.
--
-- NOTA PER IL FOUNDER: questi sono esempi NAZIONALI di partenza con date
-- indicative per l'A.A. 2026/27. Vanno verificati e ampliati (bandi reali,
-- date esatte, template regionali/per ateneo) — la tabella è pensata per
-- essere curata a mano da qui o dalla dashboard. regione null = nazionale,
-- ateneo null = tutti.

insert into deadline_templates (titolo, data, regione, ateneo, categoria, spiegazione) values
  ('Rinnova l''ISEE 2026', '2026-09-15', null, null, 'isee',
   'Per borse, esoneri e agevolazioni ti serve l''ISEE 2026 in corso di validità. Richiedilo a un CAF o online sul sito INPS: ci vogliono alcuni giorni, non ridurti all''ultimo.'),
  ('Domanda borsa di studio A.A. 2026/27', '2026-09-30', null, null, 'borsa',
   'Presenta la domanda per la borsa dell''ente regionale per il diritto allo studio (DSU, EDISU, DiSCo, ADiSU…). Serve l''ISEE aggiornato. Controlla il bando del tuo ente per la data esatta.'),
  ('Posto alloggio / studentato', '2026-08-31', null, null, 'affitto',
   'Se sei fuorisede, i bandi per gli alloggi degli enti per il diritto allo studio chiudono presto (spesso ad agosto). Muoviti in anticipo.'),
  ('Iscrizione / immatricolazione A.A. 2026/27', '2026-09-30', null, null, 'altro',
   'Perfeziona l''iscrizione all''anno accademico. Le date variano per ateneo: controlla la segreteria studenti.'),
  ('Prima rata tasse A.A. 2026/27', '2026-10-31', null, null, 'tasse',
   'La prima rata delle tasse universitarie di solito si paga all''immatricolazione o iscrizione. Verifica importo e scadenza nella tua area studenti.'),
  ('Domanda di esonero / no tax area', '2026-10-31', null, null, 'tasse',
   'Con un ISEE basso puoi avere l''esonero totale o parziale delle tasse (no tax area e riduzioni). A volte basta l''ISEE, a volte serve una domanda: controlla il regolamento tasse del tuo ateneo.'),
  ('Presentazione del piano di studi', '2026-11-15', null, null, 'altro',
   'La finestra per presentare o modificare il piano di studi è limitata. Controlla le scadenze del tuo corso per non perdere un anno.'),
  ('Seconda rata tasse A.A. 2026/27', '2027-01-31', null, null, 'tasse',
   'La seconda rata di solito cade tra fine gennaio e febbraio. Controlla la tua area studenti per importo e data esatta.');
