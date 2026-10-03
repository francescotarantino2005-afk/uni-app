# Prova delle chiusure — 3 ottobre 2026

Sei conversazioni rigiocate col modello vero (`claude-sonnet-5-5`) e la logica nuova di `accoglienza-dialogo` (stessa `logica.ts` della function, compresa la seconda richiesta quando il modello chiude senza un impegno di Lode). Per ogni chiusura c'è l'impegno salvato e il **primo messaggio che la chat scrive da sola** per mantenerlo (stessa logica di `chat`). Data di riferimento: 2026-10-03. Le risposte del modello sono registrate in `test/fixtures/dialoghi.json` e fanno da dati ai test automatici.

## 1. La prova di stanotte (Tolc I tra una settimana, "sono messo male")

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: devo sostenere il tolc i tra una settimana circa
- **Bot**: Il Tolc I tra una settimana circa ti lascia poco margine, ma abbastanza per lavorare in modo mirato. A che punto sei con la preparazione per il Tolc I?
- Studente: sono messo male
- **Bot** _(chiusura, esame vicino + difficoltà)_: Dirlo senza giri di parole è già un buon punto di partenza: con una settimana davanti conta più scegliere bene cosa fare che recuperare tutto. Ti preparo una mini-simulazione del Tolc I di 10 domande, così vediamo subito dove perdi più punti e da lì costruisco il piano dei giorni che restano. Intanto non pensare a tutto il programma: ci concentriamo sulle sezioni dove si guadagnano più punti in fretta.

Impegno salvato: «Ti preparo una mini-simulazione del Tolc I di 10 domande, così vediamo subito dove perdi più punti e da lì costruisco il piano dei giorni che restano.» — stato `da_mantenere`. Domande fatte: esame_target, avanzamento.

**Primo messaggio della chat:**

> Ecco la mini-simulazione di 10 domande, a risposta multipla come al Tolc I. Cerca di farla in una ventina di minuti, senza calcolatrice.
> 
> 1) Quanto vale 2^3 · 2^4 / 2^5?
> A) 2^2  B) 4^2  C) 2^12  D) 2^3  E) 1
> 
> 2) La soluzione dell'equazione 3x - 5 = 2x + 7 è:
> A) x = 2  B) x = 12  C) x = -12  D) x = 1  E) x = 7
> 
> 3) Quale numero è il più grande?
> A) 3/4  B) 5/8  C) 7/10  D) 2/3  E) 4/5
> 
> 4) Un prodotto costa 80 euro e viene scontato del 25%. Il prezzo finale è:
> A) 55 euro  B) 60 euro  C) 65 euro  D) 20 euro  E) 75 euro
> 
> 5) Se x^2 = 49, allora x vale:
> A) solo 7  B) solo -7  C) 7 oppure -7  D) 24,5  E) nessun valore reale
> 
> 6) La disequazione 2x - 6 > 0 è verificata per:
> A) x < 3  B) x > 3  C) x > -3  D) x < -3  E) x > 6
> 
> 7) Un triangolo rettangolo ha i cateti lunghi 6 e 8. La lunghezza dell'ipotenusa è:
> A) 10  B) 14  C) 12  D) 7  E) 48
> 
> 8) Qual è il valore di (a + b)^2?
> A) a^2 + b^2  B) a^2 + 2ab + b^2  C) a^2 - 2ab + b^2  D) 2a + 2b  E) a^2 + ab + b^2
> 
> 9) In una classe di 30 studenti, 18 sono ragazze. Che percentuale della classe è formata da ragazzi?
> A) 18%  B) 30%  C) 40%  D) 60%  E) 12%
> 
> 10) La retta che passa per i punti (0, 1) e (2, 5) ha coefficiente angolare:
> A) 1  B) 2  C) 4  D) 1/2  E) 3
> 
> Mandami le tue risposte, anche una alla volta (per esempio "1 A, 2 B"). Se su qualche domanda non sai da dove cominciare, scrivi "non so": mi serve proprio quello.

## 2. Il Tolc I del 2 ottobre (chiede aiuto)

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: devo ancora iniziare il corso, ho il Tolc I il 14 settembre
- **Bot**: Intanto è chiaro che il corso non l'hai ancora cominciato. Il 14 settembre però è già passato: la data giusta la sistemiamo più avanti. Quanto tempo al giorno riesci a dedicare allo studio?
- Studente: non so, sono abbastanza indietro con la matematica, sto facendo un percorso nel quale riprendo argomenti vecchi li ristudio e mi esercito, partendo dalle basi: monomi, polinomi, equazioni, prodotti notevoli, disequazioni, un aiuto mi sarebbe utile
- **Bot** _(chiusura, ha chiesto aiuto)_: Ripartire dalle basi, da monomi e polinomi fino alle disequazioni, è la mossa giusta quando la matematica è rimasta indietro, e ti stai già muovendo con un metodo. Ti preparo una serie di 10 esercizi graduali sui prodotti notevoli, dai più semplici ai più insidiosi, così partiamo subito da lì. Quando li hai fatti, dimmi dove ti sei bloccato e ripartiamo da quel punto.

Impegno salvato: «Ti preparo una serie di 10 esercizi graduali sui prodotti notevoli, dai più semplici ai più insidiosi, così partiamo subito da lì.» — stato `da_mantenere`. Domande fatte: esame_target, tempo_al_giorno.

**Primo messaggio della chat:**

> Ecco i 10 esercizi sui prodotti notevoli, in ordine di difficoltà. Svolgi ogni espressione fino a una forma semplificata.
> 
> 1) (x + 3)^2
> 2) (a - 5)^2
> 3) (2x + 1)^2
> 4) (x + 4)(x - 4)
> 5) (3a - 2b)^2
> 6) (5x + 2)(5x - 2)
> 7) (x^2 + 3)^2
> 8) (2x - 3y)(2x + 3y) + (x + y)^2
> 9) (x + 2)^3
> 10) (a + b + 1)^2
> 
> Mandami i risultati, anche uno alla volta: se parti dai primi tre mi basta quello per capire come stai messo.

## 3. Dice tutto nel primo messaggio

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: Devo dare Basi di Dati il 12 febbraio, sono più o meno a metà del programma. Studio un paio d'ore la sera perché di giorno lavoro in un bar, e il mio problema è che rimando sempre tutto all'ultima settimana.
- **Bot** _(chiusura)_: Lavorare al bar tutto il giorno e poi trovare due ore la sera per studiare non è poco, e dirmi da solo che rimandi all'ultima settimana è già metà del lavoro: sai dov'è il problema. Ti preparo un piano di studio a piccoli blocchi serali per le settimane che ti separano dal 12 febbraio, così l'ultima settimana resta solo per il ripasso. Parti stasera con un blocco piccolo: il primo passo è quello che pesa di più.

Impegno salvato: «Ti preparo un piano di studio a piccoli blocchi serali per le settimane che ti separano dal 12 febbraio, così l'ultima settimana resta solo per il ripasso.» — stato `da_mantenere`. Domande fatte: esame_target.

**Primo messaggio della chat:**

> Dal 5 ottobre al 5 febbraio hai circa 17 settimane: tengo l'ultima settimana (dal 6 al 12 febbraio) solo per ripasso e simulazioni d'esame, quindi il programma vero va chiuso entro il 5 febbraio. Con "più o meno a metà" ti restano tre blocchi, che ti scrivo qui sotto, e una regola fissa: 5 sere a settimana da due ore, il weekend libero come margine per quando salta una sera.
> 
> Ottobre, ottobre e novembre: completare la seconda metà del programma, un argomento nuovo ogni settimana. Dicembre: chiudere i buchi che sono rimasti dalla prima metà. Gennaio: esercizi su carta, in particolare SQL, algebra relazionale e normalizzazione, che a Basi di Dati sono il cuore dello scritto.
> 
> Ogni sera sono due blocchi da un'ora: 1 ora di teoria o ripasso, 1 ora di esercizi su quello che hai appena letto. Mai solo teoria: è il modo più comune per credere di sapere e poi bloccarsi davanti al foglio.
> 
> Per stasera, un passo solo: dimmi qual è l'ultimo argomento del programma che hai studiato davvero, così lo segno come punto di partenza e ti scrivo la prima settimana nel dettaglio.

## 4. Risponde a monosillabi

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: fisica
- **Bot**: Fisica è uno di quegli esami che si capisce davvero solo facendo esercizi, quindi conviene partire da lì. Per quando è fissato l'esame di Fisica Generale I?
- Studente: boh
- **Bot**: Se la data non è ancora chiara, per ora non importa: la fissiamo quando ce l'hai sotto mano. Intanto, a che punto sei con Fisica Generale I: non hai ancora iniziato, sei a metà o stai già ripassando?
- Studente: poco
- **Bot**: Poco vuol dire che hai già una base da cui partire, e per Fisica Generale I è un buon punto di partenza. Quanto tempo riesci a dedicare allo studio ogni giorno, più o meno?
- Studente: mah
- **Bot**: Cosa va storto di solito quando ti metti a studiare?
- Studente: no
- **Bot** _(chiusura)_: Le domande le lasciamo qui, nessun problema. Ti preparo una serie di sei esercizi graduali di Fisica Generale I sulla cinematica, dal più semplice al più articolato, così partiamo da qualcosa di concreto.

Impegno salvato: «Ti preparo una serie di sei esercizi graduali di Fisica Generale I sulla cinematica, dal più semplice al più articolato, così partiamo da qualcosa di concreto.» — stato `da_mantenere`. Domande fatte: esame_target, quando, avanzamento, tempo_al_giorno, ostacolo.

**Primo messaggio della chat:**

> Ecco i sei esercizi di cinematica, in ordine di difficoltà. Partiamo dalle basi:
> 
> 1) Un'auto viaggia a velocità costante di 72 km/h. Quanti metri percorre in 10 secondi? (Converti prima i km/h in m/s.)
> 
> 2) Un ciclista parte da fermo e accelera con a = 2 m/s^2 costante. Che velocità ha dopo 5 s e quanta strada ha fatto in quel tempo?
> 
> 3) Un treno rallenta con accelerazione costante da 30 m/s a 10 m/s in 8 s. Quanto vale l'accelerazione (con il segno) e quanti metri percorre in quegli 8 s?
> 
> 4) Un sasso viene lasciato cadere da fermo da un ponte alto 45 m. Dopo quanto tempo tocca l'acqua e con che velocità? Usa g = 10 m/s^2.
> 
> 5) Una palla viene lanciata verso l'alto con velocità iniziale di 20 m/s (g = 10 m/s^2). Quanto tempo impiega a raggiungere il punto più alto e a che altezza arriva rispetto al punto di lancio?
> 
> 6) Un'auto A parte da ferma con a = 3 m/s^2. Nello stesso istante, 60 m più avanti sulla stessa strada, un'auto B viaggia nello stesso verso a velocità costante di 10 m/s. Dopo quanto tempo A raggiunge B?
> 
> Mandami i tuoi risultati, anche uno alla volta: parti dall'1 e li correggo man mano passaggio per passaggio.

## 5. Va fuori tema

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: ma tu sei tipo chatgpt?
- **Bot**: Sono un assistente di studio basato su intelligenza artificiale, quindi ti dico le cose come stanno: sono un'AI, ma costruita per aiutarti a preparare gli esami, non per chiacchierare di tutto. Quanto tempo riesci a dedicare allo studio in una giornata normale?
- Studente: quanto costa questa app?
- **Bot**: Sul prezzo non ho informazioni da darti, e non voglio dirti una cifra a caso. Quello che posso fare è mostrarti subito a cosa servo, così giudichi da solo. Quando ti metti a studiare, cosa ti fa più spesso perdere tempo o ti blocca?
- Studente: che tempo fa domani a Bari?
- **Bot** _(chiusura, impegno ottenuto con la seconda richiesta)_: Il meteo di Bari non rientra tra le cose che so dirti, io mi occupo di esami e studio. Ti consiglio un'app meteo per domani. Ti preparo subito in chat una mini-simulazione da 15 domande su uno dei tuoi esami, così capiamo da dove partire.

Impegno salvato: «Ti preparo subito in chat una mini-simulazione da 15 domande su uno dei tuoi esami, così capiamo da dove partire.» — stato `da_mantenere`. Domande fatte: esame_target, tempo_al_giorno, ostacolo.

**Primo messaggio della chat:**

> Simulazione da 15 domande su Analisi Matematica II, dalle più semplici alle più impegnative. Le prime tre sono a scelta multipla, le altre a risposta aperta. Dove non sai, scrivi "non so": mi serve per capire da dove ripartire.
> 
> 1) Il limite per x che tende a 0 di sin(x)/x vale: a) 0, b) 1, c) infinito, d) non esiste
> 2) La derivata di x^2 * e^x è: a) 2x e^x, b) x^2 e^x, c) (2x + x^2) e^x, d) 2x + e^x
> 3) L'integrale di 1/x su (1, e) vale: a) 0, b) 1, c) e, d) e - 1
> 4) Calcola la derivata di f(x) = ln(x^2 + 1).
> 5) Calcola l'integrale indefinito di x * cos(x).
> 6) Calcola il limite per x che tende a +infinito di (3x^2 + x) / (x^2 - 5).
> 7) Dati f(x,y) = x^2 y + y^3, scrivi le derivate parziali rispetto a x e a y.
> 8) Scrivi il gradiente di f(x,y) = x^2 + 3xy nel punto (1, 2).
> 9) Trova i punti stazionari di f(x,y) = x^2 + y^2 - 2x.
> 10) Per f(x,y) = x^2 - y^2, dai la matrice hessiana e di' di che tipo è il punto stazionario (0,0).
> 11) Calcola l'integrale doppio di xy sul quadrato [0,1] x [0,1].
> 12) Determina la natura della serie somma per n da 1 a infinito di 1/n^2 e di 1/n.
> 13) Risolvi l'equazione differenziale y' = 2y con y(0) = 3.
> 14) Risolvi l'equazione differenziale y'' - 3y' + 2y = 0.
> 15) Trova il minimo di f(x,y) = x^2 + y^2 con il vincolo x + y = 2 usando i moltiplicatori di Lagrange.
> 
> Mandami le risposte anche una alla volta, non serve finire tutto. Se preferisci un altro esame tra quelli del libretto, dimmelo e cambio.

## 6. Non vuole rispondere

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: fisica
- **Bot**: Fisica è un esame che chiede metodo più che memoria, quindi capire da dove partire fa la differenza. Quando devi darlo?
- Studente: boh
- **Bot**: Nessun problema, la data la sistemiamo più avanti: per Fisica Generale I intanto conta più come studi che quando lo dai. A che punto sei con Fisica Generale I: non hai ancora iniziato, sei a metà o stai già ripassando?
- Studente: mah
- **Bot** _(chiusura)_: Le domande le lasciamo qui, nessun problema. Ti preparo una mini-simulazione di 5 domande su Fisica Generale I, dalla cinematica alla dinamica, così partiamo da qualcosa di concreto.

Impegno salvato: «Ti preparo una mini-simulazione di 5 domande su Fisica Generale I, dalla cinematica alla dinamica, così partiamo da qualcosa di concreto.» — stato `da_mantenere`. Domande fatte: esame_target, quando, avanzamento.

**Primo messaggio della chat:**

> Ecco la mini-simulazione su Fisica Generale I, dalla cinematica alla dinamica, in ordine di difficoltà crescente:
> 
> 1) Un'auto parte da ferma e accelera in modo costante a 2 m/s^2. Che velocità ha dopo 5 s e quanta strada ha percorso?
> 
> 2) Un sasso viene lasciato cadere da fermo da un ponte alto 45 m. Dopo quanto tempo tocca l'acqua? Usa g = 10 m/s^2 e trascura l'aria.
> 
> 3) Un pallone viene calciato dal suolo con velocità 20 m/s a 30 gradi sopra l'orizzontale. Quanto vale il tempo di volo? Usa g = 10 m/s^2.
> 
> 4) Una cassa di 10 kg è ferma su un piano orizzontale liscio, senza attrito. La spingi con una forza orizzontale di 30 N. Quanto vale l'accelerazione e che velocità ha dopo 4 s?
> 
> 5) Una cassa di 5 kg scivola su un piano inclinato di 30 gradi, senza attrito. Quanto vale l'accelerazione lungo il piano? Usa g = 10 m/s^2.
> 
> Mandami i tuoi risultati, anche uno alla volta: parti dal primo e dimmi pure dove ti blocchi.

