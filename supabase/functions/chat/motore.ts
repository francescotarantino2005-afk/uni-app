// Il motore della chat: contesto dal database, chiamata al modello, scrittura
// dei messaggi e gestione dell'impegno preso a fine accoglienza. Sta fuori da
// index.ts (che tiene solo il contorno HTTP: login, tetto giornaliero,
// idempotenza, memoria) cosi' la stessa logica serve sia alla risposta a un
// messaggio sia al messaggio che la chat scrive da sola.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { malessereSerio } from '../_shared/aiuto.ts';
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

export const MAX_STORICO = 10; // ultimi messaggi passati come contesto
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
  turno: { contesto: Awaited<ReturnType<typeof costruisciContesto>>; storico: MessaggioChat[] },
  testiRecenti: string[]
): DatiStudente & { esame: EsameRiga | null } {
  const c = turno.contesto;
  const target = profiloCompleto(c.profiloStudio).esame_target;
  const precedenti = [...turno.storico].reverse().map((m) => m.contenuto);
  return {
    testo: c.testo,
    senzaVoti: c.senzaVoti,
    nomeBot: c.nomeBot,
    esame: esameInLavorazione(c.esami, [...testiRecenti, ...precedenti], target.nome ?? target.testo),
  };
}

export type NotaMemoria = Nota & { id: string; importanza?: number | null; updated_at?: string | null };
export type StoricoRiga = MessaggioChat & { created_at?: string; metadati?: unknown };

/** Quante note attive si leggono dal database: piu' di quelle che entrano nel prompt, cosi' la memoria puo' fare ordine. */
const MAX_NOTE_LETTE = 40;

/** Tutto cio' che serve per un turno: dati reali, storico breve, note di memoria, impegno. */
export async function caricaTurno(admin: SupabaseClient, clientNote: SupabaseClient, userId: string) {
  const [contesto, storicoR, noteR] = await Promise.all([
    costruisciContesto(admin, userId),
    admin
      .from('chat_messages')
      .select('ruolo, contenuto, created_at, metadati')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_STORICO),
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
  ]);
  const noteTutte = (noteR.data ?? []) as NotaMemoria[];
  return {
    contesto,
    storico: ((storicoR.data ?? []) as StoricoRiga[]).reverse(),
    // nel prompt entrano le piu' importanti e recenti; la memoria le vede tutte
    note: noteTutte.slice(0, MAX_NOTE),
    noteTutte,
    impegno: leggiImpegno(contesto.profiloStudio),
  };
}

/** Una chiamata al modello della chat. Lancia se la risposta e' vuota. */
export async function chiamaChat(
  anthropic: Anthropic,
  richiesta: ReturnType<typeof richiestaChat>,
  etichetta: string
): Promise<string> {
  // La cache da un'ora (blocco stabile) a volte richiede l'intestazione beta: se non serve e' innocua.
  const out = await anthropic.messages.create(richiesta as never, { headers: { 'anthropic-beta': 'extended-cache-ttl-2025-04-11' } });
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
    const testo = estraiTipoEsame(grezzo).testo;
    const creato = new Date().toISOString();
    const { data: riga, error } = await admin
      .from('chat_messages')
      .insert({ user_id: userId, ruolo: 'assistant', contenuto: testo, created_at: creato })
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
  formato: Formato = 'testo'
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
  const turno = await caricaTurno(admin, clientNote, userId);
  const impegno = impegnoDaMantenere(turno.impegno, Date.now()) ? turno.impegno : null;
  if (impegno) await scriviImpegno(admin, userId, { ...impegno, tentativo_il: new Date().toISOString() });
  try {
    const dati = { ...datiPerPrompt(turno, [testo]), formato };
    // L'interrogazione la guida il codice. Un malessere serio la interrompe.
    const stato = statoDaStorico(turno.storico);
    const ultimoDiLode = [...turno.storico].reverse().find((m) => m.ruolo === 'assistant')?.contenuto ?? null;
    const decisione: Decisione = malessereSerio(testo)
      ? { fase: 'nessuna', stato: stato ? { ...stato, attiva: false } : null, istruzione: '' }
      : decidi(stato, testo, ultimoDiLode, dati.esame?.materia ?? null, formato);
    const extra = [impegno ? istruzioneImpegno(impegno.testo, true) : '', decisione.istruzione].filter(Boolean).join('\n\n') || undefined;
    const etichetta = decisione.fase !== 'nessuna' ? `interrogazione:${decisione.fase}` : impegno ? 'messaggio+impegno' : 'messaggio';

    const esito = await rispostaControllata(
      (e) => chiamaChat(anthropic, richiestaChat(dati, turno.note, turno.storico, testo, e), etichetta),
      extra,
      decisione.fase
    );
    // Il segno [[tipo_esame:...]] non arriva mai allo studente; il tipo si salva
    // solo se l'ha detto lui e l'esame del libretto non ne ha già uno.
    const daSalvare = tipoDaSalvare(esito.tipo, dati.esame, testo);
    return {
      risposta: esito.risposta,
      storico: turno.storico,
      note: turno.note,
      noteTutte: turno.noteTutte,
      tipoEsame: daSalvare && dati.esame ? { esameId: dati.esame.id, tipo: daSalvare } : null,
      metadati: decisione.stato ? { interrogazione: decisione.stato } : {},
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
    console.error('Aggiornamento memoria fallito:', e);
  }
}
