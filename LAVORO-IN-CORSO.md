# Lavoro in corso — chat 1.0.1, build 22 (10 ottobre 2026)

## Build 22 (1.0.1) — solo app, server invariato (chat v21, accoglienza-dialogo v14)
Commit `1fc438e`, su GitHub. `npm test` 187/187. EAS build `ecb6db1b-…` con invio
automatico a TestFlight (submission `80a94ca2-…`). NON inviata in revisione.

### Cosa cambia nella schermata Chat
1. **Pagina, non bolle**: le risposte di Lode sono testo sullo sfondo #FCFAFF a tutta
   larghezza, margini 20, EB Garamond 19, #221C36. Lo studente: bolla #CDBDFD a destra,
   max 85% dello schermo, padding 12/16, angoli 20. 16 tra un messaggio e l'altro.
2. **Robot**: intestazione = testa del robot 32 (posa corrente) + nome del bot
   (profiles.nome_bot, default Lode) in grassetto + sotto, grigio, la conversazione
   ("Generale", "Esame · titolo", "Nuova chat"). Menu a sinistra, nuova chat a destra.
   Posa: pensa mentre aspetta (risposta o impegno), poi quella dell'ultima risposta
   (esulta/vicino/guarda). Robot 48 sopra l'ultima risposta. `AvatarLode` ora inquadra
   la testa (quadrato 600 px centrato in 518,380 dell'immagine 1024).
3. **Chat nuove**: "Nuova chat" apre una bozza in memoria; la riga in `conversazioni`
   nasce al primo messaggio, col titolo dalle prime parole (max 30 caratteri, parola
   intera + "…"), sempre rinominabile. Le chat senza messaggi non compaiono nella barra;
   quelle vuote da più di 10 minuti l'app le elimina (via RLS) quando carica la barra.
   Sul database oggi ce ne sono **2** (i duplicati visti): spariscono alla prima apertura
   della chat con la build 22. Il server non è stato toccato: siccome il titolo arriva
   già diverso da "Nuova chat", la function non lo riscrive (il suo taglio è a 40).
4. **Sdoppiato/sbiadito**: nella build 21 l'unica dissolvenza era quella del robot, che
   teneva la posa vecchia SOTTO la nuova (immagini trasparenti: due pose visibili, e se
   l'animazione veniva interrotta la vecchia restava lì). Ora è una dissolvenza
   incrociata che lascia una sola immagine. I messaggi nuovi entrano con una breve
   dissolvenza UNA volta: l'id si toglie appena parte, quindi le righe rimontate dalla
   FlatList scorrendo non si riaccendono (verificato: dopo lo scorrimento nessun
   elemento con opacità < 1).
5. Tastiera: l'offset ora è area sicura + 44 (prima 90 fisso, troppo su SE e troppo
   poco sugli iPhone con isola).

### Verifiche fatte (web, rotta temporanea con dati finti, poi cancellata)
- SE 375: margini testo 20/20, bolla padding 12/16 angoli 20; 430: bolla max 366 = 85%.
- Bozza: aprire "Nuova chat" non fa nessuna scrittura; il primo messaggio fa prima
  l'insert della conversazione (col titolo) e poi la chiamata a `chat`.
- Le due chat vuote finte vecchie vengono eliminate al caricamento della barra.
- La sintassi `chat_messages(count)` provata sull'API vera (200; un controllo sbagliato dà 400).
- NON verificabile da qui: tastiera vera, font e animazioni su iOS → sul telefono.

### Scelte fatte al posto tuo
- Sottotitolo di una chat d'esame: "Materia · titolo" (troncato se lungo).
- Robot dell'intestazione senza cerchio di sfondo (la testa col tocco ci sta intera).
- Chat vuote: nascoste subito, eliminate dopo 10 minuti (non subito, per non
  cancellarne una il cui primo messaggio è in viaggio).

## Da provare sul telefono (build 22)
1. Chat lunga: scorri su e giù veloce, nessun testo doppio o sbiadito.
2. Intestazione: robot + nome + conversazione; manda un messaggio, il robot pensa,
   poi torna a guardare (o esulta con "ho preso 30").
3. Barra laterale: le due "Nuova chat" vuote non ci sono più; "Nuova chat" + primo
   messaggio = una sola voce col titolo dalle prime parole.
4. iPhone piccolo con tastiera aperta: il campo di testo resta sopra la tastiera.

## Bloccato in attesa di Francesco (invariato)
- Cancellare la function `prova-modello` dalla dashboard Supabase (spenta, 410).
- La prova "il server rispetta senza_limiti" con prova1@gmail.com.

---

# Storico — correzioni dopo la prova TOLC-I (9-10 ottobre 2026)

## Stato
- **Pubblicate e registrate** (rilette dal server, identiche al repo):
  `chat` **v21** (14 file), `accoglienza-dialogo` **v14** (8 file, cambia solo il manuale 1.2).
- `npm test` **183/183**. Tutto committato e su GitHub.
- Nessuna build nuova: il limite di lunghezza era solo sul server. La build 21 su
  TestFlight resta quella da mandare in revisione (lo fa Francesco).
- `prova-modello` spenta (410).

## Cosa fa adesso la chat (punti 1-7 del 9 ottobre)
1. **Senza limiti**: `profiles.senza_limiti` (migrazione `20261009191003_senza_limiti.sql`)
   salta il tetto giornaliero. Un trigger (`proteggi_flag_profilo`) rimette il valore
   di prima quando a scrivere è lo studente: dall'app non si cambiano né
   `senza_limiti` né `premium` (provato il 10/10 in transazione annullata, con un
   utente normale: premium f→f, senza_limiti f→f, il nome invece si cambia).
   Attivo SOLO su **prova1@gmail.com** (id 2c17ce78-…). `premium` è tornato **false**
   (era stato messo true la sera del 9 come sblocco temporaneo; nessun profilo è premium).
   "Mi sono bloccato" e messaggi rifiutati per lunghezza non scalano il tetto.
2. **Cronologia per budget**: fino a 80 messaggi letti, 12k token stimati, ultimi 6
   sempre interi; i messaggi di Lode in testa non si scartano più. Il messaggio
   dello studente si salva anche quando il modello fallisce. Tetto di uscita 4000 token.
   **Materiali**: test/esercizi/piani segnati in `metadati.materiale`; l'ultimo
   materiale attivo (14 giorni) e l'ultimo **test con chiave** rientrano nel
   contesto anche fuori finestra. Il test con chiave resta correggibile anche se
   dopo arriva un esercizio gemello (scoperto nella prova del 10/10, corretto in v21).
3. **Mai inventare**: regola nelle istruzioni tecniche + manuale 1.2 (Onestà).
4. **8.000 caratteri** sul server (l'app non ha limiti).
5. **Punteggi dal codice**: il modello scrive `[[test formato=tolc chiave=1A,... senza_penalita=16-20]]`
   (tolto prima di mostrarlo); il codice legge le risposte, chiede SOLO le righe
   ambigue col numero (senza modello), calcola giuste/sbagliate/non date/punteggio
   e lo mette in testa; il modello spiega solo gli errori. "non data", "non risposta",
   "salto", "in bianco" scritti in chiaro valgono non data senza conferma; "non so",
   "boh", "forse B" si chiedono. Lo stato della correzione si cerca in tutta la
   cronologia letta (anche fuori finestra).
6. Formule: `formuleLeggibili` su tutte le risposte, test compresi.
7. eas.json committato.

## Prove dal vivo
- 9/10 sera: 0,078 USD. 10/10 notte: **0,28 USD** (tetto 0,50). Totale 0,36 USD.
  Dettagli in `docs/prova-dal-vivo-2026-10-09.md`.

## Bloccato in attesa di Francesco
- Cancellare la function `prova-modello` dalla dashboard Supabase (è spenta, 410).
- La prova "il server rispetta senza_limiti" con il tuo account la puoi fare solo
  tu: io non posso fare login. Oggi (10/10) hai già 10 messaggi contati del 9;
  il contatore è per giorno: scrivi più di 10 messaggi oggi e devono passare tutti.

## Da provare sul telefono (build 21, server nuovo)
1. Più di 10 messaggi oggi con prova1@gmail.com: nessun "limite raggiunto".
2. "Fammi una simulazione TOLC-I di 20 domande", poi rispondi con una riga "non so"
   e una saltata: Lode chiede SOLO quelle due righe; poi "Risultato: N su 20" in testa.
3. Dopo 8-10 messaggi chiedi "spiegami la domanda 7 del test": Lode la vede.
4. "alla domanda 12 ho risposto B": il punteggio si ricalcola.
5. Incolla un testo di 5-6.000 caratteri: passa.

## Note
- Il modello a volte ripete i totali nel testo nonostante l'istruzione: sono gli
  stessi numeri del codice (li copia, non li ricalcola).
- `\log_2` e pedici restano in notazione LaTeX: da valutare la conversione in ₂.
