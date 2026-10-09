# Lavoro in corso — aggiornamento 1.0.1 (9 ottobre 2026)

## Stato
- **Build iOS 21 (1.0.1)** lanciata su EAS con invio automatico ad App Store Connect (TestFlight).
  Build: https://expo.dev/accounts/tara7/projects/assistente-studente/builds/9e2a2c43-de81-42a7-abb6-e94d91a302b1
  Invio: https://expo.dev/accounts/tara7/projects/assistente-studente/submissions/39f55146-e91a-41c5-bc83-11ccb2e0f053
  NON inviata in revisione: lo fa Francesco dopo la prova sul telefono.
- `npm test` 165/165. Tutto committato e pubblicato su GitHub (resta fuori solo `eas.json`, con le modifiche fatte da EAS: ambiente "production" nel profilo preview e la chiave ASC per l'invio).

## Fatto il 9 ottobre
1. PROVE DAL VIVO (la vecchia lista "DA FARE CON CREDITO"): tutte fatte, 0,32 USD. Dettagli in `docs/prova-dal-vivo-2026-10-09.md`.
   - cache: OK; cache da 1 ora verificata e attivata (senza intestazione beta).
   - interrogazione di Diritto: OK (4 domande, nessun voto anticipato, "Voto: 21/30").
   - malessere: OK (niente esercizi, solo recapiti consentiti, 112 solo col pericolo).
   - formule: il modello scriveva `x^(3/2)` → corretto (`chat/formule.ts` + istruzione), riprovato OK.
   - errore del modello: OK ("Mi sono bloccato un attimo…" + `LODE_ERRORE_MODELLO`).
   - `chat` v19 pubblicata e registrata (13 file identici al repo). `prova-modello` di nuovo spenta (410).
2. ICONA: rifatta dall'originale ad alta risoluzione (`assets/images/pose/guarda.png`), uguale all'allegato (differenza media ~4/255), sfondo blu notte radiale #241654 → #1E1347, 1024×1024 RGB senza alfa. Anche adaptive icon Android (sfondo uguale, `backgroundColor` #1E1347 in app.json).
3. ASPETTO DELLA CHAT: EB Garamond 19, formule Source Serif 4 al 92%, colori #6B3FF5 / #CDBDFD / #FCFAFF / #221C36, Markdown leggero (`lib/markdown.ts`), robot accanto all'ultima risposta con le pose (`lib/posaRisposta.ts`, `components/AvatarLode.tsx`). L'app nuova chiede `formato: 'markdown'`; le build vecchie restano su testo. Messaggi lunghi: giorni del piano in grassetto in testa a ogni blocco (provato col modello vero).
4. SPAZI PER ESAME: tabella `conversazioni` (RLS verificata: ognuno vede/gestisce solo le sue, la "Generale" non si elimina, esame altrui rifiutato), `chat_messages.conversazione_id` facoltativo, 93 messaggi di 13 studenti nella loro "Generale" (migrazione `20261009172726_conversazioni.sql`, nessuna cancellazione). La chat usa la conversazione richiesta o la "Generale" (build vecchie). Memoria condivisa. Barra laterale (`components/BarraConversazioni.tsx`): gruppi per esame, Nuova chat, rinomina, elimina con conferma; icona + scorrimento dal bordo sinistro. Provata sul web con dati finti (la parte con login va provata sul telefono).
5. ELIMINA ACCOUNT: la cancellazione a cascata arriva anche alle conversazioni (verificato in una transazione annullata sull'account di prova: profilo, conversazioni, messaggi, note, esami a zero; poi tutto rimesso com'era). `elimina-account` invariata.

## Bloccato in attesa di Francesco
- Cancellare la function `prova-modello` dalla dashboard Supabase (il collegamento non ha il comando, la CLI non ha il token). È spenta (410).
- Provare "Elimina account" dal telefono con un account creato apposta (io non posso creare account).
- Le prove con login (vedi la lista "Da provare sul telefono" qui sotto).

## Da provare sul telefono (build 21)
1. Icona nuova sulla schermata Home.
2. Chat Generale: lo storico di prima c'è tutto; scrivi un messaggio, la risposta arriva in Garamond col robot accanto (pensa → guarda).
3. Chiedi "mi fai un piano per l'esame tra 6 giorni": i giorni in grassetto in testa ai blocchi.
4. Chiedi un esercizio con formule: niente ^ né *.
5. Barra laterale (icona in alto a sinistra e scorrimento dal bordo): Nuova chat dentro un esame, scrivi, il titolo prende il primo messaggio; rinomina; elimina con conferma.
6. Interrogazione ("interrogami su …"): 4 domande, poi "Voto: NN/30"; con 28+ il robot esulta.
7. Tastiera: il campo di testo resta visibile sopra la tastiera.
8. Elimina account su un account di prova creato apposta.

## Note per il revisore Apple (cambiato rispetto alla 1.0)
Nuova icona; nuovo aspetto della chat; conversazioni separate per esame nella chat (barra laterale). Nessun nuovo permesso, nessun login nuovo, nessun acquisto. L'eliminazione dell'account resta in Impostazioni e cancella anche le conversazioni.
