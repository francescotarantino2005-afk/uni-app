# Scheda metadati — App Store Connect

App: **Lode** (bundle `it.francescotarantino.uniapp`) · versione 1.0.0 · beta
Lingua principale: Italiano

> Ogni affermazione della descrizione è ancorata al codice: vedi la sezione
> "Riscontro nel codice" in fondo. Niente funzioni inventate.

---

## Nome dell'app (≤ 30 caratteri)
`Lode – Assistente Studente`
(26 caratteri)

## Sottotitolo (≤ 30 caratteri)
`Orario, esami, scadenze e AI`
(28 caratteri)

## Testo promozionale (≤ 170 caratteri)
`La tua vita universitaria in un posto solo: lezioni, scadenze, libretto e un piano di studio che ogni mattina ti dice cosa fare oggi. Meno ansia, più metodo.`
(155 caratteri)

## Descrizione (≤ 4000 caratteri)

Lode è l'assistente pensato per chi studia all'università in Italia. Mette in ordine la tua vita accademica — lezioni, scadenze, esami, studio — e ogni mattina ti dice da dove partire, così non devi tenere tutto a mente.

Ogni giorno apri l'app e trovi la tua giornata già pronta: le lezioni di oggi, le scadenze più vicine e un suggerimento concreto su cosa conviene fare adesso. È il modo più veloce per sapere a colpo d'occhio come stai messo, senza rincorrere fogli, chat di gruppo e promemoria sparsi.

Il tuo orario lo aggiungi in un attimo: scatta una foto dell'orario delle lezioni e Lode lo legge per te, riconosce materie, giorni e aule e li trasforma in un calendario ordinato. Puoi sempre correggere e sistemare a mano prima di salvare.

Le scadenze che le matricole sbagliano sempre — ISEE, tasse, borse di studio, iscrizioni — non le perdi più. Aggiungi le tue e attingi a una raccolta di scadenze tipiche già pronte, con una breve spiegazione di cosa sono, così sai sempre cosa ti aspetta e perché conta.

Il libretto tiene il conto per te: registri gli esami sostenuti con voto e crediti e Lode calcola la media ponderata, i CFU acquisiti, le lodi e una proiezione indicativa del voto di laurea. Con il simulatore provi gli scenari prima di dare un esame: "che media avrò se prendo 27?" oppure "che voto mi serve per arrivare al 100?".

Quando hai un esame in vista, Lode ti costruisce un piano di studio su misura: parte dalla data dell'esame e torna indietro, distribuendo lo studio solo nelle ore che hai davvero libere, evitando le tue lezioni e alleggerendo nei giorni di scadenza. Poi ti guida sessione per sessione, con un timer per restare concentrato: segni se hai fatto, fatto a metà o saltato, e il piano si aggiorna da solo per stare al passo.

C'è anche un assistente basato su intelligenza artificiale con cui puoi parlare: conosce il contesto del tuo profilo — corso, orario, esami, scadenze — e risponde alle tue domande sullo studio e sull'organizzazione, indirizzandoti alla sezione giusta dell'app quando serve.

Lode è un progetto indipendente, curato da una persona sola: niente pubblicità, niente rivendita dei tuoi dati, e ogni dato di studio resta tuo e visibile solo a te. L'app è distribuita in versione di prova e cresce ogni settimana: le priorità le decidono gli studenti che la usano.

(circa 2.300 caratteri)

## Parole chiave (≤ 100 caratteri, separate da virgola)
`università,libretto,media,voti,cfu,laurea,studio,ripasso,piano,ISEE,tasse,borsa,ateneo,matricola`
(96 caratteri — niente spazi per non sprecarli; evitate le parole già presenti in nome e sottotitolo, che Apple indicizza da sé)

## Categoria
- **Primaria: Istruzione (Education)** — il cuore dell'app è organizzare e sostenere il percorso di studio universitario (libretto, orario, piani di studio, ripasso).
- **Secondaria: Produttività (Productivity)** — gestione di scadenze, calendario delle lezioni, briefing giornaliero e pianificazione del tempo.

## Fascia d'età
**4+** — nessun contenuto sensibile. L'assistente AI è vincolato al contesto di studio (non è navigazione web libera). Il servizio non è rivolto a minori di 14 anni per motivi di consenso al trattamento dati (vedi privacy policy), ma non presenta contenuti che richiedano una fascia superiore.

## Novità di questa versione (1.0.0)
`Prima versione pubblica di Lode, in beta. Include orario con lettura da foto, radar scadenze con scadenze tipiche già pronte, libretto con media ponderata e simulatore, piano di studio a ritroso con sessioni guidate, briefing del mattino e assistente AI. L'app viene aggiornata di continuo: i tuoi riscontri decidono le prossime funzioni.`

## Descrizione beta (TestFlight)
`Lode è l'assistente per studenti universitari italiani: orario, scadenze, libretto con media, piani di studio e un briefing che ogni mattina ti dice cosa fare oggi. Questa è una beta: alcune funzioni sono in evoluzione e il tuo feedback conta davvero. Segnala problemi e idee a francescotarantino2005@gmail.com.`

## Cosa testare (istruzioni per i beta tester)
1. Registrati e completa l'onboarding (scegli ateneo → puoi saltare la foto → notifiche).
2. Orario: aggiungi una lezione a mano e, se vuoi, prova a importare l'orario da una foto.
3. Libretto: aggiungi alcuni esami, qualcuno con voto e qualcuno "da sostenere"; controlla media, CFU e proiezione. Prova il simulatore.
4. Scadenze: aggiungi una scadenza tua e una dalla raccolta di scadenze tipiche.
5. Piano di studio: crea un piano per un esame con una data futura, apri una sessione e prova il timer con i tasti Fatto / A metà / Saltata.
6. Home: controlla il briefing e la card "Oggi" con il suggerimento.
7. Chat: fai una domanda all'assistente e verifica che tenga conto dei tuoi dati.
Segnala qualsiasi cosa non torni, anche piccola.

## Note per il revisore Apple
- **Account demo** (già popolato con profilo, esami, scadenze e un piano di studio):
  - Email: (vedi credenziali fornite separatamente nel campo "Sign-in required")
  - Password: (idem)
- L'app richiede la creazione di un account (email + password) per salvare i dati dell'utente; la conferma email è disattivata in fase di beta, quindi l'accesso è immediato.
- **Fotocamera / libreria foto**: usate solo su azione esplicita dell'utente per fotografare l'orario delle lezioni; l'immagine viene inviata per il riconoscimento del testo e non viene archiviata sui nostri server (vedi privacy). Il microfono non è usato ed è bloccato.
- **Intelligenza artificiale**: alcune funzioni (assistente, lettura orario, piano di studio, briefing) usano il modello di Anthropic tramite i nostri server; la chiave API non è mai nell'app.
- **Notifiche**: usate per il briefing del mattino, opzionali.
- Nessuna pubblicità, nessun acquisto in-app in questa versione, nessuna rivendita di dati.
- Support URL: https://francescotarantino2005-afk.github.io/lode-legal/supporto.html
- Privacy URL: https://francescotarantino2005-afk.github.io/lode-legal/

---

## Riscontro nel codice (ogni affermazione → dove sta)

| Affermazione nella scheda | File nel codice |
|---|---|
| Onboarding: ateneo → foto orario → notifiche | `app/onboarding/ateneo.tsx`, `app/onboarding/foto-orario.tsx`, `app/onboarding/notifiche.tsx` |
| Home "oggi": lezioni del giorno + prossime scadenze + card suggerimento | `app/(tabs)/oggi.tsx` |
| Briefing del mattino (generato + inviato via notifica) + suggerimento_oggi | `supabase/functions/genera-briefing/index.ts`, `supabase/functions/invia-briefing/index.ts`, `supabase/functions/_shared/briefing.ts`, `app/preferenze.tsx` |
| Orario da foto (riconoscimento AI di materie/giorni/aule) | `components/SelettoreFotoOrario.tsx`, `lib/estrazioneOrario.ts`, `supabase/functions/estrai-orario/index.ts` |
| Correzione manuale prima di salvare l'orario | `app/anteprima-orario.tsx` |
| Orario come calendario per giorno | `app/(tabs)/orario.tsx`, `lib/orarioDb.ts` |
| Scadenze personali + raccolta di scadenze tipiche (ISEE, tasse, borse, iscrizioni) con spiegazione | `app/(tabs)/scadenze.tsx`, `app/template-scadenze.tsx`, `lib/templateDb.ts`, migrazione `supabase/migrations/20260716120000_template_scadenze.sql` |
| Libretto: media ponderata sui CFU, CFU acquisiti, lodi, proiezione laurea | `app/(tabs)/libretto.tsx`, `lib/libretto.ts`, `lib/esamiDb.ts` |
| Simulatore ("che media avrò" / "che voto serve") | `app/simulatore.tsx` |
| Piano di studio a ritroso dalla data esame, solo nelle ore libere, evita lezioni, alleggerisce sulle scadenze | `supabase/functions/genera-piano/index.ts` |
| Sessioni guidate con timer + Fatto/A metà/Saltata + ricalcolo automatico | `app/sessione.tsx`, `app/piano.tsx`, `lib/pianoStudio.ts` |
| Assistente AI con contesto del profilo, indirizza alla sezione giusta | `app/(tabs)/chat.tsx`, `supabase/functions/chat/index.ts` |
| Ogni dato visibile solo al proprietario (RLS "own data") | `supabase/migrations/20260711090000_schema_iniziale.sql` (policy "own data") |
| Chiave API AI mai nel client | `lib/supabase.ts` (solo publishable key), Edge Functions per le chiamate AI |
| Niente pubblicità / niente rivendita dati / niente crash reporting esterno | assenza di dipendenze ads/analytics/crash in `package.json` |
| Foto non archiviate su server | `supabase/functions/estrai-orario/index.ts` (solo invio ad Anthropic + contatore `usage_estrazioni`, nessun bucket/insert dell'immagine) |
| Beta / aggiornamenti continui | `components/BadgeBeta.tsx`, `app/in-arrivo.tsx` |
