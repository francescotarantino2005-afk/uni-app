# Edge Functions

Le tre funzioni AI del progetto (vedi `docs/guida-tecnica-build.md`, FASE 4):

| Funzione | Cosa fa | Sprint |
|---|---|---|
| `estrai-orario` | Foto dell'orario → JSON di eventi (Claude vision) | 1-2 |
| `estrai-libretto` | Più foto del libretto in una chiamata → esami letti (voto, idoneità, CFU, data). Non scrive nulla: salva l'app dopo la conferma | accoglienza, tappa 2 |
| `genera-briefing` | Cron notturno → briefing personalizzato + push | 3 |
| `chat` | Assistente col contesto del profilo, cap free server-side | 5 |

**Regola non negoziabile**: la chiave API Anthropic vive SOLO qui, come secret
(`supabase secrets set ANTHROPIC_API_KEY=...`) — mai nel client, mai committata.
