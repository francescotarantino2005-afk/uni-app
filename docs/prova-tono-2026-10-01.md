# Prova del tono — accoglienza-dialogo (1 ottobre 2026)

Quindici dialoghi completi contro la funzione pubblicata (versione definitiva, modello claude-haiku-4-5), con un profilo finto: media 25,40, 87 CFU, esami in elenco Analisi Matematica II, Fisica Generale I, Programmazione II, Basi di Dati, Prova Finale. La risposta in prova è segnata con **(caso)**; le altre sono risposte predefinite. Apertura fissa: "Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?"

## Caso 1 — domanda 1: "analisi 2"

- D1 **(caso)** — studente: analisi 2
  - **Bot** (2 frasi): Analisi Matematica II, chiaro. Quando hai intenzione di darlo?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Hai una data in mente. A che punto sei con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora parecchio da coprire da qui a gennaio. Quanto tempo riesci di solito a dedicare allo studio in una giornata?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza ogni sera è una base solida da cui partire. C'è qualcosa che di solito ti blocca quando studi?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è una trappola classica, soprattutto quando lo studio è concentrato tutto in serata. Abbiamo tutto quello che serve per aiutarti a prepararti ad Analisi Matematica II.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimanda sempre"}`

In coda: niente — note_libere: 5

## Caso 2 — domanda 1: "Fisica Generale I"

- D1 **(caso)** — studente: Fisica Generale I
  - **Bot** (2 frasi): Partiamo da lì. Quando intendi dare Fisica Generale I?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Il 20 gennaio è il tuo obiettivo. A che punto sei con la preparazione di Fisica Generale I?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora parecchio da coprire prima di gennaio. Quanto tempo riesci a dedicare allo studio in una giornata?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza è un buon ritmo da mantenere. Quando studi, che cosa ti blocca di solito?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è una classica. Abbiamo tutto quello che serve per aiutarti con Fisica Generale I.

Profilo salvato: `{"esame_target":{"nome":"Fisica Generale I","id":"00000000-0000-4000-8000-000000000002"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimandare sempre"}`

In coda: niente — note_libere: 5

## Caso 3 — domanda 1: "boh"

- D1 **(caso)** — studente: boh
  - **Bot** (2 frasi, non-risposta): Allora andiamo con calma. Quando lo devi dare, anche a grandi linee?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Hai una scadenza ben definita. A che punto sei con la preparazione?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora buona parte del programma davanti. Quanto tempo riesci a dedicare allo studio in una giornata?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza è un buon ritmo da tenere costante. Cosa ti blocca di solito quando cerchi di studiare?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): È il nemico numero uno di chi studia. Adesso ho quello che mi serve per aiutarti con la preparazione verso il 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":null,"id":null},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimando"}`

In coda: esame_target:da_fare — note_libere: 5

## Caso 4 — domanda 1: "quello di matematica"

- D1 **(caso)** — studente: quello di matematica
  - **Bot** (1 frasi, chiarimento): Intendi Analisi Matematica II?
- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Partiamo da lì. Quando pensi di darlo?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Gennaio è ragionevole, hai già qualcosa in mente su come organizzarti. A che punto sei adesso con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora la seconda metà da coprire prima di gennaio. Quanto tempo riesci di solito a dedicare allo studio in un giorno?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Novanta minuti ogni giorno sono un buon ritmo per riuscire a finire in tempo. Cosa ti blocca di solito quando studi?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Il classico, insomma. Allora, ho quello che mi serve: con novanta minuti al giorno e la spinta a combattere il rimandare, dovresti avere una chance seria con Analisi Matematica II entro il 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimando sempre"}`

In coda: niente — note_libere: 6

## Caso 5 — domanda 1: ""

- D1 — studente: (vuoto → "Salta")
  - **Bot** (2 frasi, testo fisso): Nessun problema, ci torniamo. Quando lo devi dare, anche a grandi linee?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Ho segnato il 20 gennaio. A che punto sei con la preparazione?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Quindi hai ancora roba da coprire. Quanto tempo riesca di solito a dedicare allo studio in un giorno?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza è un buon blocco di tempo per concentrarsi davvero. C'è qualcosa che di solito ti blocca o ti rallenta quando studi?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Il rimandare è il nemico numero uno di chi studia. Allora, ricapitoliamo: un'ora e mezza al giorno fino al 20 gennaio, e di solito rimandi.

Profilo salvato: `{"esame_target":{"nome":null,"id":null},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimanda sempre"}`

In coda: esame_target:da_fare — note_libere: 4

## Caso 6 — domanda 1: "non lo so, sono messo male"

- D1 **(caso)** — studente: non lo so, sono messo male
  - **Bot** (2 frasi, non-risposta): Va bene, allora vediamo insieme cosa conviene fare. Quando lo devi dare, anche a grandi linee?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Ti stai organizzando per tempo allora. A che punto sei con la preparazione di quell'esame?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Hai già una base solida da cui partire. Quanto tempo riesci a dedicare allo studio in una giornata tipo?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Va bene, un'ora e mezza è un buon ritmo da mantenere. Quando studi, c'è qualcosa che di solito ti blocca o ti fa perdere tempo?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è il nemico del piano che hai appena detto. Allora, riassumiamo: hai un piano concreto per il 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":null,"id":null},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimanda sempre"}`

In coda: esame_target:da_fare — note_libere: 5

## Caso 7 — domanda 1: "Chimica Organica"

- D1 **(caso)** — studente: Chimica Organica
  - **Bot** (2 frasi): Chimica Organica, chiaro. Quando pensi di dare questo esame?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Hai già una data in testa. A che punto sei con la preparazione di Chimica Organica?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Hai ancora del materiale da coprire. Di solito quanti minuti al giorno riesci a dedicare allo studio?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza la sera è una base solida per avanzare. Quali sono i momenti in cui fatichi di più nello studio?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è il nemico numero uno quando si studia. Adesso abbiamo un quadro: puoi prepararti a Chimica Organica per il 20 gennaio con quello che abbiamo visto.

Profilo salvato: `{"esame_target":{"nome":"Chimica Organica","id":null},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimando"}`

In coda: niente — note_libere: 5

## Caso 8 — domanda 2: "a gennaio credo"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Allora iniziamo da lì. Quando pensi di darlo?
- D2 **(caso)** — studente: a gennaio credo
  - **Bot** (2 frasi): Gennaio è un buon momento per organizzarsi. A che punto sei con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai una buona base su cui lavorare. Quanto tempo riesci a dedicare allo studio in una giornata tipo?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza è un tempo che puoi gestire bene con il materiale giusto. Qual è l'ostacolo che trovi più spesso quando ti siedi a studiare?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Quello è il punto critico allora, se rimandi sempre. Ho capito quello che serve sapere su Analisi Matematica II.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"a gennaio credo","data":null},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimanda sempre"}`

In coda: niente — note_libere: 5

## Caso 9 — domanda 2: "mo vedo, dipende"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Allora partiamo da lì. Quando devi dare Analisi Matematica II?
- D2 **(caso)** — studente: mo vedo, dipende
  - **Bot** (2 frasi, non-risposta): Vediamo allora come stanno le cose adesso. A che punto sei con la preparazione?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Quindi hai ancora del materiale davanti a te. Quanto tempo riesci a dedicare allo studio in una giornata normale?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza ogni sera è un buon ritmo per procedere. Che cosa ti blocca di solito quando ti metti a studiare?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Procrastinazione è il nemico numero uno, non sei solo in questo. Allora con Analisi Matematica II abbiamo un piano: un'ora e mezza ogni sera per uscire dalla metà della preparazione, e sfidiamo insieme questa tendenza a rimandare.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":null,"data":null},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimanda sempre"}`

In coda: quando:da_fare — note_libere: 5

## Caso 10 — domanda 4: "due ore al giorno piu' o meno"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Allora sappiamo su cosa concentrarci. Quando pensi di dare Analisi Matematica II?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Tutto chiaro. A che punto sei con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora parecchio davanti a te. Quanto tempo riesci di solito a dedicare allo studio in un giorno?
- D4 **(caso)** — studente: due ore al giorno piu' o meno
  - **Bot** (2 frasi): Due ore è un buon ritmo per uno studio costante. Qual è l'ostacolo principale che ti ritrovi quando studi?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è un classico, soprattutto quando la materia è densa. Allora sei a metà strada con Analisi Matematica II e la tua sfida è non rimandare: vediamo come riusciamo a darti una mano entro il 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"due ore al giorno piu' o meno","minuti":120},"ostacolo":"rimando sempre"}`

In coda: niente — note_libere: 5

## Caso 11 — domanda 4: "zero, non ho tempo"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Allora partiamo da quello. Quando hai intenzione di darlo?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Quindi c'è una data target chiara. E adesso a che punto sei con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora del materiale da coprire prima dell'esame. Quanto tempo riesci di solito a dedicare allo studio in un giorno?
- D4 **(caso)** — studente: zero, non ho tempo
  - **Bot** (2 frasi): Capisco, in questo momento la situazione è piuttosto stretta. Cosa ti blocca di solito quando cerchi di metterti a studiare?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è una classica, soprattutto quando il tempo pressante. Ho un'idea di come stai messo con Analisi Matematica II e di cosa può aiutarti.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"zero, non ho tempo","minuti":null},"ostacolo":"rimanda sempre"}`

In coda: niente — note_libere: 5

## Caso 12 — domanda 5: "mi distraggo sempre col telefono"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Allora iniziamo da lì. Quando pensi di darla?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Il 20 gennaio è una data fissa allora. A che punto sei con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora metà strada da fare. Quanto tempo riuscì a dedicare allo studio in una giornata tipo?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Novanta minuti ogni sera è già una base solida. Cosa ti blocca di solito quando ti metti a studiare?
- D5 **(caso)** — studente: mi distraggo sempre col telefono
  - **Bot** (2 frasi): Il telefono è un classico, difficile da gestire. Allora abbiamo tutto quello che serve per seguirti con Analisi Matematica II fino al 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"distrazione dal telefono"}`

In coda: niente — note_libere: 5

## Caso 13 — domanda 1: "non mi va di rispondere"

- D1 **(caso)** — studente: non mi va di rispondere
  - **Bot** (2 frasi, non-risposta): Va bene, vediamo allora quando pensi di darlo. Quando lo devi dare, anche a grandi linee?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Allora hai una data fissata. A che punto sei con la preparazione?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai buone basi da cui partire. Di solito quanti minuti al giorno riesci a dedicare allo studio?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza concentrato è solido. Che cosa ti ostacola di solito quando studi?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Un classico, comunque almeno lo sai. Allora io ho quello che mi serve: proviamo insieme a portare avanti quell'esame al 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":null,"id":null},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimando sempre"}`

In coda: esame_target:da_fare — note_libere: 5

## Caso 14 — domanda 5: "sei un robot, che ne sai"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Allora iniziamo da lì. Quando pensi di darlo?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Quindi hai in mente quella data. A che punto sei con la preparazione di Analisi Matematica II?
- D3 — studente: sono a metà del programma
  - **Bot** (2 frasi): Allora hai ancora tempo per completarlo. Quanto tempo al giorno riesci a dedicare allo studio di solito?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Un'ora e mezza ogni sera è un ritmo solido. C'è qualcosa che di solito ti blocca quando studi?
- D5 **(caso)** — studente: sei un robot, che ne sai
  - **Bot** (2 frasi, non-risposta): Immagino che tu stia scherzando. Allora andiamo: prepariamo un piano di studio per Analisi Matematica II.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":"a_meta","tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":null}`

In coda: ostacolo:da_fare — note_libere: 5

## Caso 15 — domanda 3: "30 e lode ovviamente"

- D1 — studente: Analisi Matematica II
  - **Bot** (2 frasi): Analisi Matematica II è un bel pezzo. Quando pensi di darla?
- D2 — studente: il 20 gennaio
  - **Bot** (2 frasi): Allora hai un po' di tempo davanti a te. A che punto sei arrivato con la preparazione di Analisi Matematica II?
- D3 **(caso)** — studente: 30 e lode ovviamente
  - **Bot** (2 frasi, non-risposta): Ho capito, quindi sei tranquillo su questo esame. Quanto tempo riesci a dedicare allo studio in una giornata normale?
- D4 — studente: un'ora e mezza la sera
  - **Bot** (2 frasi): Allora hai quel tempo per concentrarti la sera. Cosa ti blocca di solito quando ti metti a studiare?
- D5 — studente: rimando sempre
  - **Bot** (2 frasi): Rimandare è il classico, lo so. Ora so come aiutarti con Analisi Matematica II il 20 gennaio.

Profilo salvato: `{"esame_target":{"nome":"Analisi Matematica II","id":"00000000-0000-4000-8000-000000000001"},"quando":{"testo":"il 20 gennaio","data":"2027-01-20"},"avanzamento":null,"tempo_al_giorno":{"testo":"un'ora e mezza la sera","minuti":90},"ostacolo":"rimando sempre"}`

In coda: avanzamento:da_fare — note_libere: 5
