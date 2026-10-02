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
- 2026-07-18 (Sprint 5 — chat AI): ultima feature MVP completata e verificata E2E. Edge Function `chat` (verify_jwt=false, auth via getUser): costruisce il contesto dal DB (profilo, orario settimanale, scadenze future, libretto con media ponderata calcolata inline), UNA chiamata Claude Haiku 4.5, storico breve riletto dal DB (non dal client). CAP GIORNALIERO 10 msg/utente verificato SERVER-SIDE su tabella usage_chat (nessuna policy RLS → il client non può leggerla né manipolarla); i premium (profiles.premium) non hanno cap; il cap si azzera a mezzanotte (data Roma). Degrado grazioso: timeout 30s → 504, AI giù → 503, mai crash. Tabelle nuove: chat_messages (RLS select own, scritta dal server), usage_chat (solo service role), analytics (insert+select own). App: tab Chat con storico, bolle, stato vuoto con 3 suggerimenti, invio ottimista; su 429 CAP_RAGGIUNTO naviga a /cap-raggiunto = UPSELL (Plus in arrivo + "Avvisami quando esce" + referral "+5 msg/giorno"), entrambi i bottoni tracciano eventi in analytics (plus_avvisami, referral_interesse) — verificato che le righe finiscono davvero nel DB. TRE BUG trovati e corretti in verifica: (1) FlatList virtualizzata non renderizzava gli ultimi messaggi → lista `inverted` (pattern chat standard, niente scrollToEnd); (2) domanda e risposta inserite in un unico insert avevano lo STESSO created_at → ordine di rilettura non deterministico → due insert sequenziali; (3) l'AI rispondeva in markdown e le bolle mostravano gli asterischi letterali → system prompt "testo semplice, niente markdown". MVP COMPLETO (tutti e 6 i punti di CLAUDE.md). Restano operativi: schedulare i cron del briefing (docs/cron-setup.md) e la dev build EAS per il push remoto. Prossimo passo: Sprint 6 (rifiniture, icona/nome, submission store) oppure curare i template scadenze reali.
- 2026-07-18 (Sprint 6, rifiniture): prima prova E2E dell'INTERO flusso con un account vergine (matricola.nuova.18lug@mailinator.com) — finora ogni sprint era stato verificato in isolamento. Percorso: registrazione → onboarding (ateneo → salto foto → notifiche) → Home → Orario → Scadenze (+1 da template) → Libretto → Simulatore → Chat. Tutto funziona, stati vuoti curati, nessun NaN nel simulatore a freddo ("Sarebbe il tuo primo voto in media"). UNICO problema trovato: la chat a freddo era un VICOLO CIECO — rispondeva onestamente "non hai esami" ma mandava l'utente in segreteria invece di dirgli che i dati li inserisce lui nell'app. Corretto nel system prompt della funzione chat: ora l'assistente sa quali sezioni esistono (Oggi/Orario/Scadenze/Libretto) e sa che l'app NON è collegata ai portali d'ateneo, quindi quando un dato manca invita ad aggiungerlo nella tab giusta ("aggiungi i tuoi esami dalla tab Libretto e ti calcolo subito la media"). Verificato su libretto vuoto e orario vuoto. Prossimo passo: restano solo cose bloccate su di te — schedulare i cron (docs/cron-setup.md), dev build EAS/account Apple per il push, e curare i template scadenze con le date reali.
- 2026-07-31 (Sprint 6 — "AI PRESENTE": piano di studio + sessioni guidate + home proattiva): l'assistente ora dice cosa fare oggi, non aspetta la chat. TRE parti, tutte fatte, deployate e verificate E2E in produzione. (A) Edge Function nuova `genera-piano`: piano a ritroso dalla data dell'esame, legge le fasce ORARIE realmente libere (fuori dalle lezioni) e le scadenze del periodo, Claude Haiku con tool use forzato e schema strict; salva in study_plans.piano (jsonb). Difese costi: JWT (401), cap 5 piani/mese server-side su tabella `usage_piani` (nessuna policy RLS → il client non la tocca) con 429 LIMITE_RAGGIUNTO, timeout 30s, materiale ≤500 char, orizzonte pianificato max 45 giorni. GARANZIA anti-sovrapposizione: oltre al prompt, un filtro DETERMINISTICO lato server scarta ogni sessione che non stia interamente dentro una fascia libera del giorno (e quelle negli ultimi 3 giorni, riservati al ripasso, quando l'orizzonte è >5 gg) — così nessuna sessione può mai finire sopra una lezione, a prescindere dal modello. (B) Ricalcolo DETERMINISTICO lato app (zero AI) in lib/pianoStudio.ts: le sessioni sono slot con contenuto+stato; Fatto→'fatta'; Saltata/A metà marca lo slot e SLITTA il contenuto sulle prossime sessioni libere, l'eccedenza oltre l'esame è ciò che manda "in ritardo"; avviso onesto (% programma raggiungibile) se arretri >3 sessioni. Schermate: /nuovo-piano (form), /piano (vista sessioni+ripassi+avanzamento), /sessione (timer con pausa, schermo sempre acceso via expo-keep-awake, bottoni Fatto/A metà/Saltata). (C) `suggerimento_oggi` aggiunto allo STESSO output di genera-briefing (nessuna chiamata AI in più) + colonna briefings.suggerimento; la Home mostra una card proattiva "Oggi" con "Inizia sessione" (o invito a creare un piano se non c'è). Bug trovati e corretti in verifica: (1) le lezioni arrivano come time Postgres "HH:MM:SS" ma il parser accettava solo "HH:MM" → le lezioni venivano ignorate e le fasce risultavano tutte libere (avrebbe piazzato studio sopra le lezioni) — regex corretta ad accettare i secondi; (2) il modello ogni tanto sconfinava dai bordi di una fascia → risolto col filtro deterministico di cui sopra; (3) in _shared/briefing.ts la "prossima sessione" filtrava stato!='fatta' invece di =='da_fare', mostrando slot già archiviati (saltata/meta) — allineato al modello deterministico. TEST E2E (script effimero, non committato): genera-piano 200, 0 sessioni sovrapposte a lezioni su 17 sessioni, ultimi 3 giorni liberi, RLS cross-user (utente B non legge NÉ modifica il piano di A, per select e patch), cap mensile→429, 401 senza JWT — tutti PASSATI. Migrazione 20260728120000 applicata, funzioni deployate (genera-piano, genera-briefing, invia-briefing con --use-api). NB: `chat` non toccato da questo sprint. Prossimo passo: invariato — cron del briefing (docs/cron-setup.md), dev build EAS/Apple per il push, template scadenze reali; in più ora si può curare la UX del piano sul telefono.
- 2026-10-01 (notte — accoglienza nuova, dialogo, coda, reazioni): l'app ora si chiama Lode. ACCOGLIENZA: ateneo → corso → anno (bivio matricola, colonna profiles.matricola) → nome del bot → [solo "Anni successivi": foto del libretto → conferma riga per riga → libretto-pronto] → DIALOGO a cinque domande (app/onboarding/dialogo.tsx) → app. Stato in profiles.accoglienza_stato ("corso"…"libretto", "dialogo:1"…"dialogo:5", "completata"; null = account vecchio). Foto dell'orario e notifiche NON sono più nell'accoglienza: l'orario si importa dal tab Orario, il permesso notifiche si chiede in Preferenze quando si imposta il promemoria. EDGE FUNCTIONS nuove: estrai-libretto (più foto in una chiamata, non scrive nulla), accoglienza-dialogo (v6: il modello restituisce pezzi, la battuta la compone il codice), coda-domande (ripropone in chat una domanda in coda al giorno; regole pure in coda-domande/logica.ts). Senza token CLI le function si pubblicano dal collegamento Supabase (MCP): file singolo o file nella stessa cartella. REAZIONI: components/ReazionePersonaggio + lib/reazioni.ts (elenco chiuso), pose in lib/pose.ts (una riga per posa). TEST: `npm test` (node --test, 40 test sulla logica pura). Battute della prova del tono in docs/prova-tono-2026-10-01.md. Build iOS 16 (solo accoglienza accorciata) e 17 (tutto) inviate ad App Store Connect. DA SAPERE: 4 migrazioni del repo non risultano registrate sul database anche se le loro colonne esistono (applicate a mano): note_studente, esami_professore_tipo, accoglienza, esami_idoneita — non lanciare `db push` senza prima segnarle come applicate. genera-piano in produzione ha il file condiviso del 18 settembre (una riga in meno, che non usa).
- 2026-10-02 (il dialogo ascolta): accoglienza-dialogo riscritta (v7) e passata a `claude-sonnet-5-5` con risposta strutturata (`output_config` json_schema; su questo modello lo strumento forzato viene rifiutato e il ragionamento esteso si spegne con `thinking: { type: 'between_tools' }`). Non è più un questionario a contatore: a ogni turno riceve tutta la conversazione, estrae TUTTE le chiavi dalla risposta, e la domanda successiva la sceglie il CODICE tra le chiavi vuote e non ancora chieste; quando non manca niente chiude, anche dopo un messaggio. Ogni chiave salva le parole dello studente (basta il testo perché conti come risposta), data/minuti/livello sono facoltativi. Richiesta di aiuto esplicita → chiusura con un impegno e apertura della chat. Nuova chiave `contesto`. FORMA di profilo_studio cambiata: `avanzamento` è `{ testo, livello }`, `esame_target` ha anche `testo` (la forma vecchia viene convertita da `profiloCompleto`). Logica PURA condivisa tra function, app e test in `supabase/functions/accoglienza-dialogo/logica.ts` e `profilo.ts` (l'app la importa da `lib/dialogoLogica.ts`; tsconfig ha `allowImportingTsExtensions`). coda-domande (v2) allinea la coda al profilo prima di proporre: una chiave già risposta passa a "fatta". Notifiche: il permesso si chiede SOLO alla prima scadenza aggiunta (`components/RichiestaNotifiche`). Pose vere in `assets/images/pose` (mappa in `lib/pose.ts`). Test: `npm test`, 47 test; le quattro conversazioni di prova usano risposte del modello registrate in `test/fixtures/dialoghi.json`, battute in `docs/prova-dialogo-2026-10-02.md`. Le 4 migrazioni applicate a mano ora sono registrate nello storico. Push su GitHub via SSH funzionante. Build iOS 18 inviata ad App Store Connect. Resta sul progetto la function `prova-modello`, spenta (risponde 410): si può cancellare dalla dashboard. genera-piano ha ancora il file condiviso del 18 settembre.

---

### SNAPSHOT 2026-07-18 — LEGGI QUESTO SE TORNI DOPO UNA PAUSA

**Dove siamo:** l'MVP è **completo e funzionante end-to-end**. Tutti e 6 i punti
della lista MVP sono fatti, committati e verificati contro il Supabase reale.
Il codice non ha lavori a metà: il working tree è pulito.

#### FATTO

| Pezzo | Stato |
|---|---|
| Sprint 1 — auth email+password, onboarding 3 step (ateneo → foto orario → notifiche) | ✅ verificato E2E |
| Sprint 2 — tab Oggi / Orario / Scadenze con dati veri | ✅ |
| Sprint 3 — briefing mattutino (generazione + invio + preferenze ora) | ✅ codice pronto, **cron da schedulare** |
| Sprint 4 — Libretto (media ponderata, lodi, proiezione laurea, simulatore) + radar scadenze con template | ✅ |
| Sprint 5 — chat AI col contesto + cap free server-side + upsell "cap raggiunto" | ✅ |
| Rifiniture — prova E2E con account vergine, chat che guida il primo avvio | ✅ |

**Edge Functions deployate e testate in produzione:** `estrai-orario` (foto →
lezioni, Haiku vision + tool use), `genera-briefing` (cron notturno, ora anche
`suggerimento_oggi`), `invia-briefing` (invio push + modalità prova), `chat`
(contesto + cap 10/giorno), `genera-piano` (piano di studio a ritroso, cap 5/mese).
**Secrets già su Supabase:** `ANTHROPIC_API_KEY`, `CRON_SECRET`. Mai nel repo.

#### RESTA DA FARE (in ordine)

1. **Cron del briefing** — le funzioni ci sono ma NON sono schedulate: senza
   questo il briefing non parte da solo. Istruzioni pronte in `docs/cron-setup.md`.
2. **Dev build + push remoto** — da fare a fine agosto insieme all'account
   **Apple Developer (99$/anno, obbligatorio su iPhone** sia per la dev build sia
   per le push). Con un Android si prova gratis prima.
3. **Template scadenze con date reali** — i miei 8 sono segnaposto nazionali
   (marcati nella migration): vanno sostituiti con i bandi veri del tuo ateneo
   e della tua regione.
4. **Nome definitivo + icona** — serve per la submission.
5. **Ottimizzazione matricola** — vedi la sezione PRIORITÀ in `docs/backlog.md`:
   al lancio la maggior parte degli utenti avrà il libretto vuoto.

#### PROSSIMI 3 PASSI CONCRETI (in quest'ordine)

**1. Schedula il cron del briefing (30 min, sbloccante, si fa da browser)**
   Dashboard Supabase → Database → Extensions: abilita `pg_cron` e `pg_net`.
   Poi SQL Editor → incolla lo script di `docs/cron-setup.md` mettendo il
   CRON_SECRET (è nei secrets Supabase, non nel repo).
   Verifica: `select * from cron.job;` deve mostrare 2 job.

**2. Rileggi l'app sul telefono e fai il punto (15 min)**
   ```
   cd C:\Users\franc\assistente-studente
   npx expo start --tunnel
   ```
   Scansiona il QR con Expo Go. Serve `--tunnel`: la LAN diretta non passa.
   Guarda l'app da matricola: è il segmento del lancio.

**3. Attacca l'ottimizzazione matricola (il punto 5 sopra)**
   È la cosa che sposta di più il lancio di settembre. Il pezzo di prompt da
   toccare è la costante `SYSTEM` in `supabase/functions/chat/index.ts`:
   serve una regola di priorità ("se il libretto è vuoto, parla di lezioni,
   ISEE e tasse"), non nuove informazioni.
   Dopo averlo modificato:
   ```
   export SUPABASE_ACCESS_TOKEN=<il tuo personal access token sbp_...>
   npx supabase functions deploy chat --project-ref onjlwvzewzhuprssyftt --use-api
   ```

#### TRAPPOLE DELL'AMBIENTE (te le sei già scontrate una volta)

- **Node**: se `node` non si trova, usa un terminale nuovo (è in `C:\Program Files\nodejs`).
- **Comandi supabase**: lanciali **dalla cartella del progetto**, altrimenti non
  trova le migration ("Remote migration versions not found").
- **Deploy funzioni**: sempre con `--use-api` (Docker non è installato).
- **Expo SDK 54**: NON aggiornare — l'Expo Go degli store è fermo alla 54.
- **Expo Go**: sempre `--tunnel`.

