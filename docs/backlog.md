# Backlog — idee fuori dallo sprint corrente

La lista MVP è chiusa (vedi CLAUDE.md). Tutto ciò che è fuori scope finisce qui,
non nel codice.

## PRIORITÀ — Esperienza matricola / libretto vuoto (segmento del lancio)

**Perché conta.** Al lancio di settembre la maggior parte degli utenti saranno
matricole appena immatricolate, con il libretto a zero esami (il fondatore stesso
è in questa situazione). Prendere lo studente da matricola significa retention
lunghissima e lock-in: il libretto cresce dentro l'app negli anni.

**Il problema.** Oggi l'app dà il meglio a chi ha già dati — media, proiezione
laurea, simulatore, briefing pieno. Per una matricola quelle schermate sono vuote
proprio nel momento in cui deve decidere se l'app le serve.

Da curare:

- **Libretto a 0 esami** — stati vuoti incoraggianti, non "spenti". Oggi dicono
  solo "aggiungi il primo esame"; per chi non ne ha ancora sostenuto nessuno
  dovrebbero raccontare cosa arriverà (media, proiezione di laurea, simulatore),
  invece di sembrare una schermata rotta.
- **Chat utile SENZA voti** — a "come sto messo?" deve rispondere parlando di
  lezioni della settimana, ISEE, tasse e scadenze di immatricolazione, invece di
  ripiegare su "non hai esami".
  *Parzialmente affrontato il 2026-07-18*: la chat non è più un vicolo cieco e
  indirizza alla sezione giusta ("aggiungi i tuoi esami dalla tab Libretto"), ma
  resta centrata sul libretto. **Il pivot vero — spostare il discorso su orario e
  scadenze quando i voti mancano — è ancora da fare.**
- **Onboarding** — valorizzare orario + scadenze quando i voti non ci sono ancora:
  è lì che una matricola trova valore nei primi minuti.

Non è un task dello sprint corrente: da affrontare **prima del lancio di settembre**.

## Fase 2 (già decisa, non anticipare)
- Kit di studio da PDF
- Registrazione lezioni → appunti automatici
- Orale simulato a voce
- Paywall / RevenueCat
- Integrazione portali atenei
- Studio condiviso

## Idee emerse durante lo sviluppo
<!-- aggiungi qui, una riga per idea, con data -->

- **2026-08-01 — Agente preparazione esami**: prompt specializzati per disciplina
  + i materiali del corso come contesto (NON un agente separato per materia).
  Vincoli: il costo di riassumere materiale lungo è alto, quindi va **dietro
  abbonamento dal giorno uno** — incompatibile col cap attuale (~10$/mese), il
  modello va **riprezzato**. Lavora **solo** sui materiali dello studente (appunti,
  foto delle sue pagine, slide): **mai** distribuzione di contenuto di editori.
  Anticipato in-app nella schermata "In arrivo" (solo testo, nessuna logica).
- **2026-08-01 — ISBN → metadati manuale**: lookup di titolo/edizione/indice dei
  capitoli (Google Books API o simili). I capitoli diventano le **unità del piano
  di studio esistente** (`lib/pianoStudio.ts`). **Nessun download** di contenuto
  del libro: **solo metadati**. È il primo pezzo propedeutico all'agente di
  preparazione esami qui sopra.
