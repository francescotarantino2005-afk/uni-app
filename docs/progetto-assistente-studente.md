# Progetto: l'assistente AI dello studente universitario italiano

**Documento di progetto dettagliato v1 — 8 luglio 2026**
Founder: Francesco · Budget: 1.000–2.000 € · Lancio target: settembre 2026 (immatricolazioni)

---

## 1. La tesi

I giganti (Gemini Personal Intelligence, nuova Siri, ChatGPT+Operator) stanno costruendo l'assistente personale di *tutti*. Nessuno di loro costruirà mai l'assistente che sa cos'è l'ISEE, quando scade la seconda rata della tua università, come si prepara un esame da 12 CFU e che giovedì hai lezione nell'aula T4. **La profondità verticale è l'unico terreno dove un solo sviluppatore batte Google** — e lo studente universitario italiano è la verticale perfetta per te: sei tu, la raggiungi su TikTok, e si rinnova ogni settembre con 300.000+ matricole.

### Perché ora
- Il mercato conferma la domanda ma è servito male: **Uniwhere** (l'app che collega libretto/esami/tasse di 40+ atenei) ha 100.000+ download ma **3,5 stelle**, recensioni che lamentano sincronizzazioni rotte e dati obsoleti, **zero AI**, e vive di pubblicità. C'è un incumbent debole che ha già educato il mercato.
- Le alternative sono planner generici (Notion, calendari) che lo studente deve compilare e mantenere da solo — l'esatto contrario di un assistente.
- I generalisti AI non hanno il contesto: né l'orario del tuo corso, né le scadenze del tuo ateneo, né il tuo libretto.

### Posizionamento in una frase
> "L'assistente che uno studente universitario italiano dovrebbe avere di default: ti sveglia sapendo che giornata hai, ti segue nello studio, non ti fa perdere una scadenza, e la sera ha già pronto il piano di domani."

---

## 2. L'utente e la sua giornata (i momenti da possedere)

Persona primaria: **matricola e studente fuorisede, 19-24 anni**. Vive di gruppi WhatsApp del corso, scopre le scadenze dall'amico che le ha scoperte per caso, studia a raffiche disorganizzate, e ogni settembre affronta ISEE/tasse/borse senza che nessuno gli abbia mai spiegato nulla.

La giornata che l'app vuole possedere:

| Momento | Oggi | Con l'assistente |
|---|---|---|
| 7:30 sveglia | Scrolla TikTok, ricorda a metà mattina che aveva lezione | **Briefing del mattino**: "Oggi: Analisi h10 aula T4, gruppo studio h15. Venerdì scade la rata (230€). All'esame di Fisica mancano 9 giorni: oggi tocca il capitolo 4." |
| Mattina | Lezione (forse) | Orario sempre in tasca, avvisi spostamenti aula |
| Pomeriggio | "Dovrei studiare" → 40 min di telefono | **Sessione di studio guidata**: timer, obiettivo del giorno calcolato sul piano d'esame, modalità focus |
| Sera | Ansia vaga sulle cose da fare | **Chiusura**: cosa hai fatto, piano di domani, streak |
| Scadenze (ISEE, tasse, borse, affitto) | Le scopre in ritardo o mai | Radar scadenze con spiegazioni semplici: cosa, quando, come, con quali documenti |
| Sessione d'esame | Panico e all-nighter | Piano di preparazione a ritroso dalla data d'esame, ripasso attivo con l'AI sui propri appunti |

Il principio di design: **proattivo, non reattivo**. La differenza tra questo e ChatGPT non è l'intelligenza — è che questo ti scrive lui, al momento giusto, sapendo chi sei.

---

## 3. Concorrenza (verificata)

| Player | Cosa fa | Debolezza |
|---|---|---|
| **Uniwhere** (100k+ download) | Libretto, esami, tasse via portali atenei | 3,5 stelle, sync rotta, zero AI, zero proattività, ad-supported |
| **MyLibretto** e simili | Libretto manuale, medie | Solo calcolatrice voti, nessun assistente |
| App ufficiali di ateneo | Orari, ESSE3 | Qualità mediamente pessima, una per ateneo, zero intelligenza |
| Notion/planner/calendari | Tutto, in teoria | Devi costruirlo e mantenerlo tu: è lavoro, non assistenza |
| Gemini/ChatGPT/Siri | Assistente generale | Nessun contesto universitario italiano, nessun radar scadenze locali |
| Study app (Forest, Flora...) | Solo focus timer | Un pezzo isolato della giornata |

**Il buco**: nessuno unisce contesto accademico + AI + proattività. Uniwhere ha i dati ma non l'intelligenza; ChatGPT ha l'intelligenza ma non i dati; i planner hanno la struttura ma richiedono disciplina che lo studente non ha.

---

## 4. Il prodotto: architettura a loop

Il cuore è il **profilo persistente** (il "cervello"): orario, piano di studi, esami prenotati, scadenze, abitudini, obiettivi. Ogni loop lo legge e lo arricchisce. La personalizzazione che chiedevi ("si adatta completamente all'utente") non è magia: è memoria strutturata + AI che la usa.

**Loop 1 — Il briefing del mattino** *(il cuore dell'MVP)*
Notifica push alle 7:30 (orario personalizzabile) generata ogni notte: la giornata, le scadenze in avvicinamento, il compito di studio del giorno. Costo tecnico basso (1 generazione batch/utente/giorno), valore altissimo, crea l'abitudine quotidiana. È il "buongiorno" del tuo JARVIS.

**Loop 2 — Il radar scadenze**
Al setup l'utente indica ateneo, regione, situazione (fuorisede? borsista?) → l'app carica il calendario di scadenze rilevanti da una **base dati curata da noi** (ISEE, DSU/borse regionali, rate tipiche, immatricolazioni) + scadenze personali fotografate/inserite (affitto, abbonamento trasporti). Ogni scadenza ha la spiegazione in italiano semplice: cosa fare, dove, con quali documenti. *Questa base dati curata è un asset difensivo: più cresce, più è difficile da copiare.*

**Loop 3 — Il compagno di studio**
Piano di preparazione a ritroso dalla data d'esame ("18 capitoli, 21 giorni → ecco il calendario"), sessioni focus con timer, e ripasso attivo: carichi gli appunti/slide e l'AI ti interroga (quiz, domande aperte, spiegazioni). Qui rientra tutta l'idea "studio insieme" — nella fase 2 le sessioni diventano condivisibili con i compagni di corso (il pezzo social sano: funziona già in due).

**Loop 4 — La buonanotte**
Recap serale + piano di domani + streak. Chiude il cerchio dell'abitudine: chi riceve il briefing del mattino E la chiusura della sera apre l'app 2+ volte al giorno per design.

**Chat sempre disponibile** con il contesto del profilo: "quanto mi manca alla laurea?", "se prendo 24 che media ho?", "cosa serve per l'ISEE?" — risposte sulla TUA situazione, non generiche.

---

## 5. MVP (v1, lancio settembre)

**Dentro:**
1. Onboarding in 5 minuti: **foto/screenshot dell'orario → l'AI lo estrae e lo struttura** (niente integrazioni fragili coi portali al day 1 — è la lezione di Uniwhere: le loro 3,5 stelle vengono da lì), ateneo/regione/profilo → scadenze precaricate
2. Briefing mattutino push + recap serale
3. Radar scadenze con spiegazioni (base dati curata: partiamo con le 20-30 scadenze che coprono l'80% degli studenti: ISEE/DSU, rate, borse regionali principali, immatricolazioni)
4. Piano esame a ritroso + timer focus
5. Chat con contesto del profilo
6. Libretto manuale semplice (voti, media, simulatore — costa poco, lo cercano tutti)

**Fuori (fase 2, da dicembre):** integrazione portali atenei (opt-in, con aspettative gestite), ripasso AI sugli appunti caricati, sessioni di studio condivise coi compagni, modulo ISEE guidato completo, widget home screen.

---

## 6. Architettura tecnica (con Claude Code)

- **App nativa con Expo (React Native)** — qui serve nativa, non PWA: le notifiche push affidabili SONO il prodotto. Un solo codebase iOS+Android.
- **Backend**: Supabase (auth, Postgres, storage) + edge functions per i job notturni (generazione briefing batch)
- **AI**: Claude API — vision per l'estrazione orari/documenti, testo per briefing/chat/piani di studio
- **Gestione costi AI (decisione di design critica)**: il briefing è 1 chiamata batch/utente/giorno (centesimi); la chat free ha un cap giornaliero; il ripasso AI sugli appunti è solo premium. Obiettivo: costo per utente free < 0,50€/mese.
- **Store**: Apple review richiede tempo → submission entro fine agosto. Nel frattempo beta via TestFlight.
- **Costi totali stimati**: 25€/anno Google Play + 99€/anno Apple + ~30-60€/mese infra+API in beta. Il budget resta quasi tutto per il lancio.

---

## 7. Monetizzazione (aggiornata — sequenza a fasi)

**Fase 1 — Lancio (settembre): tutto gratis, zero ads, zero paywall.**
Free: briefing, orario, radar scadenze, libretto, chat con cap giornaliero. Obiettivo unico: abitudine quotidiana + passaparola nei gruppi di corso. Ingressi a ondate (lista d'attesa/codici invito): controllo dei costi API e hype da prodotto esclusivo.
La schermata del cap chat è un upsell: "Plus in arrivo" + bottone **"Avvisami quando esce"** (ogni tap = pre-vendita misurata) + referral "invita un compagno → +5 messaggi/giorno". Il rapporto cap-raggiunti/avvisami dimensiona conversione e prezzo PRIMA di lanciare il premium.

**Fase 2 — Premium "Plus" (ottobre-novembre): 6,99€/mese o 39,99€/anno.**
Benchmark di mercato: Quizlet Plus 6,99$/mese, Mindgrasp 5,99$, StudySesh 7,99$, StudyFetch fino a 19$/mese — e nessuno è integrato in un assistente che conosce orario ed esami. Offerta founding: 29,99€ il primo anno per i primi 1.000. L'annuale va spinto (si compra a settembre/ottobre, copre l'anno accademico, azzera il churn di novembre).
Include: chat illimitata · **kit di studio da PDF/appunti** (riassunti per capitolo, flashcard, domande d'esame simulate con correzione — 3 kit/mese inclusi, extra 1,99€: il modello a quota copre sempre i costi API) · piani multi-esame illimitati · correzione tesine/relazioni · statistiche studio.
Si attiva SOLO sopra ~1.500-2.000 utenti attivi. A quel punto, con 4% di conversione su 39,99€: il commercialista è coperto 6 volte prima di iniziare.
Rilasci successivi (nov-dic, uno al mese = retention + contenuti): **registrazione lezione → appunti automatici** (trascrizione + punti chiave, ~50-70 cent/2h di costi, quota mensile) e **orale simulato a voce** (l'AI ti interroga come un prof — la feature che in Italia nessuno ha e che su TikTok si vende da sola).
Nota copyright kit: i materiali caricati restano privati dell'utente; MAI redistribuzione di riassunti/kit tra utenti.

**Fase 3 — Ads (2027, solo con migliaia di DAU): terzo strato, mai il primo.**
Matematica: banner in Italia ~0,5-1,5€ CPM → 10k installi ≈ 300-800€/mese. Le ads non possono finanziare le feature AI (l'utente pesante costa in API più di quanto rende in impression). Regole ferree: mai nel briefing, mai in chat, mai durante il focus; solo banner nativi in schermate fredde (libretto, scadenze). Il premium include la rimozione — ma la rimozione ads NON è il valore del premium (quello sono le funzioni di studio), solo un beneficio in più.

**Proiezione aggiornata**: 10.000 utenti free, conversione 4-5% su 39,99€/anno ≈ 16-20.000€/anno, più kit extra e, a tendere, B2B (atenei, CAF, editori universitari — la strada indicata da Uniwhere con la sezione Carriera).

**Fiscale**: niente P.IVA finché tutto è gratuito (fase 1 a costo fiscale zero). Forfettario da aprire PRIMA di attivare gli abbonamenti — consulenza commercialista a settembre/ottobre, ~300-500€/anno, coperti dal premium stesso. [Verifica con un professionista.]

---

## 8. Distribuzione (il tuo campo)

1. **Studytok/UniTok da luglio**: il canale si costruisce PRIMA dell'app. Format: "le scadenze che le matricole sbagliano sempre", "quanto costa davvero essere fuorisede", "il metodo per pianificare un esame da 12 CFU" — con Higgsfield produci a volume. L'app al lancio eredita il pubblico.
2. **I gruppi WhatsApp/Telegram di corso**: ogni matricola a settembre entra in 4-5 gruppi. Un utente convinto per gruppo = distribuzione capillare gratis. Feature progettata apposta: "condividi il piano d'esame/l'orario col gruppo".
3. **Ambassador**: 20 studenti beta ad agosto (uno per grande ateneo), accesso premium gratis a vita in cambio di feedback e condivisione.
4. **Timing**: submission store fine agosto → lancio 8-15 settembre, il momento esatto in cui 300.000 matricole cercano di capire come funziona l'università.

---

## 9. Validazione (prima del codice — 10-20 luglio)

- **15 interviste** a studenti (5 matricole potenziali, 5 fuorisede, 5 in corso): "qual è stata l'ultima scadenza che hai perso o quasi? come ti organizzi la settimana? cosa usi oggi?"
- **Landing** con la promessa e lista d'attesa
- **3 video TikTok di test** sul dolore (non sull'app): scadenze, ISEE, organizzazione
- **Soglie**: 150+ iscritti in lista d'attesa O un video >50k views O 10/15 interviste che confermano il dolore "scadenze+organizzazione" → si costruisce. Sotto: si ripensa il perimetro prima di scrivere codice.

---

## 10. Roadmap

| Quando | Cosa |
|---|---|
| 10–20 lug | Validazione (interviste, landing, video). Scelta nome + dominio |
| 21 lug–20 ago | Build MVP con Claude Code. Canale TikTok attivo 4-5 video/settimana |
| 10–25 ago | Beta TestFlight con 20 ambassador. Base dati scadenze completata per le 10 regioni principali |
| 25–31 ago | Submission store. Fix da beta |
| 8–15 set | **Lancio** con push contenuti sul picco immatricolazioni |
| ott–nov | Iterazione su retention (i dati diranno quale loop tiene) |
| dic–gen | Fase 2: ripasso AI, sessione d'esame invernale come secondo picco, studio condiviso |

---

## 11. Rischi, senza sconti

1. **Retention post-novembre**: l'entusiasmo di settembre cala; mitigazione: la sessione di gennaio è il secondo aggancio naturale, e il briefing quotidiano è progettato proprio per creare abitudine prima del calo.
2. **Costi AI con utenti free**: il caso peggiore è limitato per costruzione — cap chat server-side, routing modelli (piccolo per chat/briefing, grande solo premium), spend limit hard su console Anthropic con degrado grazioso ("torna domani"), skip briefing per inattivi 14+ giorni, rate limiting anti-abuso, ingressi a ondate. Utente free worst-case ≈ 0,30-0,50€/mese; 1.000 utenti attivissimi = 300-500€/mese come tetto fisico, e il rubinetto della waitlist lo controlli tu.
3. **La base dati scadenze richiede cura manuale**: borse e bandi cambiano per regione e anno. All'inizio è lavoro tuo (2-3 ore/settimana); a regime è il fossato.
4. **Il nome**: "JARVIS" è Marvel/Disney, non si può usare. Serve un nome italiano, corto, da gruppo WhatsApp ("scaricati ___"). Rosa da valutare insieme (con verifica marchio prima di stampare qualsiasi cosa).
5. **Apple review e tempi store**: submission tardiva = lancio perso; per questo è in roadmap al 25 agosto, non al 5 settembre.
6. **GDPR**: dati di studenti (orari, situazione economica per l'ISEE) = privacy policy seria, minimizzazione dati, cifratura. Da fare bene dal giorno uno.
7. **Scope creep**: "assistente completo" è la visione, non l'MVP. Ogni feature fuori dalla lista MVP va in backlog, senza eccezioni — o settembre salta.

---

## 12. Perché questa e non le altre (il senso del percorso fatto)

In questa conversazione hai gravitato tre volte sullo stesso posto senza saperlo: lo studio insieme, la burocrazia degli studenti, l'assistente personale quotidiano. Questa app è l'unione dei tre — il JARVIS verticale di una nicchia che conosci dall'interno, che si rinnova ogni anno, che i giganti non serviranno mai in profondità, con una distribuzione che sai già fare e un timing (settembre) che ricorre ogni anno. È il progetto "passo passo" che avevi chiesto: la visione è grande, il primo mattone (il briefing del mattino) è piccolo e costruibile in agosto.

---

## Fonti

- Uniwhere (Google Play — 100k+, 3,5 stelle, funzionalità): https://play.google.com/store/apps/details?id=lu.gian.uniwhere
- MyLibretto: https://apps.apple.com/it/app/mylibretto-universit%C3%A0/id914172791
- Stato assistenti AI 2026 (Gemini Personal Intelligence, Siri, ChatGPT/Operator): https://www.arahi.ai/ai-agent-news/ai-assistant-news-updates-2026
- Dati uso AI (HBR: "organize my life" #2; Anthropic Economic Index): https://www.forbes.com/sites/lanceeliot/2025/05/14/top-ten-uses-of-ai-puts-therapy-and-companionship-at-the-1-spot/ · https://www.anthropic.com/research/economic-index-june-2026-report
