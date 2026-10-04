# Lavoro in corso — correzioni "manuale + memoria" (3-4 ottobre 2026)

## Schema (eccezione concordata)
- `chat_messages.metadati jsonb not null default '{}'`: migrazione `20261003172907_chat_messages_metadati.sql`, APPLICATA e REGISTRATA. La Fase 2 NON deve rifarla. Nessun'altra modifica allo schema. Oggi contiene solo `{ "interrogazione": { attiva, argomento, domande_fatte, massimo } }` sull'ultimo messaggio di Lode.

## Stato (4 ottobre)
- PUBBLICATE e REGISTRATE: `chat` v18, `accoglienza-dialogo` v13 (npm test 149/149). Cache da 5 minuti (ttl 1h e intestazione beta TOLTI).
- `prova-modello`: SPENTA (410), segreto cancellato. Va cancellata dalla dashboard (nome esatto `prova-modello`; il connettore non ha il comando).
- Fatto nel codice e testato: malessere nell'accoglienza, recapiti (manuale v1.1), interrogazione guidata dal codice, formato testo/markdown, errori del modello (messaggio normale + `LODE_ERRORE_MODELLO tipo=...`, dialogo fermo al suo turno).

## DA FARE CON CREDITO
Bloccato perche' l'API risponde ancora "credit balance is too low" anche dopo la ricarica (verificato il 4 ottobre con la chiave dei secrets Supabase `ANTHROPIC_API_KEY`: forse la ricarica e' su un'altra organizzazione/workspace, o non e' ancora arrivata). Per rifare le prove serve una function-tramite temporanea come `prova-modello` (inoltra la richiesta ad Anthropic, segreto casuale solo come hash nel sorgente, da spegnere a fine prova); la richiesta si costruisce in locale col codice del repo.
1. Cache da 1 ora dal vivo: 2 messaggi a 6 minuti l'uno dall'altro, con `cache_control: { type: 'ephemeral', ttl: '1h' }` (costante `CACHE_STABILE` in `chat/logica.ts`), CON e SENZA intestazione `anthropic-beta: extended-cache-ttl-2025-04-11`; riportare `cache_creation` e `cache_read` dei due messaggi. Se funziona: attivare `ttl: '1h'` (e l'intestazione in `chiamaChat`, `chat/motore.ts`, solo se serve) e ripubblicare UNA volta. Calcolo (non misurato): 1 ora conviene appena c'e' una pausa tra 5 e 60 minuti a sessione (scrittura 4 $/M contro 2,50 $/M, lettura uguale).
2. Interrogazione di Diritto dal vivo, 4 domande: numero di domande, voti anticipati, risposte rivelate, voto finale (script gia' pronto in scratchpad: `int.mjs`).
3. Tutte le prove col modello vero da rifare dal vivo: malessere nell'accoglienza (primo turno, a meta' dialogo, ansia che NON attiva), interrogazione x5, i sei casi del manuale (Diritto orale, Storia, Inglese B2, Analisi I scritto, "ho preso 18 a Fisica", "non ce la faccio piu'"), la memoria (note dopo 3 messaggi), e un messaggio con credito esaurito per vedere il messaggio "Mi sono bloccato un attimo" e la riga `LODE_ERRORE_MODELLO` nei log.
4. Non verificato dal vivo per mancanza di login: scrittura di `chat_messages.metadati`, salvataggio di `exams.tipo_esame`, scrittura/archiviazione note, `accoglienza_stato` 'completata' dopo un malessere. Va provato dal telefono con un account vero.
5. Cancellare `prova-modello` dalla dashboard Supabase.
