# Lavoro in corso — correzioni dopo la prova TOLC-I (9 ottobre 2026, sera)

Sessione interrotta per limite d'uso. Tutto il codice è nel repo ma `chat` e
`accoglienza-dialogo` NON sono ancora ripubblicate (npm test: 178/180, falliscono
solo i due controlli "repo = pubblicato").

## Fatto
- PUNTO 1: colonna `profiles.senza_limiti` (migrazione `20261009191003_senza_limiti.sql`,
  applicata) + trigger `proteggi_flag_profilo`: con ruolo authenticated/anon lo
  studente non può cambiare né `senza_limiti` né `premium` (prima `premium` era
  modificabile dall'app: buco chiuso). Provato in transazione annullata.
  `senza_limiti = true` su **prova1@gmail.com** (id 2c17ce78-…, unico account attivo
  sulla chat il 9/10 20:00-20:55). `index.ts` salta il tetto con premium O senza_limiti.
  SBLOCCO TEMPORANEO: finché `chat` nuova non è pubblicata, sullo stesso account
  c'è anche `premium = true` (il server attuale salta il tetto solo con premium).
  DOPO la pubblicazione: `update profiles set premium=false where id='2c17ce78-217b-4f79-8c87-71f5cb7e0ae3';`
  "Mi sono bloccato" e 413 non scalano il tetto (verificato nel codice, test/limiti.test.mjs).
- CAUSE trovate (log 20:01-20:55): (a) storico = ultimi 10 messaggi e i messaggi di
  Lode in testa venivano SCARTATI: il test del 3/10 è sparito alle 20:14; (b) alle
  20:01 la correzione ha toccato max_tokens 1500 → "risposta vuota" → "Mi sono
  bloccato", e il messaggio con le risposte NON era salvato; (c) 3 rifiuti 413 alle 20:45.
- PUNTO 2: `chat/materiali.ts` (nuovo): cronologia per budget (12k token, ultimi 6
  sempre interi, fino a 80 letti); metadati.materiale (test/esercizi/piano);
  l'ultimo materiale attivo (14 giorni) rientra nel contesto se fuori finestra.
  `messaggiModello` non scarta più i messaggi di Lode e unisce quelli di fila.
  Il messaggio dello studente si salva anche quando il modello fallisce.
  MAX_TOKENS_CHAT 1500 → 4000; il log uso_chat riporta `fine` (stop_reason).
- PUNTO 3: regola nelle istruzioni tecniche + manuale 1.2 (sezione Onestà),
  manuale-testo.ts rigenerato.
- PUNTO 4: limite solo sul server (l'app non ne ha): 2000 → 8000. Nessuna build 22 serve.
- PUNTO 5: segno `[[test formato=tolc chiave=1A,... senza_penalita=16-20]]` tolto dal
  testo e salvato nei metadati; il codice legge le risposte, chiede solo le righe
  dubbie col numero (senza modello), calcola giuste/sbagliate/non date/punteggio e
  lo mette in testa; il modello spiega solo gli errori. Fallback: conteggio una sola volta.
- PUNTO 6: `formuleLeggibili` copre tutte le risposte, test compresi (test nel repo).
- PUNTO 7: eas.json committato.
- PROVE DAL VIVO: 4 chiamate, **0,078 USD** (tetto 1). A: test con chiave giusta
  (10/10 verificate a mano), niente ^. B: senza test dice subito "Non vedo il mini
  test" e chiede di reincollarlo. C: con correzione calcolata spiega solo gli errori.
  D: test fuori finestra rimesso nel contesto, usato bene. `prova-modello` rispenta (410).

## Da fare (in quest'ordine)
1. In `chat/materiali.ts`: "3: non data" scritto chiaramente va accettato come non
   data (oggi lo richiede). In `interpreta` aggiungere prima di NON_SO un caso
   `{ vuota: true }` (risposte[n]=null, conta come chiara) e nello split dei segmenti
   aggiungere `-` alla lookahead `[:)=-]`. Aggiornare in test/materiali.test.mjs
   l'attesa di d2 (diventa 'risultato' o 'conferma' solo per righe davvero dubbie).
2. `npm test`, poi pubblicare `chat` (14 file, con materiali.ts) e `accoglienza-dialogo`
   (cambia _shared/manuale-testo.ts), rileggerle e `node scripts/funzioni.mjs registra`.
3. Rimettere `premium=false` sull'account del fondatore (vedi sopra).
4. Facoltativo: convertire anche `\log_2` / pedici in Unicode (₂).

## Da provare sul telefono (dopo il punto 2)
- Chiedere una mini simulazione TOLC, rispondere con un "non so" e una riga saltata:
  il codice deve chiedere solo quelle righe, poi dare "Risultato: N su M".
- Incollare un messaggio lungo (fino a 8000 caratteri).
- Dopo 8-10 messaggi, chiedere della domanda 4 del test: Lode deve vederlo.
