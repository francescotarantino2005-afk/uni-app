# Assistente Studente — contesto progetto

## Cosa stiamo costruendo
App mobile (Expo/React Native + TypeScript) per studenti universitari italiani:
assistente personale con briefing mattutino push, orario lezioni, radar scadenze,
libretto/media, piani di studio per esami, chat AI col contesto del profilo.
Lancio target: settembre 2026 (picco immatricolazioni). Founder solo, budget limitato.

## Documenti di riferimento (leggili quando serve contesto)
- `docs/progetto-assistente-studente.md` → visione completa, loop di prodotto, MVP, monetizzazione, rischi
- `docs/guida-tecnica-build.md` → architettura, schema DB, Edge Functions, piano sprint

## Stack
- Frontend: Expo (React Native), TypeScript, expo-router, Zustand per lo stato
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions in Deno)
- AI: API Anthropic (Claude) — SOLO lato server nelle Edge Functions, mai nel client
- Push: expo-notifications + Expo Push Service
- Pagamenti (fase 2, ottobre): RevenueCat + abbonamenti nativi store

## Regole non negoziabili
1. La chiave API Anthropic sta SOLO nelle env delle Edge Functions — mai nel client, mai committata
2. Ogni tabella ha Row Level Security: un utente vede solo i suoi dati
3. Tutto il testo UI in italiano, tono amichevole ma non infantile
4. Componenti piccoli e riutilizzabili in /components
5. Ogni feature completata = commit git con messaggio chiaro
6. Le chiamate AI hanno sempre: timeout, gestione errore visibile all'utente, cap di utilizzo controllato lato server
7. Niente feature fuori dallo scope dello sprint corrente: la lista MVP è chiusa, gli extra vanno in docs/backlog.md

## Struttura cartelle
- /app        → schermate (expo-router)
- /components → componenti UI riutilizzabili
- /lib        → client supabase, utils, tipi TypeScript
- /store      → stato Zustand
- /supabase/functions → Edge Functions (estrai-orario, genera-briefing, chat)
- /supabase/migrations → schema DB versionato
- /docs       → documenti di progetto

## MVP (Sprint 1-6, dettagli nella guida tecnica)
1. Auth + onboarding: ateneo → foto orario → estrazione AI → conferma → permesso notifiche
2. Home "oggi": lezioni del giorno + prossime scadenze
3. Briefing mattutino: generato ogni notte da cron, inviato via push all'ora scelta
4. Radar scadenze: personali + template curati (ISEE, tasse, borse regionali)
5. Libretto: voti, media, simulatore
6. Chat AI col contesto del profilo (cap giornaliero per utenti free, verificato server-side)
   - La schermata "cap raggiunto" è un UPSELL: messaggio "Plus in arrivo" + bottone "Avvisami quando esce" (evento tracciato in analytics) + referral "invita un compagno → +5 messaggi/giorno per sempre"
FUORI dall'MVP (fase 2): kit di studio da PDF, registrazione lezioni, orale simulato a voce, paywall/RevenueCat, integrazione portali atenei, studio condiviso.

## Monetizzazione (sequenza decisa — non anticipare nessuna fase)
- FASE 1 (settembre, lancio): tutto gratis, ZERO ads, zero paywall. Obiettivo: abitudine + passaparola nei gruppi di corso. Ingressi a ondate via lista d'attesa/codici invito (controllo costi e hype)
- FASE 2 (ottobre-novembre): premium "Plus" 6,99€/mese o 39,99€/anno (founding 29,99€ primo anno, primi 1000). Include: chat illimitata, kit di studio da PDF (3/mese inclusi, extra a 1,99€), piani multi-esame illimitati, correzione scritti, statistiche, no-ads futuro. Si attiva SOLO sopra ~1.500-2.000 utenti attivi (e solo dopo apertura P.IVA)
- FASE 2.5 (nov-dic): registrazione lezione → appunti automatici; orale simulato a voce (feature premium, rilasci mensili = retention + contenuti TikTok)
- FASE 3 (2027, solo con migliaia di DAU): ads leggere per i free. Regole ferree: MAI nel briefing, MAI in chat, MAI durante focus; solo banner nativi in schermate fredde (libretto, scadenze). Il premium le rimuove

## Protezione costi AI (obbligatoria, non rimandabile)
1. Routing modelli: chat e briefing → modello piccolo/veloce; modello grande SOLO per feature premium (kit, piani complessi)
2. Cap chat free verificato server-side (tabella usage), mai lato client
3. Spend limit hard sulla console Anthropic + alert; se il budget giornaliero è esaurito la chat degrada con grazia ("torna domani"), non crasha
4. Cron briefing: salta utenti inattivi da 14+ giorni; briefing statico (non generato) se l'utente non ha né lezioni né scadenze quel giorno
5. Rate limiting per utente su tutte le Edge Functions (anti-abuso/scripting)
6. Prompt caching Anthropic sui system prompt ripetuti

## Fisco (promemoria founder)
Niente P.IVA/commercialista finché tutto è gratuito. Aprire il forfettario PRIMA di attivare gli abbonamenti (consulenza commercialista a settembre/ottobre), non dopo aver incassato.

## Stato attuale
[aggiorna qui a ogni sessione: cosa è fatto, cosa è in corso, prossimo passo]
- 2026-07-08: progetto definito, si parte con lo Sprint 1 (scheletro + navigazione)
- 2026-07-09: scheletro completato — Expo + TypeScript + expo-router, tab (Oggi/Orario/Scadenze/Libretto/Chat), onboarding 3 step con gate al primo avvio (flag in SecureStore), client Supabase in /lib/supabase.ts (env in .env, non committato), tema dark in /lib/theme.ts, store Zustand in /store.
- 2026-07-10: downgrade a Expo SDK 54 — l'Expo Go degli store è fermo alla 54.0.2, npm "latest" (SDK 57) non ci gira. NON aggiornare l'SDK finché lo store non aggiorna Expo Go.
- 2026-07-11: scheletro VERIFICATO su dispositivo reale via Expo Go (connessione --tunnel: la LAN diretta non passava). Sprint 1 scheletro chiuso.
- 2026-07-11 (FASE 3): schema DB applicato al progetto Supabase EU (eu-north-1) — 8 tabelle (profiles, schedule_events, deadlines, deadline_templates, exams, study_plans, briefings, push_tokens), RLS su tutte, policy "own data" verificate via REST (insert non autorizzati → 42501). CLI Supabase come devDependency (`npx supabase`), migration in /supabase/migrations. .env con URL e publishable key reali (non committato).
- 2026-07-13 (Sprint 1, auth+onboarding): auth email+password funzionante (conferma email DISATTIVATA sul dashboard per la fase test — riattivarla con SMTP proprio prima del lancio), sessione persistente (SecureStore su nativo, storage browser su web), onboarding funzionante: ateneo → foto orario (image picker, senza AI) → notifiche → riga in profiles → home. Routing: no sessione → /auth; sessione senza profilo → onboarding; con profilo → home. Errori auth tradotti in italiano (lib/erroriAuth.ts). Token push best-effort (in Expo Go non disponibile, arriverà con la dev build). Verificato E2E su web: registrazione → onboarding → profiles 201 → home con ateneo → logout. Prossimo passo: Edge Function estrai-orario (FASE 4.1) o tab Orario/Home con dati (Sprint 2).
- 2026-07-14 (Sprint 2): tab con dati veri — Orario (vista per giorno, form lezione in modale /lezione con inserimento/modifica/eliminazione, palette colori), Oggi (lezioni del giorno + prossime 5 scadenze, stati vuoti curati, pull-to-refresh, refetch al focus), Scadenze (aggiunta rapida inline titolo/data GG-MM-AAAA/categoria a chip, spunta completata con aggiornamento ottimista, ordinate per data con le completate in fondo). Moduli dati in lib/orarioDb.ts e lib/scadenzeDb.ts, date italiane in lib/date.ts (senza Intl), categorie in lib/categorie.ts. Verificato E2E su web contro Supabase reale (insert 201, patch 204, RLS ok). Prossimo passo: Edge Function estrai-orario (FASE 4.1, il "wow" dell'onboarding) o briefing (Sprint 3).
- 2026-07-15 (FASE 4.1): Edge Function estrai-orario DEPLOYATA e testata — foto base64 → Claude Haiku 4.5 con vision e tool use forzato (strict) → lezioni JSON. Sicurezza: verifica JWT, rate limit 10/giorno per utente (tabella usage_estrazioni, solo service role), timeout 30s, validazione server-side degli orari. Errori tipizzati (FOTO_ILLEGGIBILE 422, LIMITE_RAGGIUNTO 429, TIMEOUT 504…) tradotti in italiano nell'app (lib/estrazioneOrario.ts). Nell'app: onboarding foto → "Estrai le lezioni" → anteprima modificabile (/anteprima-orario, crea il profilo se serve) → insert in schedule_events; "Importa da foto" anche nella tab Orario (/importa-orario). ANTHROPIC_API_KEY solo nei secrets della funzione. Test E2E: estrazione perfetta da orario sintetico (6/6 lezioni), 401 senza JWT, 422 foto illeggibile, 429 oltre il limite. NB: l'utente collaudo.sprint1.d ha il quota estrazioni esaurito per 24h. Prossimo passo: briefing mattutino (Sprint 3, FASE 4.2) — servirà EAS dev build per il push.
- 2026-07-16 (Sprint 3 — briefing): pipeline briefing completa e testata in produzione. Due Edge Functions: genera-briefing (cron notturno, per utente attivo raccoglie lezioni oggi + scadenze 7gg + esami 21gg → UNA chiamata Claude Haiku 4.5, tono "amico sveglio", salva in briefings, idempotente) e invia-briefing (cron ogni 15 min: manda push Expo agli utenti la cui ora_briefing è già passata; + modalità "prova" con JWT per test on-demand). Difese costi verificate: statico ZERO-AI se niente lezioni/scadenze, salta inattivi 14+ gg (colonna profiles.ultimo_accesso, aggiornata all'avvio), tetto AI per run, degrado grazioso a statico su errore. Logica condivisa in supabase/functions/_shared/briefing.ts; fuso Europe/Rome (gestisce ora legale). App: schermata /preferenze (ora briefing → profiles.ora_briefing + notifica LOCALE giornaliera + registra push token), card briefing in Home, deep-link push→Home. SECRETS: ANTHROPIC_API_KEY e CRON_SECRET nei secrets Supabase (mai nel repo). Cron NON ancora schedulato: istruzioni in docs/cron-setup.md (dashboard SQL, pg_cron+pg_net). VINCOLO APPLE: dev build EAS iOS e push remoto richiedono Apple Developer Program a pagamento (99$/anno); l'account gratuito non basta. Fallback senza account: notifica locale + briefing in-app (già implementato). Prossimo passo: dev build (utente) + schedulare i cron, poi Sprint 4 (radar scadenze con template + libretto).
- 2026-07-16 (Sprint 4 — Libretto): tab Libretto completa sulla tabella exams. Logica pura in lib/libretto.ts (media PONDERATA sui CFU somma(voto*cfu)/somma(cfu), lode=30 ma contata a parte, "da sostenere"=voto null escluso dalla media, proiezione laurea media/30*110 solo indicativa). CRUD esami in lib/esamiDb.ts, form in /esame (materia, CFU, switch già sostenuto→voto 18-30 a chip + lode solo sul 30, data opz). Tab: statistiche in cima (media grande, CFU acquisiti, lodi, esami, proiezione /110), liste Sostenuti/Da sostenere separate, stato vuoto curato. Simulatore /simulatore due modalità: A "che media avrò con voto X a Y CFU" (mostra delta), B "che voto serve per media Z" (casi: serve almeno N / ci sei già / non con un solo esame). Matematica validata con test numerici + E2E su web: media 28,29 con Analisi(27,12CFU)+Fisica(30 e lode,9CFU), CFU 21, 1 lode, laurea 104/110, da-sostenere escluso, tutti i casi del simulatore, modifica precompilata. BUGFIX Sprint 3: app/_layout.tsx chiamava Notifications.getLastNotificationResponseAsync() su web (crash) → ora guardato con Platform.OS!=='web'. Prossimo passo: radar scadenze con template curati (deadline_templates: ISEE/tasse/borse) — l'ultimo pezzo MVP dello Sprint 4.
- 2026-07-16 (Sprint 4 — template scadenze): radar scadenze con template curati completato. Migration seed con 8 template NAZIONALI di partenza (ISEE, borsa, alloggio, iscrizione, prima/seconda rata tasse, esonero/no tax area, piano di studi) — date indicative A.A. 2026/27, spiegazioni oneste ("verifica sul sito dell'ateneo"). DA CURARE dal founder: date reali + template regionali/per ateneo (la guida dice "20-30 che carichi tu"). deadline_templates ha RLS sola-lettura per autenticati (seed via migration bypassa RLS). lib/templateDb.ts: filtro nazionali+regione utente+ateneo utente, solo scadenze future; aggiungiDaTemplate copia in deadlines con fonte='template'; dedup via chiave titolo|data. Schermata /template-scadenze (card con icona categoria, "tra N giorni", spiegazione, bottone Aggiungi→"Aggiunta ✓"). Banner "Scadenze da non perdere" in cima alla tab Scadenze. Verificato E2E su web: 8 template letti via RLS, aggiunta copia in deadlines, comparsa nella lista personale, dedup sul già-aggiunto. MVP Sprint 4 COMPLETO (libretto + radar scadenze). Prossimo passo: Sprint 5 (chat AI col contesto del profilo + cap free server-side + schermata upsell "cap raggiunto").
