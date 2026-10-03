# Lavoro in corso — correzioni "manuale + memoria" (3 ottobre 2026)

## Schema (eccezione concordata)
- Aggiunta `chat_messages.metadati jsonb not null default '{}'` — migrazione `supabase/migrations/20261003172907_chat_messages_metadati.sql`, APPLICATA e REGISTRATA sul database (versione 20261003172907). La Fase 2 NON deve rifarla. Nessun'altra modifica allo schema.
- `metadati` oggi contiene solo `{ "interrogazione": { attiva, argomento, domande_fatte, massimo } }` sull'ultimo messaggio di Lode (scritto da `chat/index.ts`, letto da `chat/interrogazione.ts`).

## Stato dei punti (codice nel repo, testato, committato)
1. Malessere nell'accoglienza — FATTO nel codice (`accoglienza-dialogo/logica.ts` + `servizio.ts` + `_shared/aiuto.ts`), prove con il modello vero in `test/fixtures/correzioni-prove.json`.
2. Recapiti di aiuto — FATTO nel codice: manuale v1.1 (.md e manuale-testo.ts uguali), `_shared/aiuto.ts`, controllo dei telefoni in `chat/controlli.ts` (rigenera una volta, poi toglie la frase).
3. Interrogazione guidata dal codice — FATTO nel codice: `chat/interrogazione.ts`, `chat/controlli.ts`, `chat/motore.ts`, `chat/index.ts`. 5 prove con il modello vero: 4 domande ciascuna, nessun voto anticipato.
4. Formule e formato — FATTO nel codice: simboli Unicode, campo `formato` ('testo' default | 'markdown').
5. Cache da un'ora — SCELTA 1 ora (`CACHE_STABILE` in chat/logica.ts, intestazione beta in motore.ts). Misura incompleta: credito API Anthropic finito al messaggio 5. Dettagli in docs/prova-correzioni-2026-10-03.md.
6. Pulizia — vedi sotto.

## URGENTE: il credito dell'API Anthropic e' finito ("credit balance is too low", errore 400 del 3 ottobre ~20:15). Senza credito la chat in produzione non risponde. Ricaricare da Plans & Billing, poi verificare con un messaggio.

## DA FARE (non fatto: contesto al 66% e limite orario del piano al 75%)
- [ ] PUBBLICARE le due function (il registro è rosso finché non si fa, `npm test` fallisce SOLO per questo):
  1. `node scripts/funzioni.mjs carico chat` -> `deploy_edge_function` (chat, entrypoint `chat/index.ts`, verify_jwt false) -> `get_edge_function` -> `node scripts/funzioni.mjs registra chat <file in tool-results>`.
  2. Lo stesso per `accoglienza-dialogo` (entrypoint `accoglienza-dialogo/index.ts`, verify_jwt true).
  3. `npm test` verde, commit, push.
  Nuovi file nel pacchetto di `chat`: `_shared/aiuto.ts`, `chat/controlli.ts`, `chat/interrogazione.ts`; in `accoglienza-dialogo`: `_shared/aiuto.ts`.
- [x] (fatto, vedi punto 5) Scegliere la cache (5 minuti o 1 ora) col risultato di `cache-esito.json` e, se 1 ora, mettere `ttl: '1h'` nei `cache_control` di `sistema()` in `chat/logica.ts` PRIMA di pubblicare (una sola pubblicazione).
- [x] `prova-modello` SPENTA (410), segreto cancellato. Resta da cancellare dalla dashboard (nome esatto: `prova-modello`; il connettore non ha il comando).
- [ ] "1 attività in esecuzione": non è un processo del repo (`Get-Process` mostra solo la misura della cache, `node`, avviata da me). Se resta dopo la fine della misura, è una scheda del terminale dell'app: si chiude da lì.
