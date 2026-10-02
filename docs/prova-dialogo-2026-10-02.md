# Prova del dialogo di accoglienza — 2 ottobre 2026

Quattro conversazioni rigiocate lato server, un messaggio alla volta, con il modello `claude-sonnet-5-5` e la stessa logica che gira nella Edge Function `accoglienza-dialogo` (`logica.ts`). Le risposte del modello di queste stesse conversazioni sono registrate in `test/fixtures/dialoghi.json` e fanno da dati ai test automatici. Data di riferimento: 2026-10-02.

## 1. La conversazione reale (Tolc I)

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: devo ancora iniziare il corso, ho il Tolc I il 14 settembre
- **Bot** (3 frasi | prossima domanda: tempo_al_giorno): Il 14 settembre di quest'anno è già passato, quindi forse ti riferisci a un'altra data o a un altro appello: te lo chiedo senza fretta. Intanto, che tu non abbia ancora iniziato il corso vuol dire che si parte da zero e si può impostare bene fin dall'inizio. Quanto tempo riesci a dedicare allo studio ogni giorno?
- Studente: non so, sono abbastanza indietro con la matematica, sto facendo un percorso nel quale riprendo argomenti vecchi li ristudio e mi esercito, partendo dalle basi: monomi, polinomi, equazioni, prodotti notevoli, disequazioni, un aiuto mi sarebbe utile
- **Bot** (2 frasi | prossima domanda: fine | AIUTO): Ripartire dalle basi e rifare gli esercizi è esattamente il modo giusto per recuperare la matematica: con monomi, polinomi e prodotti notevoli ben solidi, equazioni e disequazioni diventano molto più facili. Partiamo da monomi e polinomi: ti preparo una serie di esercizi graduali e, quando sbagli, ti spiego il passaggio che non torna prima di passare ai prodotti notevoli.

Profilo salvato: `{"esame_target":{"testo":"ho il Tolc I il 14 settembre","nome":"Tolc I","id":null},"quando":{"testo":"il 14 settembre","data":null},"avanzamento":{"testo":"sono abbastanza indietro con la matematica, sto facendo un percorso nel quale riprendo argomenti vecchi li ristudio e mi esercito, partendo dalle basi","livello":null},"tempo_al_giorno":{"testo":null,"minuti":null},"ostacolo":"sono abbastanza indietro con la matematica","contesto":null}`

Chiavi chieste: esame_target, tempo_al_giorno  — in coda: tempo_al_giorno

## 2. Dice tutto nel primo messaggio

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: Devo dare Basi di Dati il 12 febbraio, sono più o meno a metà del programma. Studio un paio d'ore la sera perché di giorno lavoro in un bar, e il mio problema è che rimando sempre tutto all'ultima settimana.
- **Bot** (3 frasi | prossima domanda: fine): Lavorare al bar tutto il giorno e poi studiare due ore la sera non è poco, e il fatto che tu sia già a metà del programma conta. Rimandare tutto all'ultima settimana, poi, lo conosci bene: è una cosa che si può spezzare. Partiamo dalla seconda metà del programma di Basi di Dati, in piccoli pezzi per le tue sere, così l'ultima settimana resta solo per il ripasso.

Profilo salvato: `{"esame_target":{"testo":"Devo dare Basi di Dati","nome":"Basi di Dati","id":"00000000-0000-4000-8000-000000000004"},"quando":{"testo":"il 12 febbraio","data":"2027-02-12"},"avanzamento":{"testo":"sono più o meno a metà del programma","livello":"a_meta"},"tempo_al_giorno":{"testo":"Studio un paio d'ore la sera","minuti":120},"ostacolo":"rimando sempre tutto all'ultima settimana","contesto":"di giorno lavoro in un bar"}`

Chiavi chieste: esame_target  — in coda: niente

## 3. Risponde a monosillabi

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: fisica
- **Bot** (2 frasi | prossima domanda: quando): Fisica Generale I, allora: è un esame che di solito si regge su pochi concetti ben chiari e tanti esercizi. Per quando devi darlo?
- Studente: boh
- **Bot** (2 frasi | prossima domanda: avanzamento): Va bene, la data non è chiara e non c'è fretta di fissarla adesso: si sistema più avanti. Intanto, con Fisica a che punto sei: hai già iniziato a studiare o devi ancora partire?
- Studente: poco
- **Bot** (3 frasi | prossima domanda: tempo_al_giorno): Poco vuol dire che qualcosa hai già visto, e per Fisica partire da lì è meglio che partire da zero. Si ricomincia dai concetti che ti sono rimasti. Quanto tempo riesci a dedicare allo studio ogni giorno, più o meno?
- Studente: mah
- **Bot** (2 frasi | prossima domanda: ostacolo): Va bene, anche non saperlo è una risposta: il tempo che hai si vede meglio studiando che immaginandolo. Quando ti metti a studiare Fisica, cos'è che ti fa inceppare di più?
- Studente: no
- **Bot** (3 frasi | prossima domanda: fine): Va bene, un no secco è una risposta come un'altra e non ti rincorro. Le domande le abbiamo finite qui: il resto lo vediamo studiando. Partiamo da Fisica Generale I: riprendiamo i concetti che ti sono rimasti e da lì costruiamo il resto.

Profilo salvato: `{"esame_target":{"testo":"fisica","nome":"Fisica Generale I","id":"00000000-0000-4000-8000-000000000002"},"quando":{"testo":null,"data":null},"avanzamento":{"testo":"poco","livello":null},"tempo_al_giorno":{"testo":null,"minuti":null},"ostacolo":null,"contesto":null}`

Chiavi chieste: esame_target, quando, avanzamento, tempo_al_giorno, ostacolo  — in coda: quando, tempo_al_giorno, ostacolo

## 4. Va completamente fuori tema

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: ma tu sei tipo chatgpt?
- **Bot** (2 frasi | prossima domanda: tempo_al_giorno): Sono Lode, un assistente di studio basato su un modello di intelligenza artificiale, quindi di famiglia ci siamo, ma qui il mio lavoro è aiutarti a preparare i tuoi esami, non a chiacchierare di tutto. Quanto tempo riesci a dedicare allo studio in una giornata normale?
- Studente: quanto costa questa app?
- **Bot** (2 frasi | prossima domanda: ostacolo): Sul prezzo non ho informazioni certe e non voglio dirti una cifra a caso, quindi meglio controllare i dettagli direttamente nell'app o sul sito. Cosa va storto di solito quando ti metti a studiare?
- Studente: che tempo fa domani a Bari?
- **Bot** (3 frasi | prossima domanda: fine): Del meteo di domani a Bari non so dirti nulla, non ho modo di controllarlo da qui. Per tre domande di fila hai evitato il discorso studio, nessun problema, ma non posso aiutarti senza partire da qualcosa. Quando vuoi, dimmi quale esame hai davanti e partiamo da lì.

Profilo salvato: `{"esame_target":{"testo":null,"nome":null,"id":null},"quando":{"testo":null,"data":null},"avanzamento":{"testo":null,"livello":null},"tempo_al_giorno":{"testo":null,"minuti":null},"ostacolo":null,"contesto":null}`

Chiavi chieste: esame_target, tempo_al_giorno, ostacolo  — in coda: esame_target, quando, avanzamento, tempo_al_giorno, ostacolo
