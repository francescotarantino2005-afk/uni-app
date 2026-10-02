# Prova della promessa mantenuta — 2 ottobre 2026 (sera)

Il caso Tolc rigiocato **lato server sul database vero**, con il codice vero di
`accoglienza-dialogo` (`servizio.ts`) e della chat (`chat/motore.ts`), attraverso
un banco di prova temporaneo (function `prova-modello`, protetta da un segreto
casuale e limitata a un solo utente; spenta a fine prova). L'utente è l'account
di prova `prova@gmail.com`, resettato prima e dopo. Il banco di prova faceva
anche la parte dell'app **già installata**: dopo ogni risposta salvava il
profilo senza la chiave `impegno`, che quella versione non conosce.

## 1. Il dialogo

- **Bot:** Ciao, sono Lode. Partiamo dal concreto: qual è il primo esame che devi dare?
- Studente: devo ancora iniziare il corso, ho il Tolc I il 14 settembre
- **Bot** (4,0 s): Il Tolc I il 14 settembre: però oggi è il 2 ottobre, quindi quella data sembra già passata. Se invece intendevi un'altra data o un altro appello, dimmelo pure. Se parti da zero con il corso, quanto tempo al giorno riesci a dedicare allo studio?
- Studente: non so, sono abbastanza indietro con la matematica, sto facendo un percorso nel quale riprendo argomenti vecchi li ristudio e mi esercito, partendo dalle basi: monomi, polinomi, equazioni, prodotti notevoli, disequazioni, un aiuto mi sarebbe utile

### La battuta di chiusura (4,7 s, risposta arrivata alle 17:44:15,9 UTC)

> Ripartire dalle basi per recuperare la matematica è un buon modo di costruire fondamenta solide, e hai già un percorso chiaro: monomi, polinomi, equazioni, prodotti notevoli, disequazioni. Ti aiuto a organizzare il ripasso partendo da monomi e polinomi, per poi arrivare a equazioni e disequazioni passo dopo passo.

Impegno salvato in `profilo_studio.impegno`: `{"testo": "Ti aiuto a organizzare il ripasso partendo da monomi e polinomi, per poi arrivare a equazioni e disequazioni passo dopo passo.", "stato": "da_mantenere"}`.

## 2. Il PRIMO messaggio che la chat scrive da sola

Scritto in `chat_messages` alle 17:44:19,5 UTC: **3,6 secondi dopo** la battuta di
chiusura, senza che lo studente scriva niente e senza farlo aspettare (la
chiusura era già stata restituita). Subito dopo l'impegno è passato a
`"stato": "mantenuto"`, con `mantenuto_il` e l'id del messaggio.

> Ecco i primi esercizi, su monomi e polinomi, dal più semplice al più impegnativo:
>
> 1) Calcola 3x^2 + 5x^2 - 2x^2
> 2) Calcola (4a^2b) * (-3ab^3)
> 3) Semplifica (6x^3y^2) / (2xy)
> 4) Calcola (2x - 3)(x + 4)
> 5) Semplifica (3x^2 - 2x + 1) - (x^2 + 4x - 5)
>
> Mandami i tuoi risultati, anche uno alla volta: se qualcosa non torna ti mostro io dove.

## 3. Lo studente sbaglia apposta il primo esercizio

- Studente: il primo fa 6x^6

> Rifaccio il conto: 3x^2 + 5x^2 - 2x^2 = (3 + 5 - 2)x^2 = 6x^2. Quindi il coefficiente è giusto, 6, ma l'esponente no: 6x^6 è sbagliato.
>
> Il passaggio che si è rotto è probabilmente questo: hai sommato anche gli esponenti, 2 + 2 + 2 = 6. Quella è la regola del prodotto di potenze (x^2 * x^2 = x^4, dove gli esponenti si sommano), ma qui non c'è nessun prodotto: c'è una somma. Sommando monomi simili si sommano solo i coefficienti, cioè i numeri davanti, mentre la parte letterale x^2 resta identica, come quando sommi 3 mele + 5 mele - 2 mele = 6 mele, non 6 mele^3. Fatto bene: 3x^2 + 5x^2 - 2x^2 = 6x^2.
>
> Prova ora un esercizio gemello: calcola 7a^3 + a^3 - 4a^3. Poi passa al secondo dell'elenco, quello con il prodotto, dove la regola degli esponenti serve davvero.

**Esito: passa.** Il primo messaggio contiene cinque esercizi veri sull'argomento
promesso (monomi e polinomi), in ordine di difficoltà, partendo da una somma di
monomi simili. Sull'errore non dà solo il risultato: dice quale passaggio è
sbagliato (gli esponenti sommati), spiega la regola e perché lì non vale, e fa
riprovare con un esercizio gemello.

## 4. Una volta sola

Seconda richiesta di mantenere lo stesso impegno, a impegno già mantenuto:
risposta in 0,1 s `{"stato": "mantenuto", "messaggio": null}`, nessun messaggio
nuovo in chat.

## 5. Se la generazione fallisce, la promessa non si perde

Stesso dialogo, ma con la chiave del modello rotta apposta **solo** per la
generazione del primo messaggio:

- dopo la chiusura: nessun messaggio scritto, impegno ancora
  `"stato": "da_mantenere"` (e `tentativo_il` di nuovo vuoto, quindi si può riprovare subito);
- secondo tentativo, ancora con la chiave rotta: `{"stato": "da_mantenere"}`, niente di scritto;
- poi lo studente scrive "ciao, ci sei?" (chiave buona): la risposta mantiene la promessa,

> Ci sono, e comincio subito da monomi e polinomi. Sul TOLC I: il 14 settembre risulta già passato, quindi la data va aggiornata e mi dirai tu quella giusta; intanto lavoriamo comunque sulle basi, che servono in ogni caso.
>
> Il primo esercizio è di base, poi la difficoltà sale:
>
> 1) Calcola 3x^2 + 5x^2 - 2x^2
> 2) Calcola (2a)(-3a^2)
> 3) Semplifica (6x^3y^2) / (2xy)
> 4) Calcola (2x + 3)(x - 4)
> 5) Semplifica (x^2 - 3x + 1) - (2x^2 + x - 5) + 3x
>
> Mandami i tuoi risultati, anche uno alla volta: se c'è un errore, ti faccio vedere il passaggio preciso in cui si rompe.

  e l'impegno passa a `"mantenuto"`.

## 6. Quanto costa un messaggio della chat

Tre conversazioni di prova, quattro messaggi ciascuna, giocate due volte col
modello vero: PRIMA (Haiku 4.5, istruzioni del commit precedente, senza cache) e
DOPO (Sonnet 5.5, istruzioni nuove, cache sulla parte stabile). Token reali
restituiti dall'API; prezzi di listino al milione di token: Haiku 1 $ ingresso /
5 $ uscita; Sonnet 5.5 2 $ / 10 $, lettura dalla cache 0,20 $, scrittura in
cache 2,50 $.

| conversazione | versione | ingresso non in cache | letti dalla cache | scritti in cache | uscita |
|---|---|---|---|---|---|
| A — matricola, esercizi dopo l'accoglienza | prima | 2676 · 2716 · 2786 · 2737 | — | — | 21 · 49 · 61 · 280 |
| A | dopo | 639 · 933 · 1196 · 1288 | 3717 a messaggio | 0 (scritti dal messaggio dell'impegno) | 272 · 237 · 244 · 482 |
| B — secondo anno, libretto e orario | prima | 2419 · 2622 · 2798 · 2993 | — | — | 190 · 147 · 176 · 186 |
| B | dopo | 17 · 240 · 500 · 924 | 0 · 3754 · 3754 · 3754 | 3754 al primo | 204 · 224 · 395 · 466 |
| C — matricola senza dati | prima | 2218 · 2374 · 2563 · 2747 | — | — | 142 · 168 · 166 · 211 |
| C | dopo | 20 · 292 · 680 · 969 | 3366 · 3540 · 3540 · 3540 | 174 al primo | 252 · 355 · 262 · 290 |

Media sui dodici messaggi:

| | ingresso medio | uscita media | costo medio a messaggio |
|---|---|---|---|
| PRIMA — Haiku 4.5 | 2637 token | 150 token | **0,0034 $** |
| DOPO — Sonnet 5.5, cache calda (come misurato) | 4312 token, di cui ~3500 letti dalla cache | 307 token | **0,0058 $** |
| DOPO — caso peggiore: ogni messaggio a più di 5 minuti dal precedente (la cache scade e si riscrive) | 4312 token | 307 token | 0,0135 $ |
| DOPO — se la cache non ci fosse | 4312 token | 307 token | 0,0117 $ |

Come leggerlo:

- Sonnet conta più token di Haiku per lo stesso testo (le stesse istruzioni pesano
  circa 3500 token invece di circa 2100) e costa il doppio a token.
- Le risposte sono lunghe il doppio (307 token contro 150): è il tutor che scrive
  esercizi e spiega gli errori. Metà del costo "dopo" è testo in uscita.
- La cache dura 5 minuti e si rinnova a ogni messaggio. Dentro una conversazione
  fa risparmiare circa metà (0,0058 contro 0,0117 $). Un messaggio isolato costa
  invece un po' di più che senza cache (0,0135 contro 0,0117 $), perché scrivere
  in cache costa il 25% in più dell'ingresso normale.
- Con il tetto di 10 messaggi al giorno, uno studente gratuito costa al massimo
  tra 0,06 $ (tutti di fila) e 0,14 $ (tutti isolati) al giorno; prima erano 0,03 $.
- L'estrazione della memoria (seconda chiamata, in background) resta su Haiku e
  non è in questi numeri: non è cambiata.
- Ogni chiamata della chat scrive nei log della function una riga `uso_chat`
  con i token reali e il costo: la stima si può rifare sui dati veri.
