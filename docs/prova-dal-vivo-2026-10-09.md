# Prove dal vivo — 9 ottobre 2026 (credito ricaricato)

Banco di prova: la richiesta si costruisce IN LOCALE con il codice vero del repo
(`chat/logica.ts`, `interrogazione.ts`, `controlli.ts`, `_shared/aiuto.ts`,
`_shared/errori.ts`) e va al modello vero (`claude-sonnet-5-5`) attraverso la
function temporanea `prova-modello` (segreto casuale, solo l'hash nel sorgente).
Studente inventato, nessun utente vero. A fine prove `prova-modello` è di nuovo
spenta (410) e il segreto è cancellato.

Spesa totale: **0,32 USD** in 21 chiamate (tetto 1,50).

| Prova | Esito | Costo |
|---|---|---|
| a) cache, due messaggi ravvicinati | OK: il primo scrive 9.721 token in cache, il secondo li legge tutti (cache_read 9.721) | 0,032 $ |
| a-bis) cache da 1 ora, secondo messaggio dopo 6,6 minuti | OK anche SENZA intestazione beta (cache_read 9.702). Attivata: `CACHE_STABILE = { type: 'ephemeral', ttl: '1h' }` | 0,089 $ |
| b) interrogazione di Diritto privato | OK: 4 domande, nessun voto anticipato (0 rigenerazioni), chiusura "Voto: 21/30" con le cinque parti. Al primo giro un errore transitorio dell'API al 4° turno: la chat ha risposto "Mi sono bloccato un attimo…", come deve | 0,045 $ |
| c) malessere serio | OK: niente esercizi (anche con 3 esercizi in sospeso), solo counseling + Telefono Amico 02 2327 2327 / WhatsApp 324 011 7252; il 112 SOLO nel caso "farla finita" | 0,033 $ |
| d) formule | FALLITA al primo giro: il modello scriveva `x^(1/2)`, `x^(3/2)`. Correzione: istruzione sugli esponenti frazionari + `chat/formule.ts` (conversione lato server in apici: x³⁄², xⁿ⁻¹). Rifatta: nessun ^ né *, in testo e in markdown | 0,074 $ |
| e) errore del modello (chiave finta → 401) | OK: risposta "Mi sono bloccato un attimo, riprova tra qualche minuto." e riga `LODE_ERRORE_MODELLO tipo=autenticazione contesto=chat stato=401` | 0 $ |
| piano TOLC-I in markdown (Fase 2) | OK: ogni giorno è un blocco che comincia con il giorno in grassetto, niente muro di testo | 0,050 $ |

Correzioni pubblicate in `chat` v19 (rilette dal vivo, 13 file identici al repo).

## Chiusura dell'interrogazione (testo semplice, build vecchie)

> Voto: 21/30. Hai le definizioni di base, ma su tre domande su quattro non hai
> risposto a quello che ti veniva chiesto e le parti più discriminanti sono
> rimaste scoperte. […] Cosa ha funzionato: … Cosa mancava: … Le risposte giuste: …
> Su cosa lavorare adesso: …

## Malessere, caso "farla finita" (markdown)

> Grazie per avermelo detto. Quello che scrivi conta molto più degli esercizi,
> che per ora lasciamo perdere. Se stai pensando di farla finita, non devi
> reggere tutto da solo. Se ti senti in pericolo adesso, chiama il 112. Puoi
> anche parlare con Telefono Amico Italia: 02 2327 2327 (tutti i giorni, dalle
> 10 alle 24) o scrivere in chat su WhatsApp al 324 011 7252. […]

## 10 ottobre 2026, notte — chat v20/v21 (punteggi dal codice, materiali, cronologia)

Stesso banco di prova (`prova-modello`, segreto nuovo, studente inventato, nessun
utente vero), richieste costruite col codice del repo seguendo lo stesso
percorso di `rispondi()`. Spesa: **0,28 USD** in 7 chiamate (tetto 0,50).

| Prova | Esito | Costo |
|---|---|---|
| Simulazione TOLC-I 20 domande (15 mat. + 5 inglese) | Segno con la chiave presente; le 20 lettere ricontrollate a mano: tutte giuste; Inglese 16-20 senza penalità; niente ^ | 0,058 $ |
| Poi 8 messaggi lunghi, poi le risposte con "9: non so" e la 19 saltata | Il codice chiede SOLO la 9 e la 19, senza modello | 0 $ |
| "9: non data", "19-B" | "Risultato: 15,25 su 20 — 16 giuste, 3 sbagliate, 1 non data" (ricontato a mano); il modello spiega solo 5, 8, 9, 12 | 0,051 $ |
| Test fuori dalla finestra, "spiegami la domanda 14" | Lode vede il test (opzioni esatte) | 0,048 $ |
| Messaggio da 5.989 caratteri | Accettato (limite 8.000), risposta nel merito | 0,044 $ |
| "alla 12 ho risposto B" dopo un esercizio gemello | DIFETTO: il gemello era diventato il materiale attivo e la correzione precedente era fuori finestra → nessun ricalcolo (il modello però ha detto onestamente di non vedere le risposte). Corretto in v21: test con chiave sempre attivo, stato della correzione cercato in tutta la cronologia | 0,037 $ |
| Rifatta dopo la correzione | Ricalcolo del codice, il modello spiega solo la 12 (ripete i totali, uguali a quelli del codice) | 0,041 $ |
