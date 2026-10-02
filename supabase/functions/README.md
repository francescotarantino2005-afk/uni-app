# Edge Functions

Le tre funzioni AI del progetto (vedi `docs/guida-tecnica-build.md`, FASE 4):

| Funzione | Cosa fa | Sprint |
|---|---|---|
| `estrai-orario` | Foto dell'orario → JSON di eventi (Claude vision) | 1-2 |
| `estrai-libretto` | Più foto del libretto in una chiamata → esami letti (voto, idoneità, CFU, data). Non scrive nulla: salva l'app dopo la conferma | accoglienza, tappa 2 |
| `accoglienza-dialogo` | Un turno del dialogo di accoglienza (Sonnet): estrae tutte le chiavi dalla risposta, chiede solo ciò che manca, chiude con un impegno se lo studente chiede aiuto. Regole in `logica.ts` e `profilo.ts`; scrive il dialogo in chat_messages | accoglienza |
| `coda-domande` | Ripropone in chat, una alla volta, le domande rimaste in coda (regole in `logica.ts`); giudica se il messaggio dello studente è la risposta | blocco 6 |
| `genera-briefing` | Cron notturno → briefing personalizzato + push | 3 |
| `chat` | Assistente col contesto del profilo, cap free server-side | 5 |

**Regola non negoziabile**: la chiave API Anthropic vive SOLO qui, come secret
(`supabase secrets set ANTHROPIC_API_KEY=...`) — mai nel client, mai committata.
