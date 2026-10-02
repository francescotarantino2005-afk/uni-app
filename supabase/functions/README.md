# Edge Functions

Le tre funzioni AI del progetto (vedi `docs/guida-tecnica-build.md`, FASE 4):

| Funzione | Cosa fa | Sprint |
|---|---|---|
| `estrai-orario` | Foto dell'orario → JSON di eventi (Claude vision) | 1-2 |
| `estrai-libretto` | Più foto del libretto in una chiamata → esami letti (voto, idoneità, CFU, data). Non scrive nulla: salva l'app dopo la conferma | accoglienza, tappa 2 |
| `accoglienza-dialogo` | Un turno del dialogo di accoglienza (Sonnet): estrae tutte le chiavi dalla risposta, chiede solo ciò che manca, chiude con un impegno se lo studente chiede aiuto e con garbo dopo due non-risposte di fila. Regole in `logica.ts` e `profilo.ts`, turno in `servizio.ts`; scrive il dialogo in chat_messages. Se chiude con un impegno lo salva in `profilo_studio.impegno` e, in background, fa scrivere alla chat il primo messaggio che lo mantiene | accoglienza |
| `coda-domande` | Ripropone in chat, una alla volta, le domande rimaste in coda (regole in `logica.ts`); giudica se il messaggio dello studente è la risposta. All'apertura della chat viene prima la promessa di fine accoglienza: se è ancora da mantenere la fa mantenere alla chat | blocco 6 |
| `genera-briefing` | Cron notturno → briefing personalizzato + push | 3 |
| `chat` | Assistente col contesto del profilo (Sonnet, prompt caching su istruzioni e dati dello studente; la memoria resta su Haiku), cap free server-side. Motore in `motore.ts`, logica pura in `logica.ts`. Azione `mantieni_impegno`: scrive da sola il primo messaggio che mantiene la promessa di fine accoglienza | 5 |

**Regola non negoziabile**: la chiave API Anthropic vive SOLO qui, come secret
(`supabase secrets set ANTHROPIC_API_KEY=...`) — mai nel client, mai committata.

## Repo e produzione devono coincidere

`pubblicato.json` registra, per ogni function, la versione pubblicata e
l'impronta di ogni file del suo pacchetto (compresi i file condivisi che
importa) com'era quando è stata riletta dal vivo. `npm test` diventa rosso se un
file del repo non coincide più col registro: vuol dire che quella function va
ripubblicata.

```
node scripts/funzioni.mjs stato                       # cosa è allineato, cosa va ripubblicato
node scripts/funzioni.mjs carico <function>           # i file da pubblicare
node scripts/funzioni.mjs registra <function> <json>  # dopo la pubblicazione: confronta il corpo
                                                      # letto dal vivo col repo, byte per byte,
                                                      # e solo se coincide aggiorna il registro
```

Regola: una function si considera pubblicata solo dopo `registra`. Quando cambia
un file condiviso (`_shared/briefing.ts`, `accoglienza-dialogo/profilo.ts`,
`accoglienza-dialogo/logica.ts`), `stato` elenca TUTTE le function da ripubblicare.
