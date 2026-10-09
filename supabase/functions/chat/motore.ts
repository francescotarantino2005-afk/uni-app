// Il motore della chat: contesto dal database, chiamata al modello, scrittura
// dei messaggi e gestione dell'impegno preso a fine accoglienza. Sta fuori da
// index.ts (che tiene solo il contorno HTTP: login, tetto giornaliero,
// idempotenza, memoria) cosi' la stessa logica serve sia alla risposta a un
// messaggio sia al messaggio che la chat scrive da sola.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { malessereSerio } from '../_shared/aiuto.ts';
import { logErroreModello, tipoErrore } from '../_shared/errori.ts';
import { dataOggiRoma, giornoSettimanaRoma } from '../_shared/briefing.ts';
import { type Impegno, leggiImpegno, profiloCompleto } from '../accoglienza-dialogo/profilo.ts';
import { rispostaControllata } from './controlli.ts';
import { type Decisione, decidi, statoDaStorico } from './interrogazione.ts';
import {
  type Azione,
  type NotaMemoriaRiga,
  MODELLO_MEMORIA,
  leggiOperazioni,
  pianoMemoria,
  richiestaMemoria,
} from './memoria.ts';
import {
  type DatiStudente,
  type EsameRiga,
  type Formato,
  type MessaggioChat,
  type Nota,
  type TipoEsame,
  type Uso,
  MAX_NOTE_PROMPT,
  TITOLO_NUOVA,
  titoloDa,
  MODELLO_CHAT,
  TURNO_APERTURA,
  conImpegno,
  costoUSD,
  esameInLavorazione,
  estraiTipoEsame,
  formattaContesto,
  impegnoDaMantenere,
  istruzioneImpegno,
  richiestaChat,
  testoRisposta,
  tipoDaSalvare,
} from './logica.ts';
import { formuleLeggibili } from './formule.ts';
import {
  MAX_STORICO_LETTI,
  correzioneDaStorico,
  decidiCorrezione,
  estraiChiave,
  finestraStorico,
  istruzioneCorrezione,
  istruzioneMateriale,
  leggiChiave,
  materialeAttivo,
  metadatiMateriale,
  rigaRisultato,
  testAttivo,
} from './materiali.ts';

// La cronologia si legge fino a MAX_STORICO_LETTI messaggi e poi si taglia per
// budget di token (materiali.ts): fino al 9 ottobre erano 10 messaggi fissi.
export const MAX_STORICO = MAX_STORICO_LETTI;
export const MAX_NOTE = MAX_NOTE_PROMPT; // note di memoria caricate nel prompt

/** Legge dal database i dati reali dello studente; il testo lo compone formattaContesto (logica.ts, pura). */
export async function costruisciContesto(
  admin: SupabaseClient,
  userId: string
): Promise<{ testo: string; senzaVoti: boolean; profiloStudio: unknown; nomeBot: string | null; esami: EsameRiga[] }> {
  const oggi = dataOggiRoma();
  const [profiloR, lezioniR, scadenzeR, esamiR] = await Promise.all([
    admin.from('profiles').select('nome, nome_bot, ateneo, corso, anno, fuorisede, regione, profilo_studio').eq('id', userId).maybeSingle(),
    admin.from('schedule_events').select('titolo, giorno, ora_inizio, ora_fine, aula').eq('user_id', userId).order('giorno').order('ora_inizio'),
    admin.from('deadlines').select('titolo, data, categoria').eq('user_id', userId).eq('completata', false).gte('data', oggi).order('data').limit(15),
    admin.from('exams').select('id, materia, cfu, voto, lode, idoneita, data_esame, tipo_esame').eq('user_id', userId),
  ]);

  const p = profiloR.data ?? {};
  const esami = (esamiR.data ?? []) as EsameRiga[];
  const { testo, senzaVoti } = formattaContesto({
    oggi,
    giorno: giornoSettimanaRoma(),
    profilo: p,
    lezioni: lezioniR.data ?? [],
    scadenze: scadenzeR.data ?? [],
    esami,
  });
  return { testo, senzaVoti, profiloStudio: p.profilo_studio, nomeBot: p.nome_bot ?? null, esami };
}

/**
 * I dati per il prompt di questo turno: il contesto dello studente, il nome del
 * bot e l'esame su cui si sta lavorando (dall'ultimo messaggio, poi dai
 * precedenti, poi dall'esame dichiarato all'accoglienza).
 */
export function datiPerPrompt(
  turno: { contesto: Awaited<ReturnType<typeof costruisciContesto>>; storico: MessaggioChat[]; conversazione?: Conversazione | null },
  testiRecenti: string[]
): DatiStudente & { esame: EsameRiga | null } {
  const c = turno.contesto;
  const target = profiloCompleto(c.profiloStudio).esame_target;
  const precedenti = [...turno.storico].reverse().map((m) => m.contenuto);
  // Nello spazio di un esame, l'esame e' quello (salvo che lo studente ne nomini un altro).
  const delloSpazio = turno.conversazione?.exam_id ? c.esami.find((e) => e.id === turno.conversazione?.exam_id) : null;
  return {
    testo: c.testo,
    senzaVoti: c.senzaVoti,
    nomeBot: c.nomeBot,
    esame: esameInLavorazione(c.esami, [...testiRecenti, ...precedenti], delloSpazio?.materia ?? target.nome ?? target.testo),
  };
}

/** Una conversazione della chat (tabella conversazioni). */
export type Conversazione = { id: string; exam_id: string | null; titolo: string; generale: boolean };

/**
 * La conversazione di questo turno. Con un id: quella, solo se e' dello
 * studente (altrimenti null). Senza id (le build fino alla 20): la "Generale",
 * creata se non c'e' ancora.
 */
export async function conversazioneDelTurno(
  admin: SupabaseClient,
  userId: string,
  id?: string | null
): Promise<Conversazione | null> {
  const campi = 'id, exam_id, titolo, generale';
  if (id) {
    const { data } = await admin.from('conversazioni').select(campi).eq('id', id).eq('user_id', userId).maybeSingle();
    return (data as Conversazione | null) ?? null;
  }
  const { data: esistente } = await admin.from('conversazioni').select(campi).eq('user_id', userId).eq('generale', true).maybeSingle();
  if (esistente) return esistente as Conversazione;
  const { data: nuova } = await admin
    .from('conversazioni')
    .insert({ user_id: userId, titolo: 'Generale', generale: true })
    .select(campi)
    .maybeSingle();
  if (nuova) return nuova as Conversazione;
  // creata nel frattempo da un'altra richiesta (indice unico): si rilegge
  const { data: riletta } = await admin.from('conversazioni').select(campi).eq('user_id', userId).eq('generale', true).maybeSingle();
  return (riletta as Conversazione | null) ?? null;
}

/** Dopo un messaggio: la conversazione sale in cima e, se ha ancora il titolo di default, prende il primo messaggio come titolo. */
export async function toccaConversazione(admin: SupabaseClient, conv: Conversazione, primoMessaggio: string): Promise<void> {
  const patch: Record<string, string> = { aggiornata_il: new Date().toISOString() };
  if (!conv.generale && conv.titolo === TITOLO_NUOVA) patch.titolo = titoloDa(primoMessaggio);
  const { error } = await admin.from('conversazioni').update(patch).eq('id', conv.id);
  if (error) console.error('Conversazione non aggiornata:', error);
}

export type NotaMemoria = Nota & { id: string; importanza?: number | null; updated_at?: string | null };
export type StoricoRiga = MessaggioChat & { id?: string; created_at?: string; metadati?: unknown };

/** Quante note attive si leggono dal database: piu' di quelle che entrano nel prompt, cosi' la memoria puo' fare ordine. */
const MAX_NOTE_LETTE = 40;

/** Tutto cio' che serve per un turno: dati reali, storico breve, note di memoria, impegno. */
export async function caricaTurno(
  admin: SupabaseClient,
  clientNote: SupabaseClient,
  userId: string,
  conversazione: Conversazione | null = null
) {
  // Lo storico e' quello della conversazione; nella "Generale" contano anche i
  // messaggi senza conversazione (accoglienza, coda-domande, impegno). La memoria
  // dello studente (note, profilo) resta una sola per tutte le conversazioni.
  // deno-lint-ignore no-explicit-any
  const dellaConversazione = (q: any) =>
    !conversazione ? q : conversazione.generale ? q.or(`conversazione_id.eq.${conversazione.id},conversazione_id.is.null`) : q.eq('conversazione_id', conversazione.id);
  const campi = 'id, ruolo, contenuto, created_at, metadati';
  const storicoQ = dellaConversazione(admin.from('chat_messages').select(campi).eq('user_id', userId));
  // L'ultimo materiale segnato (test, esercizi, piano), anche se e' piu' vecchio della cronologia letta.
  const materialeQ = dellaConversazione(
    admin.from('chat_messages').select(campi).eq('user_id', userId).eq('ruolo', 'assistant').not('metadati->materiale', 'is', null)
  );
  // E l'ultimo test con la chiave, che resta correggibile anche dopo altri materiali.
  const testQ = dellaConversazione(
    admin.from('chat_messages').select(campi).eq('user_id', userId).eq('ruolo', 'assistant').not('metadati->test', 'is', null)
  );
  const [contesto, storicoR, noteR, materialeR, testR] = await Promise.all([
    costruisciContesto(admin, userId),
    storicoQ.order('created_at', { ascending: false }).limit(MAX_STORICO),
    // clientNote e' il client dell'utente (RLS effettiva); il filtro su user_id
    // e' comunque esplicito.
    clientNote
      .from('note_studente')
      .select('id, categoria, contenuto, importanza, updated_at')
      .eq('user_id', userId)
      .eq('archiviata', false)
      .order('importanza', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(MAX_NOTE_LETTE),
    materialeQ.order('created_at', { ascending: false }).limit(1),
    testQ.order('created_at', { ascending: false }).limit(1),
  ]);
  const noteTutte = (noteR.data ?? []) as NotaMemoria[];
  const letti = ((storicoR.data ?? []) as StoricoRiga[]).reverse();
  // Per budget di token, con gli ultimi messaggi sempre interi.
  const storico = finestraStorico(letti);
  // Il materiale attivo: il piu' recente tra quello segnato e quello riconosciuto
  // dal testo nei messaggi letti (i messaggi di prima del 9 ottobre non hanno il segno).
  const adesso = Date.now();
  const candidati = [...((materialeR.data ?? []) as StoricoRiga[]), ...((testR.data ?? []) as StoricoRiga[]), ...letti].sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? '')
  );
  const materiale = materialeAttivo(candidati, adesso);
  const test = testAttivo(candidati, adesso);
  return {
    contesto,
    storico,
    materiale,
    /** true se il materiale attivo non e' nella cronologia mandata al modello */
    materialeFuori: !!materiale && !storico.some((m) => m.id === materiale.id),
    /** l'ultimo test con la chiave: lo corregge il codice */
    test,
    /** true se il test non e' nella cronologia ed e' diverso dal materiale attivo (allora va rimesso anche lui) */
    testFuori: !!test && test.id !== materiale?.id && !storico.some((m) => m.id === test.id),
    /** lo stato della correzione di quel test, cercato in tutta la cronologia letta (non solo nella finestra) */
    correzionePrecedente: test?.id ? correzioneDaStorico(letti, test.id) : null,
    // nel prompt entrano le piu' importanti e recenti; la memoria le vede tutte
    note: noteTutte.slice(0, MAX_NOTE),
    noteTutte,
    impegno: leggiImpegno(contesto.profiloStudio),
    conversazione,
  };
}

/** Una chiamata al modello della chat. Lancia se la risposta e' vuota. */
export async function chiamaChat(
  anthropic: Anthropic,
  richiesta: ReturnType<typeof richiestaChat>,
  etichetta: string
): Promise<string> {
  const out = await anthropic.messages.create(richiesta as never);
  const uso = (out as { usage?: Uso }).usage ?? {};
  // Una riga per chiamata: token reali e costo, per tenere d'occhio la spesa.
  console.log(
    JSON.stringify({
      evento: 'uso_chat',
      tipo: etichetta,
      modello: MODELLO_CHAT,
      input: uso.input_tokens ?? 0,
      output: uso.output_tokens ?? 0,
      cache_letti: uso.cache_read_input_tokens ?? 0,
      cache_scritti: uso.cache_creation_input_tokens ?? 0,
      usd: Number(costoUSD(MODELLO_CHAT, uso).toFixed(6)),
      fine: (out as { stop_reason?: string }).stop_reason ?? null,
    })
  );
  const testo = testoRisposta(out);
  if (!testo) throw new Error('risposta vuota');
  return testo;
}

/** Riscrive SOLO la chiave "impegno" di profilo_studio, rileggendo il profilo al momento. */
export async function scriviImpegno(admin: SupabaseClient, userId: string, impegno: Impegno): Promise<boolean> {
  const { data } = await admin.from('profiles').select('profilo_studio').eq('id', userId).maybeSingle();
  const { error } = await admin
    .from('profiles')
    .update({ profilo_studio: conImpegno(data?.profilo_studio, impegno) })
    .eq('id', userId);
  if (error) console.error('Scrittura impegno fallita:', error);
  return !error;
}

export type EsitoImpegno =
  | { stato: 'nessuno' | 'in_corso' | 'da_mantenere' }
  | { stato: 'mantenuto'; messaggio: string | null; creato_il: string | null };

/**
 * La chat scrive da sola il messaggio che MANTIENE l'impegno preso a fine
 * accoglienza. Succede una volta sola: l'impegno passa a "mantenuto". Se la
 * generazione o la scrittura falliscono resta "da_mantenere" e si riprova alla
 * prossima occasione (apertura della chat o primo messaggio dello studente).
 */
export async function mantieniImpegno(
  admin: SupabaseClient,
  clientNote: SupabaseClient,
  userId: string,
  anthropic: Anthropic
): Promise<EsitoImpegno> {
  const turno = await caricaTurno(admin, clientNote, userId);
  const impegno = turno.impegno;
  if (!impegno) return { stato: 'nessuno' };
  if (impegno.stato === 'mantenuto') {
    return { stato: 'mantenuto', messaggio: null, creato_il: impegno.mantenuto_il ?? null };
  }
  if (!impegnoDaMantenere(impegno, Date.now())) return { stato: 'in_corso' };

  // Si prenota il tentativo: chi arriva nel frattempo non ne fa partire un altro.
  await scriviImpegno(admin, userId, { ...impegno, tentativo_il: new Date().toISOString() });
  try {
    const grezzo = await chiamaChat(
      anthropic,
      richiestaChat(
        datiPerPrompt(turno, [impegno.testo]),
        turno.note,
        turno.storico,
        TURNO_APERTURA,
        istruzioneImpegno(impegno.testo, false)
      ),
      'impegno'
    );
    // il segno [[test ...]] va nei metadati, non allo studente
    const conChiave = estraiChiave(estraiTipoEsame(grezzo).testo);
    const testo = conChiave.testo;
    const creato = new Date().toISOString();
    const { data: riga, error } = await admin
      .from('chat_messages')
      .insert({ user_id: userId, ruolo: 'assistant', contenuto: testo, created_at: creato, metadati: metadatiMateriale(testo, conChiave.chiave) })
      .select('id')
      .single();
    if (error) throw error;
    await scriviImpegno(admin, userId, {
      ...impegno,
      stato: 'mantenuto',
      tentativo_il: null,
      mantenuto_il: creato,
      messaggio_id: riga?.id ?? null,
    });
    return { stato: 'mantenuto', messaggio: testo, creato_il: creato };
  } catch (e) {
    logErroreModello('chat:impegno', tipoErrore(e), (e as { status?: number })?.status);
    console.error('Impegno non mantenuto, resta da mantenere:', e);
    // Si libera la prenotazione: la prossima occasione puo' riprovare subito.
    await scriviImpegno(admin, userId, { ...impegno, tentativo_il: null });
    return { stato: 'da_mantenere' };
  }
}

/**
 * La risposta a un messaggio dello studente. Se c'e' un impegno ancora da
 * mantenere (la generazione automatica era fallita), questa stessa risposta lo
 * mantiene. L'interrogazione guidata e' decisa dal codice (interrogazione.ts).
 * Non scrive i messaggi: lo fa chi chiama, dopo i suoi controlli.
 */
export async function rispondi(
  admin: SupabaseClient,
  clientNote: SupabaseClient,
  userId: string,
  testo: string,
  anthropic: Anthropic,
  formato: Formato = 'testo',
  conversazione: Conversazione | null = null
): Promise<{
  risposta: string;
  storico: StoricoRiga[];
  note: NotaMemoria[];
  /** Tutte le note attive (anche oltre quelle del prompt): servono alla memoria per fare ordine. */
  noteTutte: NotaMemoria[];
  /** Il tipo d'esame detto dallo studente in questo messaggio, da salvare (solo se l'esame c'è e non ha già un tipo). */
  tipoEsame: { esameId: string; tipo: TipoEsame } | null;
  /** Lo stato da scrivere sul messaggio di Lode (chat_messages.metadati). */
  metadati: Record<string, unknown>;
  decisione: Decisione;
  rigenerata: boolean;
  segnaMantenuto: (id: string | null) => Promise<void>;
}> {
  const turno = await caricaTurno(admin, clientNote, userId, conversazione);
  // L'impegno dell'accoglienza si mantiene nella "Generale" (dove lo aspetta l'app).
  const impegno = impegnoDaMantenere(turno.impegno, Date.now()) && (!conversazione || conversazione.generale) ? turno.impegno : null;
  if (impegno) await scriviImpegno(admin, userId, { ...impegno, tentativo_il: new Date().toISOString() });
  try {
    const dati = { ...datiPerPrompt(turno, [testo]), formato };
    // L'interrogazione la guida il codice. Un malessere serio la interrompe.
    const stato = statoDaStorico(turno.storico);
    const ultimoDiLode = [...turno.storico].reverse().find((m) => m.ruolo === 'assistant')?.contenuto ?? null;
    const decisione: Decisione = malessereSerio(testo)
      ? { fase: 'nessuna', stato: stato ? { ...stato, attiva: false } : null, istruzione: '' }
      : decidi(stato, testo, ultimoDiLode, dati.esame?.materia ?? null, formato);
    // Il test attivo con la sua chiave: le risposte dello studente le confronta il
    // CODICE (materiali.ts). Il modello spiega gli errori ma non conta.
    const chiave = turno.test ? leggiChiave(turno.test.metadati) : null;
    const correzione =
      chiave && turno.test?.id && decisione.fase === 'nessuna' && !malessereSerio(testo)
        ? decidiCorrezione(testo, turno.test.id, chiave, turno.correzionePrecedente, formato === 'markdown')
        : ({ tipo: 'nessuna' } as const);
    if (correzione.tipo === 'conferma') {
      // Righe dubbie o mancanti: le chiede il codice, senza modello.
      if (impegno) await scriviImpegno(admin, userId, { ...impegno, tentativo_il: null });
      return {
        risposta: correzione.testo,
        storico: turno.storico,
        note: turno.note,
        noteTutte: turno.noteTutte,
        tipoEsame: null,
        metadati: { correzione: correzione.stato },
        decisione,
        rigenerata: false,
        segnaMantenuto: async () => {},
      };
    }

    const extra =
      [
        impegno ? istruzioneImpegno(impegno.testo, true) : '',
        decisione.istruzione,
        // il materiale su cui lo studente sta lavorando, anche se e' fuori dalla cronologia
        turno.materialeFuori && turno.materiale
          ? istruzioneMateriale(turno.materiale, formuleLeggibili(estraiChiave(turno.materiale.contenuto).testo))
          : '',
        // e l'ultimo test, se e' un altro e anche lui e' fuori
        turno.testFuori && turno.test ? istruzioneMateriale(turno.test, formuleLeggibili(estraiChiave(turno.test.contenuto).testo)) : '',
        correzione.tipo === 'risultato' ? istruzioneCorrezione(correzione.risultato) : '',
      ]
        .filter(Boolean)
        .join('\n\n') || undefined;
    const etichetta =
      decisione.fase !== 'nessuna'
        ? `interrogazione:${decisione.fase}`
        : correzione.tipo === 'risultato'
          ? 'correzione'
          : impegno
            ? 'messaggio+impegno'
            : 'messaggio';

    const esito = await rispostaControllata(
      (e) => chiamaChat(anthropic, richiestaChat(dati, turno.note, turno.storico, testo, e), etichetta),
      extra,
      decisione.fase
    );
    // Il segno [[tipo_esame:...]] non arriva mai allo studente; il tipo si salva
    // solo se l'ha detto lui e l'esame del libretto non ne ha già uno.
    const daSalvare = tipoDaSalvare(esito.tipo, dati.esame, testo);
    // Il segno [[test ...]] (la chiave di un test nuovo) neanche: va nei metadati.
    const conChiave = estraiChiave(esito.risposta);
    const risposta =
      correzione.tipo === 'risultato' ? `${rigaRisultato(correzione.risultato, formato === 'markdown')}\n\n${conChiave.testo}` : conChiave.testo;
    // Una correzione non e' un materiale nuovo (salvo che porti la chiave di un test nuovo).
    const materialeNuovo = conChiave.chiave || correzione.tipo !== 'risultato' ? metadatiMateriale(conChiave.testo, conChiave.chiave) : {};
    return {
      risposta,
      storico: turno.storico,
      note: turno.note,
      noteTutte: turno.noteTutte,
      tipoEsame: daSalvare && dati.esame ? { esameId: dati.esame.id, tipo: daSalvare } : null,
      metadati: {
        ...(decisione.stato ? { interrogazione: decisione.stato } : {}),
        ...materialeNuovo,
        ...(correzione.tipo === 'risultato' ? { correzione: correzione.stato } : {}),
      },
      decisione,
      rigenerata: esito.rigenerata,
      segnaMantenuto: async (id) => {
        if (!impegno) return;
        await scriviImpegno(admin, userId, {
          ...impegno,
          stato: 'mantenuto',
          tentativo_il: null,
          mantenuto_il: new Date().toISOString(),
          messaggio_id: id,
        });
      },
    };
  } catch (e) {
    if (impegno) await scriviImpegno(admin, userId, { ...impegno, tentativo_il: null });
    throw e;
  }
}

/** Salva il tipo d'esame detto dallo studente. Non sovrascrive mai un tipo già presente. */
export async function salvaTipoEsame(
  admin: SupabaseClient,
  userId: string,
  esito: { esameId: string; tipo: TipoEsame }
): Promise<void> {
  const { error } = await admin
    .from('exams')
    .update({ tipo_esame: esito.tipo })
    .eq('id', esito.esameId)
    .eq('user_id', userId)
    .is('tipo_esame', null);
  if (error) console.error('Tipo d\'esame non salvato:', error);
}

/** Applica al database (col client dello studente: RLS effettiva) le azioni decise da pianoMemoria. */
async function eseguiAzioni(clientUtente: SupabaseClient, userId: string, azioni: Azione[]): Promise<void> {
  const adesso = new Date().toISOString();
  for (const a of azioni) {
    if (a.tipo === 'inserisci') {
      await clientUtente.from('note_studente').insert({ user_id: userId, ...a.riga });
    } else if (a.tipo === 'aggiorna') {
      await clientUtente.from('note_studente').update({ ...a.patch, updated_at: adesso }).eq('id', a.id).eq('user_id', userId);
    } else {
      await clientUtente.from('note_studente').update({ archiviata: true, updated_at: adesso }).eq('id', a.id).eq('user_id', userId);
    }
  }
}

/**
 * Aggiorna la memoria dello studente dalla conversazione: una chiamata dedicata
 * (Haiku, strumento forzato) il cui esito passa dai controlli di memoria.ts.
 * Gira in background (EdgeRuntime.waitUntil): non rallenta la risposta.
 */
export async function aggiornaMemoria(
  anthropic: Anthropic,
  clientUtente: SupabaseClient,
  userId: string,
  trascrizione: string,
  note: NotaMemoriaRiga[],
  oggi?: string
): Promise<void> {
  try {
    const out = await anthropic.messages.create(richiestaMemoria(trascrizione, note, oggi) as never);
    const uso = (out as { usage?: Uso }).usage ?? {};
    console.log(
      JSON.stringify({
        evento: 'uso_memoria',
        modello: MODELLO_MEMORIA,
        input: uso.input_tokens ?? 0,
        output: uso.output_tokens ?? 0,
        usd: Number(costoUSD(MODELLO_MEMORIA, uso).toFixed(6)),
      })
    );
    await eseguiAzioni(clientUtente, userId, pianoMemoria(leggiOperazioni(out), note));
  } catch (e) {
    logErroreModello('chat:memoria', tipoErrore(e), (e as { status?: number })?.status);
    console.error('Aggiornamento memoria fallito:', e);
  }
}
