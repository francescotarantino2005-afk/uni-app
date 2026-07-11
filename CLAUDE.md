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
- 2026-07-11: scheletro VERIFICATO su dispositivo reale via Expo Go (connessione --tunnel: la LAN diretta non passava). Sprint 1 scheletro chiuso. Prossimo passo: progetto Supabase (regione EU) + prima migration con RLS (FASE 3 guida tecnica), poi auth email/social.
