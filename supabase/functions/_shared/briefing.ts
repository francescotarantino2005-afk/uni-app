// Logica condivisa dal briefing: raccolta contesto, generazione (AI o statica), invio push.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const FUSO = 'Europe/Rome'; // gli atenei sono tutti in Italia

// ---- Utility date/ora nel fuso italiano (gestisce l'ora legale) ----

export function dataOggiRoma(now = new Date()): string {
  // en-CA formatta come "AAAA-MM-GG"
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function oraOraRoma(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export function giornoSettimanaRoma(now = new Date()): number {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'long' }).format(now);
  const mappa: Record<string, number> = {
    Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
  };
  return mappa[nome] ?? 1;
}

function aggiungiGiorni(iso: string, n: number): string {
  const [a, m, g] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function oraBreve(ora: string | null): string {
  return ora ? ora.slice(0, 5) : '';
}

// ---- Raccolta del contesto della giornata ----

export type SessioneStudio = {
  materia: string;
  argomento: string;
  obiettivo: string;
  ora_inizio: string;
  oggi: boolean;
};

export type ContestoBriefing = {
  lezioniOggi: { titolo: string; ora_inizio: string; ora_fine: string | null; aula: string | null }[];
  scadenze: { titolo: string; data: string; categoria: string | null }[];
  esami: { materia: string; data_esame: string }[];
  sessione: SessioneStudio | null;
};

/** Prossima sessione di studio non fatta dal piano attivo (se esiste). */
async function prossimaSessioneStudio(
  admin: SupabaseClient,
  userId: string,
  dataOggi: string
): Promise<SessioneStudio | null> {
  const { data } = await admin
    .from('study_plans')
    .select('piano')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const piano = data?.piano as
    | { materia?: string; sessioni?: { data: string; ora_inizio: string; argomento: string; obiettivo: string; stato: string }[] }
    | undefined;
  // Nel modello deterministico "da_fare" = ancora da affrontare; gli stati
  // fatta/meta/saltata sono storia (il loro contenuto è già slittato in avanti).
  const sessioni = (piano?.sessioni ?? [])
    .filter((s) => s.stato === 'da_fare')
    .sort((a, b) => (a.data + a.ora_inizio).localeCompare(b.data + b.ora_inizio));
  const s = sessioni[0];
  if (!s) return null;
  return {
    materia: piano?.materia ?? '',
    argomento: s.argomento,
    obiettivo: s.obiettivo,
    ora_inizio: s.ora_inizio,
    oggi: s.data === dataOggi,
  };
}

export async function raccogliContesto(
  admin: SupabaseClient,
  userId: string,
  dataOggi: string,
  giorno: number
): Promise<ContestoBriefing> {
  const [lez, scad, es] = await Promise.all([
    admin
      .from('schedule_events')
      .select('titolo, ora_inizio, ora_fine, aula')
      .eq('user_id', userId)
      .eq('giorno', giorno)
      .order('ora_inizio'),
    admin
      .from('deadlines')
      .select('titolo, data, categoria')
      .eq('user_id', userId)
      .eq('completata', false)
      .gte('data', dataOggi)
      .lte('data', aggiungiGiorni(dataOggi, 7))
      .order('data'),
    admin
      .from('exams')
      .select('materia, data_esame')
      .eq('user_id', userId)
      .is('voto', null)
      .not('data_esame', 'is', null)
      .gte('data_esame', dataOggi)
      .lte('data_esame', aggiungiGiorni(dataOggi, 21))
      .order('data_esame'),
  ]);

  const sessione = await prossimaSessioneStudio(admin, userId, dataOggi);

  return {
    lezioniOggi: lez.data ?? [],
    scadenze: scad.data ?? [],
    esami: es.data ?? [],
    sessione,
  };
}

function contestoVuoto(c: ContestoBriefing): boolean {
  return (
    c.lezioniOggi.length === 0 &&
    c.scadenze.length === 0 &&
    c.esami.length === 0 &&
    c.sessione === null
  );
}

function giorniA(dataOggi: string, iso: string): number {
  const [a1, m1, g1] = dataOggi.split('-').map(Number);
  const [a2, m2, g2] = iso.split('-').map(Number);
  return Math.round(
    (Date.UTC(a2, m2 - 1, g2) - Date.UTC(a1, m1 - 1, g1)) / 86_400_000
  );
}

// ---- Briefing STATICO (nessuna chiamata AI): giornata libera o degrado grazioso ----

export function briefingGiornataLibera(): string {
  return 'Oggi niente lezioni in calendario e nessuna scadenza in vista. Giornata tua: sfruttala come vuoi. 💪';
}

/** Riassunto costruito dai soli dati, senza AI (usato in caso di errore/budget esaurito). */
export function briefingStaticoDaDati(c: ContestoBriefing, dataOggi: string): string {
  const parti: string[] = ['Ecco la tua giornata:'];
  if (c.lezioniOggi.length) {
    const l = c.lezioniOggi
      .map((x) => `${x.titolo} (${oraBreve(x.ora_inizio)}${x.aula ? `, ${x.aula}` : ''})`)
      .join('; ');
    parti.push(`Lezioni: ${l}.`);
  } else {
    parti.push('Nessuna lezione oggi.');
  }
  const prossime: string[] = [];
  for (const s of c.scadenze.slice(0, 2)) {
    const g = giorniA(dataOggi, s.data);
    prossime.push(`${s.titolo} ${g === 0 ? 'scade oggi' : g === 1 ? 'scade domani' : `tra ${g} giorni`}`);
  }
  for (const e of c.esami.slice(0, 1)) {
    const g = giorniA(dataOggi, e.data_esame);
    prossime.push(`esame di ${e.materia} tra ${g} giorni`);
  }
  if (prossime.length) parti.push(`Da tenere d'occhio: ${prossime.join('; ')}.`);
  return parti.join(' ');
}

// ---- Briefing AI ----

function promptContesto(c: ContestoBriefing, dataOggi: string): string {
  const righe: string[] = [];

  if (c.lezioniOggi.length) {
    righe.push('Lezioni di oggi:');
    for (const l of c.lezioniOggi) {
      righe.push(
        `- ${l.titolo} dalle ${oraBreve(l.ora_inizio)}${l.ora_fine ? ` alle ${oraBreve(l.ora_fine)}` : ''}${l.aula ? `, aula ${l.aula}` : ''}`
      );
    }
  } else {
    righe.push('Nessuna lezione oggi.');
  }

  if (c.scadenze.length) {
    righe.push('Scadenze entro 7 giorni:');
    for (const s of c.scadenze) {
      const g = giorniA(dataOggi, s.data);
      righe.push(`- ${s.titolo}${s.categoria ? ` (${s.categoria})` : ''}: tra ${g} giorni`);
    }
  } else {
    righe.push('Nessuna scadenza nei prossimi 7 giorni.');
  }

  if (c.esami.length) {
    righe.push('Esami entro 21 giorni:');
    for (const e of c.esami) {
      const g = giorniA(dataOggi, e.data_esame);
      righe.push(`- ${e.materia}: tra ${g} giorni`);
    }
  } else {
    righe.push('Nessun esame nei prossimi 21 giorni.');
  }

  if (c.sessione) {
    righe.push('Sessione di studio dal piano:');
    righe.push(
      `- ${c.sessione.oggi ? 'OGGI' : 'la prossima in arretrato'} alle ${oraBreve(c.sessione.ora_inizio)}: ${c.sessione.argomento} (${c.sessione.materia}) — obiettivo: ${c.sessione.obiettivo}`
    );
  }

  return righe.join('\n');
}

/** Suggerimento statico (nessuna AI): una frase con l'azione più utile per oggi. */
export function suggerimentoStatico(c: ContestoBriefing, dataOggi: string): string {
  if (c.sessione && c.sessione.oggi) {
    return `Oggi tocca ${c.sessione.argomento}: apri la sessione e parti.`;
  }
  const urgente = c.scadenze[0];
  if (urgente) {
    const g = giorniA(dataOggi, urgente.data);
    return `${urgente.titolo} ${g <= 0 ? 'scade oggi' : g === 1 ? 'scade domani' : `scade tra ${g} giorni`}: muoviti.`;
  }
  const esame = c.esami[0];
  if (esame) {
    const g = giorniA(dataOggi, esame.data_esame);
    return `Esame di ${esame.materia} tra ${g} giorni: se non hai un piano, creane uno.`;
  }
  if (c.lezioniOggi.length) {
    return 'Dopo le lezioni ritagliati un po\' di studio: anche mezz\'ora conta.';
  }
  return 'Giornata libera: portati avanti con qualcosa che rimandi da un po\'.';
}

const SYSTEM_BRIEFING = `Sei l'assistente personale di uno studente universitario italiano. Dai del tu.
Con lo strumento scrivi_briefing produci DUE cose:

1) briefing — il messaggio del mattino:
- Tono: diretto, caldo e naturale, come un amico che ti dà una mano — non una segretaria e non un post motivazionale.
- 2-3 frasi, circa 35 parole in tutto. Asciutto ma umano.
- La PRIMA frase è la cosa più importante o urgente della giornata (la lezione principale, la sessione di studio di oggi o la scadenza più vicina): è quella che si legge nell'anteprima della notifica. NON salutare e non aprire con "Buongiorno": il saluto è già nel titolo della notifica. Vai dritto al concreto (per esempio apri con la prima lezione e il suo orario).
- Copri le lezioni di oggi (orari e aule), la scadenza o l'esame più urgente e, se c'è, la sessione di studio pianificata; chiudi con una spinta.

2) suggerimento_oggi — UNA frase sola, massimo 20 parole: l'azione più utile da fare oggi, che colleghi la sessione di studio pianificata, le ore libere e le scadenze imminenti. Se c'è una sessione di studio per oggi, mettila al centro (es. "Blocco libero nel pomeriggio: fai la sessione su X e ti porti avanti").

Regole per entrambi: italiano completo e corretto, parole intere mai troncate. Nomina SOLO lezioni, scadenze, esami, orari e aule presenti nei dati qui sotto: non inventare né dedurre nulla che non sia scritto, e se una sezione dichiara che non c'è niente, non riempirla. Frasi piane e naturali. Niente gergo, niente metafore, niente intensificatori colloquiali. Scrivi come parleresti a voce a un amico, non come un post motivazionale. Niente asterischi, niente markdown, niente elenchi. Al massimo una emoji nel briefing.`;

const STRUMENTO_BRIEFING = {
  name: 'scrivi_briefing',
  description: 'Salva il briefing del mattino e il suggerimento del giorno.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['briefing', 'suggerimento_oggi'],
    properties: {
      briefing: { type: 'string', description: '2-3 frasi, circa 35 parole' },
      suggerimento_oggi: { type: 'string', description: 'una frase sola, max 20 parole' },
    },
  },
};

/**
 * Genera il briefing per un utente.
 * Ritorna { contenuto, suggerimento, usaAI } — usaAI=false se è stato usato un
 * testo statico (nessun costo AI). Non lancia mai: in caso di errore degrada allo statico.
 */
export async function generaBriefing(
  anthropic: Anthropic,
  contesto: ContestoBriefing,
  dataOggi: string
): Promise<{ contenuto: string; suggerimento: string; usaAI: boolean }> {
  if (contestoVuoto(contesto)) {
    return {
      contenuto: briefingGiornataLibera(),
      suggerimento: suggerimentoStatico(contesto, dataOggi),
      usaAI: false,
    };
  }

  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: SYSTEM_BRIEFING,
      tools: [STRUMENTO_BRIEFING],
      tool_choice: { type: 'tool', name: 'scrivi_briefing' },
      messages: [{ role: 'user', content: promptContesto(contesto, dataOggi) }],
    });
    const blocco = risposta.content.find((b) => b.type === 'tool_use');
    const out = blocco?.input as { briefing?: string; suggerimento_oggi?: string } | undefined;
    const testo = (out?.briefing ?? '').trim();
    const sugg = (out?.suggerimento_oggi ?? '').trim();
    if (!testo) throw new Error('risposta vuota');
    return {
      contenuto: testo,
      suggerimento: sugg || suggerimentoStatico(contesto, dataOggi),
      usaAI: true,
    };
  } catch (e) {
    // Degrado grazioso: budget esaurito / errore rete / servizio occupato.
    console.error('Briefing AI fallito, uso statico:', e);
    return {
      contenuto: briefingStaticoDaDati(contesto, dataOggi),
      suggerimento: suggerimentoStatico(contesto, dataOggi),
      usaAI: false,
    };
  }
}

// ---- Invio push tramite Expo Push API ----

type Messaggio = { to: string; title: string; body: string; data: Record<string, unknown> };

/**
 * Invia una push a tutti i token dati. Ritorna i token non più validi
 * (DeviceNotRegistered), da rimuovere dal DB.
 */
export async function inviaPush(
  tokens: string[],
  titolo: string,
  corpo: string
): Promise<{ tokenDaRimuovere: string[] }> {
  if (tokens.length === 0) return { tokenDaRimuovere: [] };

  const messaggi: Messaggio[] = tokens.map((t) => ({
    to: t,
    title: titolo,
    body: corpo,
    data: { tipo: 'briefing' },
  }));

  const tokenDaRimuovere: string[] = [];
  try {
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messaggi),
    });
    const esito = await resp.json();
    const tickets: { status: string; details?: { error?: string } }[] = esito?.data ?? [];
    tickets.forEach((tk, i) => {
      if (tk.status === 'error' && tk.details?.error === 'DeviceNotRegistered') {
        tokenDaRimuovere.push(tokens[i]);
      }
    });
  } catch (e) {
    console.error('Invio Expo Push fallito:', e);
  }
  return { tokenDaRimuovere };
}

export async function tokenPushUtente(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  return (data ?? []).map((r: { token: string }) => r.token);
}
