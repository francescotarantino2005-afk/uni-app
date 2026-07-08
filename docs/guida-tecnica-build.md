# Guida tecnica: come costruire l'assistente studente

**Manuale operativo passo passo — 8 luglio 2026**
Da seguire in ordine. Ogni sezione ha un risultato verificabile prima di passare alla successiva.

---

## FASE 0 — Setup ambiente e account (1 pomeriggio)

### Sul tuo computer, installa:
1. **Node.js LTS** (nodejs.org) — verifica con `node -v`
2. **Git** — verifica con `git --version`
3. **VS Code** (o editor che preferisci)
4. **Claude Code** — `npm install -g @anthropic-ai/claude-code`, poi `claude` per il login
5. Sul telefono: **Expo Go** (App Store/Play Store) — ti fa vedere l'app in sviluppo sul telefono vero senza compilare nulla

### Account da aprire (tutti gratis in questa fase):
| Account | Serve per | Costo |
|---|---|---|
| GitHub | Repository del codice | 0 |
| Supabase (supabase.com) | Database, auth, funzioni server | 0 (free tier) |
| Anthropic Console (console.anthropic.com) | Chiave API per l'AI | Paghi a consumo (~5€ per iniziare) |
| Expo (expo.dev) | Build e push notification | 0 |

Apple Developer (99$) e Google Play (25$) **non ora**: servono solo quando pubblichiamo (fine agosto). Su iPhone puoi testare tutto con Expo Go fino ad allora.

### Regola di sicurezza numero uno (memorizzala)
**La chiave API di Anthropic non deve MAI stare dentro l'app.** Chiunque può decompilare un'app e leggerla — ti svuoterebbero il credito in una notte. Tutte le chiamate AI passano dal backend (Supabase Edge Functions), dove la chiave vive come variabile d'ambiente. L'app parla solo col tuo backend, mai direttamente con Anthropic.

---

## FASE 1 — Scheletro del progetto (giorno 1-2)

Apri il terminale nella cartella dove vuoi il progetto:

```bash
# Crea l'app Expo con TypeScript
npx create-expo-app@latest assistente-studente --template default

cd assistente-studente

# Dipendenze principali
npx expo install expo-notifications expo-image-picker expo-camera
npm install @supabase/supabase-js
npm install zustand            # gestione stato semplice
npx expo install expo-secure-store   # per salvare la sessione utente

# Git fin dal primo minuto
git init && git add . && git commit -m "scheletro iniziale"
```

Poi crea il progetto su **supabase.com** (New project → regione EU per il GDPR) e installa la CLI:

```bash
npm install -g supabase
supabase init
supabase login
```

**Verifica di fine fase**: `npx expo start`, scansioni il QR con Expo Go, e vedi la schermata di default sul TUO telefono. Se funziona, sei operativo.

---

## FASE 2 — Il file CLAUDE.md (il cervello del tuo copilota)

Nella radice del progetto crea `CLAUDE.md`. È il file che Claude Code legge a ogni sessione: gli dà contesto, regole e architettura. Incolla questo (e aggiornalo man mano):

```markdown
# Assistente Studente — contesto progetto

## Cosa stiamo costruendo
App mobile (Expo/React Native + TypeScript) per studenti universitari italiani:
assistente personale con briefing mattutino push, orario lezioni, radar scadenze,
libretto/media, piani di studio per esami, chat AI col contesto del profilo.

## Stack
- Frontend: Expo (React Native), TypeScript, Zustand per lo stato
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions in Deno)
- AI: API Anthropic (Claude) — SOLO lato server nelle Edge Functions, mai nel client
- Push: expo-notifications + Expo Push Service

## Regole non negoziabili
1. La chiave API Anthropic sta SOLO nelle env delle Edge Functions
2. Ogni tabella ha Row Level Security: un utente vede solo i suoi dati
3. Tutto il testo UI in italiano, tono amichevole ma non infantile
4. Componenti piccoli e riutilizzabili in /components
5. Ogni feature completata = commit git con messaggio chiaro
6. Le chiamate AI hanno sempre: timeout, gestione errore visibile all'utente, cap di utilizzo

## Struttura cartelle
- /app        → schermate (expo-router)
- /components → componenti UI riutilizzabili
- /lib        → client supabase, utils, tipi TypeScript
- /store      → stato Zustand
- /supabase/functions → Edge Functions (briefing, chat, estrai-orario)
- /supabase/migrations → schema DB versionato

## Stato attuale
[aggiorna qui a ogni sessione: cosa è fatto, cosa è in corso]
```

**Come si lavora con Claude Code, in pratica**: apri il terminale nel progetto, scrivi `claude`, e dai compiti **piccoli e verificabili**, uno alla volta. Non "fammi l'app": piuttosto "crea la schermata di onboarding con 3 step: scelta ateneo da lista, upload foto orario, permesso notifiche — segui CLAUDE.md". Dopo ogni task: provi sul telefono, se va bene commit, poi task successivo. Claude Code lavora meglio a mattoni che a cattedrali — e tu mantieni il controllo su ogni pezzo.

---

## FASE 3 — Schema database (giorno 2-3)

Prima migration Supabase. Le tabelle del cuore:

```sql
-- profilo (estende auth.users di Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  ateneo text,
  corso text,
  anno int,
  fuorisede boolean default false,
  regione text,
  ora_briefing time default '07:30',
  premium boolean default false,
  created_at timestamptz default now()
);

-- eventi orario (lezioni ricorrenti)
create table schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  titolo text not null,          -- "Analisi Matematica 1"
  giorno int not null,           -- 1=lunedì ... 7=domenica
  ora_inizio time not null,
  ora_fine time,
  aula text,
  colore text
);

-- scadenze (personali + da template)
create table deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  titolo text not null,
  data date not null,
  categoria text,                -- 'tasse' | 'isee' | 'borsa' | 'affitto' | 'esame' | 'altro'
  spiegazione text,              -- il "cosa fare" in italiano semplice
  completata boolean default false,
  fonte text default 'utente'    -- 'utente' | 'template'
);

-- template scadenze curati da noi (senza user_id: globali)
create table deadline_templates (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  data date,
  regione text,                  -- null = nazionale
  ateneo text,                   -- null = tutti
  categoria text,
  spiegazione text
);

-- esami e libretto
create table exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  materia text not null,
  cfu int,
  data_esame date,
  voto int,                      -- null = da sostenere
  lode boolean default false
);

-- piani di studio generati
create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade,
  piano jsonb,                   -- giorni → obiettivi
  created_at timestamptz default now()
);

-- briefing generati (log + idempotenza)
create table briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  data date not null,
  contenuto text,
  inviato boolean default false,
  unique(user_id, data)
);

-- token push del dispositivo
create table push_tokens (
  user_id uuid references profiles(id) on delete cascade,
  token text primary key,
  updated_at timestamptz default now()
);

-- RLS su tutto
alter table profiles enable row level security;
alter table schedule_events enable row level security;
alter table deadlines enable row level security;
alter table exams enable row level security;
alter table study_plans enable row level security;
alter table briefings enable row level security;
alter table push_tokens enable row level security;

-- policy tipo (ripetila per ogni tabella con user_id)
create policy "own data" on schedule_events
  for all using (auth.uid() = user_id);
```

Chiedi a Claude Code di completare le policy e applicare la migration (`supabase db push`).

---

## FASE 4 — Le tre Edge Functions AI (giorno 4-10)

### 1. `estrai-orario` — la magia dell'onboarding
Input: foto/screenshot dell'orario (base64). La funzione chiama Claude con vision e un prompt che impone output JSON strutturato (array di schedule_events). L'app mostra il risultato in anteprima modificabile → l'utente conferma → insert nel DB. Gestisci sempre il caso "foto illeggibile" con inserimento manuale di riserva.

### 2. `genera-briefing` — il cuore del prodotto
Girata da un **cron di Supabase ogni notte (es. 4:00)**:
1. prende tutti gli utenti attivi
2. per ciascuno raccoglie: lezioni di oggi, scadenze entro 7 giorni, esami entro 21 giorni, piano di studio del giorno
3. UNA chiamata a Claude per utente → 3-4 frasi di briefing (tono: amico sveglio, non segretaria)
4. salva in `briefings` e invia la push all'ora scelta dall'utente via Expo Push API

Nota costi: usa il modello piccolo/veloce per i briefing (è un riassunto, non un ragionamento) — a ~1.000 utenti parli di pochi euro al giorno. Il modello grande tienilo per i piani di studio e i kit (premium). Altre difese obbligatorie: salta gli utenti inattivi da 14+ giorni; se l'utente non ha né lezioni né scadenze quel giorno manda un messaggio statico non generato; imposta lo spend limit hard sulla console Anthropic con degrado grazioso quando esaurito.

### 3. `chat` — l'assistente
Input: messaggio utente + storico breve. La funzione costruisce il contesto dal DB (profilo, orario, scadenze, esami, media) e chiama Claude. **Il cap free (e il flag premium) si controllano QUI, lato server** — mai fidarsi del client. Conta i messaggi del giorno in una tabella `usage`.

---

## FASE 5 — Ordine di costruzione delle schermate (le 6 settimane)

| Sprint | Cosa costruisci | Fatto quando... |
|---|---|---|
| **1** (21-27 lug) | Auth (email/Apple/Google), onboarding: ateneo → foto orario → estrazione → conferma → permesso notifiche | Un amico si registra e vede il suo orario nell'app in <5 min |
| **2** (28 lug-3 ago) | Home con "oggi" (lezioni + prossime scadenze), tab orario settimanale | La home è la schermata che apriresti ogni mattina tu |
| **3** (4-10 ago) | Motore briefing + push + preferenze orario sveglia | Ricevi la push alle 7:30 con la TUA giornata vera |
| **4** (11-17 ago) | Radar scadenze (+ 20-30 template nazionali/regionali che carichi tu), libretto e media con simulatore | Aggiungi una scadenza in 10 secondi; la media si aggiorna da sola |
| **5** (18-24 ago) | Chat col contesto + piano esame a ritroso + timer focus. La schermata "cap raggiunto" è un upsell: "Plus in arrivo" + bottone "Avvisami" (evento tracciato) + referral "+5 msg/giorno per invito" | Chiedi "come sto messo?" e risponde con i TUOI dati; a cap raggiunto vedi l'upsell |
| **6** (25-31 ago) | Rifiniture, onboarding levigato, icona/nome, **submission agli store** | Build EAS caricata su App Store Connect e Play Console |

A ogni sprint: prima fai girare la feature per te, poi falla provare a 2-3 amici (TestFlight interno dallo sprint 3), poi commit e avanti. Il paywall NON si costruisce ora — arriva a ottobre col premium (RevenueCat si integra in 2-3 giorni quando serve).

### Per la pubblicazione (fine agosto):
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all      # prima build di produzione
eas submit                    # invio agli store
```
Qui servono gli account Apple Developer (99$) e Google Play (25$) — è il momento in cui li apri, non prima. La review Apple richiede giorni, a volte respinge (motivi tipici: login social incompleto, privacy policy mancante — la prepariamo). Per questo la submission è al 25-31 agosto, con margine.

---

## FASE 6 — Cosa monitorare dal giorno del lancio

- **Dashboard Anthropic**: spesa API giornaliera (imposta un limite di spesa dal pannello!)
- **Supabase**: numero utenti, righe, uso free tier
- **Metriche prodotto** (bastano eventi semplici su una tabella `analytics`): quanti aprono la push del mattino, quanti tornano il giorno dopo (D1) e dopo una settimana (D7), quale tab usano. La D7 è il numero che decide tutto: sopra il 20% per un'app così è ottimo segno.

---

## Riepilogo dei prossimi 7 giorni

1. **Oggi/domani**: setup Fase 0+1 (ambiente, account, scheletro che gira sul telefono)
2. **Entro il weekend**: CLAUDE.md + schema DB applicato
3. **Prossima settimana**: Edge Function `estrai-orario` funzionante con una foto del TUO orario — è il primo "wow" del prodotto
4. In parallelo (30 min/giorno): apri il canale TikTok e inizia col build-in-public — "sto costruendo l'assistente AI per studenti universitari italiani" è un format che documenta e promuove insieme
5. La landing con lista d'attesa te la preparo io quando vuoi (un pomeriggio)

Quando hai fatto la Fase 0-1, torna qui: procediamo sprint per sprint, e per ogni blocco ti do i prompt precisi da dare a Claude Code.
