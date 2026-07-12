# Scheduling del briefing (cron Supabase)

Il briefing usa due Edge Functions, richiamate da due cron job:

| Cron | Funzione | Cosa fa |
|---|---|---|
| notturno (02:00 UTC ≈ 03:00–04:00 in Italia) | `genera-briefing` | genera il testo del giorno per ogni utente attivo e lo salva in `briefings` |
| ogni 15 minuti | `invia-briefing` | manda la push agli utenti la cui `ora_briefing` è già passata e che non hanno ancora ricevuto il briefing |

Entrambe accettano solo chiamate col nostro segreto (`CRON_SECRET`, già impostato nei secrets del progetto).

## Setup (una volta sola)

1. Dashboard Supabase → **Database → Extensions**: abilita **`pg_cron`** e **`pg_net`**.
2. Dashboard → **SQL Editor** → incolla ed esegui lo script qui sotto,
   sostituendo `IL_TUO_CRON_SECRET` col valore reale (te l'ho dato in chat;
   è lo stesso salvato nei secrets con `supabase secrets set CRON_SECRET=...`).

```sql
-- Genera i briefing ogni notte (02:00 UTC).
select cron.schedule(
  'genera-briefing',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://onjlwvzewzhuprssyftt.functions.supabase.co/genera-briefing',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','IL_TUO_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

-- Invia i briefing ogni 15 minuti (rispetta l'ora scelta da ogni utente).
select cron.schedule(
  'invia-briefing',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://onjlwvzewzhuprssyftt.functions.supabase.co/invia-briefing',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','IL_TUO_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

## Comandi utili

```sql
select * from cron.job;                    -- elenca i job schedulati
select cron.unschedule('genera-briefing'); -- rimuove un job
-- storico esecuzioni:
select * from cron.job_run_details order by start_time desc limit 20;
```

## Note

- Il `CRON_SECRET` NON va committato: vive nei secrets Supabase e in questo cron (dashboard, non nel repo).
- `genera-briefing` è idempotente: se rilanciato, non rigenera i briefing già creati.
- Difese costi già dentro la funzione: salta gli inattivi da 14+ giorni, briefing statico
  (zero AI) per chi non ha lezioni né scadenze, tetto duro di chiamate AI per esecuzione.
