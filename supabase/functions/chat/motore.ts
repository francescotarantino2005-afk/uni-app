// Il motore della chat: contesto dal database, chiamata al modello, scrittura
// dei messaggi e gestione dell'impegno preso a fine accoglienza. Sta fuori da
// index.ts (che tiene solo il contorno HTTP: login, tetto giornaliero,
// idempotenza, memoria) cosi' la stessa logica serve sia alla risposta a un
// messaggio sia al messaggio che la chat scrive da sola.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { dataOggiRoma, giornoSettimanaRoma } from '../_shared/briefing.ts';
import { type Impegno, leggiImpegno } from '../accoglienza-dialogo/profilo.ts';
import {
  type MessaggioChat,
  type Nota,
  type Uso,
  MODELLO_CHAT,
  TURNO_APERTURA,
  conImpegno,
  costoUSD,
  impegnoDaMantenere,
  istruzioneImpegno,
  richiestaChat,
  righeAccoglienza,
  testoRisposta,
} from './logica.ts';

export const MAX_STORICO = 10; // ultimi messaggi passati come contesto
export const MAX_NOTE = 40; // note di memoria caricate nel prompt
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

function oraBreve(o: string | null): string {
  return o ? o.slice(0, 5) : '';
}

/** Costruisce il blocco di contesto con i dati reali dello studente. */
export async function costruisciContesto(
  admin: SupabaseClient,
  userId: string
): Promise<{ testo: string; senzaVoti: boolean; profiloStudio: unknown }> {
  const oggi = dataOggiRoma();
  const [profiloR, lezioniR, scadenzeR, esamiR] = await Promise.all([
    admin.from('profiles').select('nome, ateneo, corso, anno, fuorisede, regione, profilo_studio').eq('id', userId).maybeSingle(),
    admin.from('schedule_events').select('titolo, giorno, ora_inizio, ora_fine, aula').eq('user_id', userId).order('giorno').order('ora_inizio'),
    admin.from('deadlines').select('titolo, data, categoria').eq('user_id', userId).eq('completata', false).gte('data', oggi).order('data').limit(15),
    admin.from('exams').select('materia, cfu, voto, lode, idoneita, data_esame').eq('user_id', userId),
  ]);

  const p = profiloR.data ?? {};
  const righe: string[] = [];

  righe.push(`Oggi è ${GIORNI[giornoSettimanaRoma() - 1]} (${oggi}).`);
  righe.push('--- Profilo ---');
  if (p.nome) righe.push(`Nome: ${p.nome}`);
  if (p.ateneo) righe.push(`Ateneo: ${p.ateneo}`);
  if (p.corso) righe.push(`Corso: ${p.corso}${p.anno ? `, ${p.anno}° anno` : ''}`);
  if (p.fuorisede) righe.push('È uno studente fuorisede.');
  if (p.regione) righe.push(`Regione: ${p.regione}`);
  righe.push(...righeAccoglienza(p.profilo_studio));

  const lezioni = lezioniR.data ?? [];
  righe.push('--- Orario settimanale ---');
  if (lezioni.length === 0) {
    righe.push('Nessuna lezione inserita.');
  } else {
    for (const l of lezioni) {
      righe.push(
        `${GIORNI[l.giorno - 1]}: ${l.titolo} ${oraBreve(l.ora_inizio)}${l.ora_fine ? `-${oraBreve(l.ora_fine)}` : ''}${l.aula ? ` (${l.aula})` : ''}`
      );
    }
  }

  const scadenze = scadenzeR.data ?? [];
  righe.push('--- Prossime scadenze ---');
  if (scadenze.length === 0) {
    righe.push('Nessuna scadenza in arrivo.');
  } else {
    for (const s of scadenze) {
      righe.push(`${s.data}: ${s.titolo}${s.categoria ? ` [${s.categoria}]` : ''}`);
    }
  }

  // Libretto: media ponderata (lode = 30), CFU, esami da sostenere.
  // Idoneità = superato senza voto: CFU acquisiti sì, media no.
  const esami = esamiR.data ?? [];
  const superato = (e: { voto: number | null; idoneita: boolean | null }) =>
    e.voto != null || e.idoneita === true;
  const sostenuti = esami.filter(superato);
  let sp = 0;
  let sc = 0;
  let cfu = 0;
  let lodi = 0;
  for (const e of sostenuti) {
    if (e.cfu && e.cfu > 0) {
      cfu += e.cfu;
      if (e.voto != null) {
        sp += e.voto * e.cfu;
        sc += e.cfu;
      }
    }
    if (e.lode && e.voto === 30) lodi++;
  }
  righe.push('--- Libretto ---');
  if (sostenuti.length === 0) {
    righe.push('Nessun esame verbalizzato.');
  } else {
    const media = sc > 0 ? (sp / sc).toFixed(2) : '—';
    righe.push(`Esami sostenuti: ${sostenuti.length}, CFU acquisiti: ${cfu}, media ponderata: ${media}, lodi: ${lodi}.`);
    for (const e of sostenuti) {
      righe.push(
        `- ${e.materia}: ${e.voto == null ? 'idoneità (senza voto, fuori media)' : e.voto}${e.lode && e.voto === 30 ? ' e lode' : ''}${e.cfu ? ` (${e.cfu} CFU)` : ''}${e.data_esame ? `, sostenuto il ${e.data_esame}` : ''}`
      );
    }
  }
  const daSostenere = esami.filter((e: { voto: number | null; idoneita: boolean | null }) => !superato(e));
  if (daSostenere.length) {
    righe.push(`Esami da sostenere: ${daSostenere.map((e: { materia: string }) => e.materia).join(', ')}.`);
  }

  return { testo: righe.join('\n'), senzaVoti: sostenuti.length === 0, profiloStudio: p.profilo_studio };
}

export type NotaMemoria = Nota & { id: string };

/** Tutto cio' che serve per un turno: dati reali, storico breve, note di memoria, impegno. */
export async function caricaTurno(admin: SupabaseClient, clientNote: SupabaseClient, userId: string) {
  const [contesto, storicoR, noteR] = await Promise.all([
    costruisciContesto(admin, userId),
    admin
      .from('chat_messages')
      .select('ruolo, contenuto')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_STORICO),
    // clientNote e' il client dell'utente (RLS effettiva); il filtro su user_id
    // e' comunque esplicito.
    clientNote
      .from('note_studente')
      .select('id, categoria, contenuto')
      .eq('user_id', userId)
      .eq('archiviata', false)
      .order('importanza', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(MAX_NOTE),
  ]);
  return {
    contesto,
    storico: ((storicoR.data ?? []) as MessaggioChat[]).reverse(),
    note: (noteR.data ?? []) as NotaMemoria[],
    impegno: leggiImpegno(contesto.profiloStudio),
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
    const testo = await chiamaChat(
      anthropic,
      richiestaChat(turno.contesto, turno.note, turno.storico, TURNO_APERTURA, istruzioneImpegno(impegno.testo, false)),
      'impegno'
    );
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
 * mantiene. Non scrive i messaggi: lo fa chi chiama, dopo i suoi controlli.
 */
export async function rispondi(
  admin: SupabaseClient,
  clientNote: SupabaseClient,
  userId: string,
  testo: string,
  anthropic: Anthropic
): Promise<{ risposta: string; storico: MessaggioChat[]; note: NotaMemoria[]; segnaMantenuto: (id: string | null) => Promise<void> }> {
  const turno = await caricaTurno(admin, clientNote, userId);
  const impegno = impegnoDaMantenere(turno.impegno, Date.now()) ? turno.impegno : null;
  if (impegno) await scriviImpegno(admin, userId, { ...impegno, tentativo_il: new Date().toISOString() });
  try {
    const risposta = await chiamaChat(
      anthropic,
      richiestaChat(
        turno.contesto,
        turno.note,
        turno.storico,
        testo,
        impegno ? istruzioneImpegno(impegno.testo, true) : undefined
      ),
      impegno ? 'messaggio+impegno' : 'messaggio'
    );
    return {
      risposta,
      storico: turno.storico,
      note: turno.note,
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
