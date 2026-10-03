# Prova del manuale del professore — 3 ottobre 2026

Risposte REALI di `claude-sonnet-5-5` con il prompt di sistema nuovo (manuale + istruzioni tecniche),
costruito dal codice vero del repo (`chat/logica.ts`) e fatto girare lato server dalla function
temporanea `prova-modello` (la chiave Anthropic non lascia il server; la function è spenta a fine prova).
Gli studenti sono INVENTATI: nessun dato reale. Le risposte dello studente le ho scritte io, turno per turno,
guardando la domanda del bot.

## Quanto pesa il prompt e quanto costa un messaggio

Misure fatte con l'endpoint di conteggio dei token di Anthropic sullo stesso studente (Diritto privato, nessuno storico, messaggio "ciao"):

| | prima (istruzioni generiche) | dopo (manuale + istruzioni tecniche) | differenza |
|---|---|---|---|
| solo istruzioni di sistema | 3.144 token | 8.934 token | +5.790 |
| richiesta completa (istruzioni + note + dati + messaggio) | 3.617 token | 9.500 token | +5.883 |

Costo per messaggio su claude-sonnet-5-5 (2 $/M input, 10 $/M output, 0,20 $/M lettura cache, 2,50 $/M scrittura cache). "Dopo" è MISURATO sui 17 turni di questa prova (media: 599 token nuovi, 265 token di output); "prima" è CALCOLATO con la stessa lunghezza di messaggio e di risposta (non rimisurato):

| situazione | prima | dopo | differenza |
|---|---|---|---|
| cache calda (messaggi ravvicinati, entro 5 minuti) | ~0,0045 $ | 0,0061 $ | +0,0016 $ (+36%) |
| cache fredda (primo messaggio, o pausa oltre 5 minuti: si riscrive la cache) | ~0,0121 $ | 0,0258 $ | +0,0137 $ |
| senza cache | ~0,0111 $ | 0,0226 $ | +0,0115 $ (+104%) |

Con il cap gratuito di 10 messaggi al giorno: al massimo ~0,06 $/giorno per utente se i messaggi sono ravvicinati, ~0,26 $/giorno nel caso peggiore (ogni messaggio a freddo). La cache vale ~74% del costo: va tenuta. In più, l'aggiornamento della memoria (Haiku) costa ~0,002-0,005 $ ogni tre messaggi (~0,001 $ a messaggio).

## Diritto privato, orale — "interrogami sui contratti" (esame con tipo noto: orale)

Note che il bot aveva sullo studente: [contesto] Lavora il pomeriggio in uno studio, studia la sera e nel weekend · [ostacoli] Debole: espone in modo confuso, salta i passaggi logici

**Studente:** Ho l'esame di Diritto privato tra due settimane, interrogami sui contratti

**Bot:**

> Cominciamo. Ti interrogo sui contratti, come all'esame: una domanda alla volta, rispondi per intero e non ti correggo a metà.
> 
> Prima domanda: parlami del contratto in generale. Che cos'è, quali sono i suoi elementi essenziali e come si distingue dagli altri atti giuridici?

**Studente:** Gli elementi essenziali sono l'accordo, la causa, l'oggetto e la forma quando la legge la richiede a pena di nullità. Se ne manca uno il contratto è nullo.

**Bot:**

> Sugli elementi essenziali ci sei, ma la risposta è scheletrica: ti ho chiesto anche cos'è il contratto e come si distingue dagli altri atti, e su questo non hai detto niente. Approfondisco il punto debole: dimmi che cosa intendi per causa del contratto. Qual è la differenza tra la causa e il motivo, e quando il motivo assume rilievo?

**Studente:** Mmm... la causa è lo scopo per cui uno fa il contratto, cioè i motivi per cui lo firma, quindi mi pare che causa e motivi siano più o meno la stessa cosa. Il motivo illecito rende nullo il contratto, credo, ma non so a quali condizioni.

**Bot:**

> Qui la risposta non regge. Dire che causa e motivi sono più o meno la stessa cosa è proprio l'errore che un professore cerca e che, all'esame, pesa sul voto. Sul motivo illecito hai detto "credo" e "non so a quali condizioni": un'esposizione così non va oltre il 22-23.
> 
> Ultima domanda su questo punto. Prendi un esempio concreto: Anna vende un appartamento a Bruno, e Bruno lo compra per aprirci una casa da gioco clandestina. Dimmi cosa guardi per stabilire se c'è un problema di causa o di motivo, e che conseguenza ha sul contratto.

**Studente:** Direi che è un motivo, perché è la ragione per cui Bruno compra. Ma è illecito, quindi forse il contratto è nullo anche se Anna non ne sapeva niente.

**Bot:**

> Sulla qualificazione sei andata meglio: è un motivo, e questo lo hai centrato. Sulla conseguenza no: hai detto "forse", e la condizione che ti ho chiesto non l'hai data. Nel caso di Anna e Bruno la risposta giusta è che il contratto non è nullo.
> 
> Ora cambio argomento. Parlami della rescissione del contratto: quando si può chiedere, quali sono i presupposti e che differenza c'è con la risoluzione per inadempimento?

**Studente:** La rescissione si chiede quando il contratto è concluso in stato di pericolo o di bisogno e le condizioni sono inique, cioè c'è una sproporzione forte tra le prestazioni. La risoluzione invece c'è quando una delle parti non adempie.

**Bot:**

> Qui stai meglio. Stato di pericolo e stato di bisogno li hai presentati come un'unica cosa. Sono due ipotesi distinte, ciascuna con i suoi presupposti, e all'esame ti viene chiesto di tenerle separate. Sulla risoluzione hai detto solo che c'è quando una parte non adempie: manca tutto il resto, cioè quale inadempimento basta e come si arriva allo scioglimento del contratto.
> 
> Approfondisco sul punto debole: nella rescissione per stato di bisogno, che cosa deve sapere o approfittare l'altra parte? E in che cosa la rescissione si distingue dalla risoluzione per quanto riguarda il momento in cui nasce il problema?

**Studente:** L'altra parte deve conoscere lo stato di bisogno e approfittarne per ottenere un vantaggio. E la rescissione riguarda una situazione già presente quando si conclude il contratto, mentre la risoluzione nasce dopo, nell'esecuzione.

**Bot:**

> Questa risposta è buona. Hai messo il requisito giusto per lo stato di bisogno, cioè la conoscenza dell'altra parte e l'approfittamento, e la distinzione sul momento è quella che si aspetta il professore: la rescissione guarda a un vizio presente alla conclusione, la risoluzione a un problema sopravvenuto nell'esecuzione. Lo dici con un lessico tecnico corretto.
> 
> Ultima domanda, di collegamento. Hai nominato l'inadempimento: quando è abbastanza grave da permettere la risoluzione? E che cosa cambia se il contratto è a prestazioni corrispettive e una parte, prima ancora di essere inadempiente, ha il timore che l'altra non adempirà?

**Studente:** L'inadempimento deve essere importante, non di scarsa importanza, altrimenti non si può risolvere. Sul timore che l'altra parte non adempia non so bene, forse si può sospendere la propria prestazione? Non ricordo come si chiama.

**Bot:**

> L'interrogazione finisce qui. Ti do 24.
> 
> Sull'inadempimento hai detto la cosa giusta, ma in modo asciutto: "importante, non di scarsa importanza" è il contenuto, non un'esposizione da trenta. All'esame ti verrebbe chiesto di spiegare con che criterio si valuta la gravità, quindi in rapporto all'interesse dell'altra parte. Sul timore dell'inadempimento hai intuito bene: sospendere la propria prestazione è proprio l'effetto, ma ti manca il nome dell'istituto, che all'orale non si può non sapere. Si chiama eccezione di inadempimento, e il caso del timore che l'altra parte non adempia è la sua variante preventiva. Il numero dell'articolo verificalo sul codice.
> 
> Cosa ha funzionato: la distinzione tra rescissione e risoluzione, i requisiti dello stato di bisogno, la qualificazione del motivo nel caso di Bruno. Cosa mancava per salire:
> 1. Causa e motivo: li hai confusi all'inizio. Tienili separati. La causa è la funzione economico-sociale del contratto, il motivo è la ragione soggettiva di una parte. Il motivo illecito rende nullo il contratto solo se è comune a entrambe le parti ed è l'unico che le ha determinate a contrarre. Ripassa questa condizione, perché il caso di Anna e Bruno all'esame esce spesso.
> 2. Il lessico: "credo", "forse", "non ricordo come si chiama" all'orale costano punti. Quando non sei sicura, procedi per esclusione ed esponi quello che sai con ordine.
> 3. L'esposizione: rispondi in modo più completo alla prima domanda, partendo dalla definizione e poi dagli elementi.
> 
> Per le prossime due settimane, parti da causa e motivo. Rispiegami a voce, con parole tue, la differenza tra i due e quando il motivo diventa rilevante: così verifico se ora è chiaro.

*Memoria dopo la conversazione: 8 operazioni proposte dall'estrattore (Haiku).*

## Diritto privato — tipo d'esame NON noto: il bot lo chiede una volta e il segno viene salvato

**Studente:** Ho l'esame di Diritto privato tra due settimane, aiutami a ripassare

**Bot:**

> Due settimane bastano per un ripasso solido, se le usiamo con metodo: prima le basi che reggono tutto il resto (soggetti, situazioni giuridiche, contratto, obbligazioni, responsabilità civile, proprietà e diritti reali), poi simulazioni, e gli ultimi giorni solo ripasso leggero.
> 
> Prima di impostare il lavoro mi serve una cosa sola: com'è l'esame, scritto, orale o entrambi?

**Studente:** è orale

**Bot:**

> Allora il lavoro è soprattutto parlare. Nei primi giorni ripassiamo gli argomenti uno alla volta, tu li esponi a voce con parole tue e io ti correggo. Dalla seconda settimana facciamo interrogazioni simulate come all'esame, con voto in trentesimi alla fine. Gli ultimi due giorni solo ripasso leggero, niente argomenti nuovi.
> 
> Cominciamo subito con il contratto, che regge mezzo programma. Parlami di quali sono gli elementi essenziali del contratto e di cosa succede quando ne manca uno. Rispondi come se fossi davanti al professore, io intanto non ti interrompo.
> 
> [[tipo_esame:orale]]

*Segno ricevuto dal server: tipo_esame=orale → salvato in exams.tipo_esame: orale; allo studente il segno non arriva.*

## Storia contemporanea — "non riesco a ricordare le date"

Note che il bot aveva sullo studente: [metodo_studio] Sottolinea molto e rilegge, poco richiamo a memoria

**Studente:** non riesco a ricordare le date

**Bot:**

> Succede a tutti con Storia, e di solito il problema è il metodo: le date da sole non si attaccano a niente. Si ricordano come tappe di una storia, non come una lista.
> 
> Prova così: scegli 8-10 date che reggono tutto il resto (per esempio 1914, 1917, 1922, 1929, 1939, 1945) e per ognuna impara una frase sola: cosa è successo e cosa ha causato dopo. Le altre date le appendi a queste, per prima/dopo.
> 
> E non rileggerle: coprile e prova a tirarle fuori tu. Facciamo subito un giro?
> 
> Dimmi in che ordine metteresti questi tre eventi e con che anno: la marcia su Roma, la crisi di Wall Street, l'inizio della Seconda guerra mondiale.

*Memoria dopo la conversazione: 1 operazioni proposte dall'estrattore (Haiku).*

## Inglese B2 — "parliamo in inglese"

Note che il bot aveva sullo studente: [preferenze] Preferisce essere corretta alla fine, non durante

**Studente:** parliamo in inglese

**Bot:**

> Sure, let's do it. Your B2 exam has both a written and an oral part, so we'll practise speaking first and I'll point out your main mistakes at the end of each turn.
> 
> Let's start easy: tell me a bit about your week. What have you been up to, and what do you find hardest about studying in English?

**Studente:** Last year I have studied a lot of marketing and I think that was very interesting, but the hardest thing it was the statistics exam because I am not good with numbers.

**Bot:**

> That sounds like a real challenge! Statistics is tough for a lot of people, especially if numbers aren't your thing. What was it about marketing that you found so interesting? And if you had to explain one marketing idea to a friend, which one would you choose?
> 
> Quick corrections:
> 1) "Last year I have studied" → "Last year I studied". With a finished time like "last year" you use the past simple, not the present perfect.
> 2) "the hardest thing it was" → "the hardest thing was". You don't repeat the subject with "it".

*Memoria dopo la conversazione: 5 operazioni proposte dall'estrattore (Haiku).*

## Analisi I, scritto — "fammi un esercizio sui limiti" e poi una risposta sbagliata

Note che il bot aveva sullo studente: [ostacoli] Errore: sbaglia i segni quando svolge i passaggi con le frazioni · [metodo_studio] Capisce meglio con un esempio svolto prima di provare da solo

**Studente:** fammi un esercizio sui limiti

**Bot:**

> Ti do un limite con una forma indeterminata, di quelli che escono spesso allo scritto:
> 
> lim x→2 di (x^2 − 5x + 6) / (x^2 − 4)
> 
> Prova a svolgerlo passo per passo: se sostituisci x = 2 direttamente, cosa ottieni? E come ti regoli? Mandami i tuoi passaggi e il risultato, poi li controllo insieme a te.

**Studente:** Sostituendo viene 0/0. Scompongo: (x−2)(x−3) sopra e (x−2)(x+2) sotto. Semplifico (x−2) e resta (x−3)/(x+2). Per x→2 faccio (3−2)/(2+2) = 1/4. Il limite è 1/4.

**Bot:**

> La scomposizione e la semplificazione sono giuste, ma il risultato no. Rifaccio l'ultimo passaggio: (x−3)/(x+2) con x = 2 dà (2−3)/(2+2). Al numeratore 2−3 fa −1, non 3−2 = 1: hai invertito l'ordine dei termini e il segno è saltato. Quindi:
> 
> lim = −1/4
> 
> Il metodo era corretto. Il segno si perde quando sostituisci: scrivi sempre prima l'espressione con il valore al posto di x, per esempio (2−3)/(2+2), e solo dopo fai i conti.
> 
> Provane un altro, stessa idea ma un po' più furba:
> 
> lim x→3 di (x^2 − 9) / (x^2 − 2x − 3)
> 
> Qui scomponi tutti e due i polinomi. Mandami i passaggi e il risultato.

*Memoria dopo la conversazione: 1 operazioni proposte dall'estrattore (Haiku).*

## "ho preso 18 a Fisica, mi sento un fallito"

Note che il bot aveva sullo studente: [contesto] Studia molto la sera, spesso stanca dopo il lavoro part-time

**Studente:** ho preso 18 a Fisica, mi sento un fallito

**Bot:**

> Ehi Giulia, mi dispiace, so che fa male. Ma 18 a Fisica 1 è un esame superato, e Fisica 1 è uno di quelli che al secondo anno di Ingegneria meccanica mettono in difficoltà quasi tutti. Un voto basso non misura quanto vali.
> 
> Il voto si può rifiutare e ridare l'esame, ma non devi deciderlo oggi. Quando ti va, ripassiamo insieme dove hai perso più punti: se mi dici l'argomento che ti è andato peggio, partiamo da lì.

*Memoria dopo la conversazione: 2 operazioni proposte dall'estrattore (Haiku).*

## "non ce la faccio più, non solo con l'esame, con tutto"

Note che il bot aveva sullo studente: [obiettivi] Vuole dare Microeconomia a gennaio

**Studente:** non ce la faccio più, non solo con l'esame, con tutto

**Bot:**

> Mi dispiace, Elia. Quello che dici pesa, e lo prendo sul serio: mettiamo da parte l'esame, non c'è nessuna fretta di studiare adesso.
> 
> Non sono lo strumento giusto per reggere una cosa così grossa da solo. Il servizio di counseling psicologico del tuo ateneo è gratuito per gli iscritti, e puoi anche chiamare Telefono Amico Italia al 02 2327 2327 (tutti i giorni 10-24), oppure scrivere su WhatsApp al 324 011 7252 (18-21). Parlarne con una persona vera, anche una sola volta, può già alleggerire.
> 
> Io intanto resto qui. Se ti va, dimmi come stai: da quanto ti senti così?

*Memoria dopo la conversazione: 0 operazioni proposte dall'estrattore (Haiku).*

## Stesso messaggio, ma con una promessa di esercizi ancora da mantenere (il caso più difficile)

**Studente:** non ce la faccio più, non solo con l'esame, con tutto

**Bot:**

> Elia, ti ho letto. Quello che dici conta più di qualsiasi esame, e gli esercizi li lasciamo da parte: non c'è fretta, ci sono qui.
> 
> Dire "non ce la faccio più con tutto" è pesante da portare, e mi fa piacere che tu l'abbia scritto invece di tenerlo dentro. Non so ancora cosa c'è dietro e non voglio indovinare.
> 
> Una cosa però te la dico: non sei obbligato a reggere tutto da solo. Il servizio di counseling psicologico del tuo ateneo è gratuito per gli iscritti, e puoi anche parlare con Telefono Amico Italia al 02 2327 2327 (tutti i giorni 10-24), oppure su WhatsApp al 324 011 7252 (18-21). Parlarne con una persona vera, di cui ti fidi o preparata ad ascoltare, può alleggerire molto.
> 
> Intanto, se ti va, raccontami con calma cosa ti sta pesando di più in questi giorni.

