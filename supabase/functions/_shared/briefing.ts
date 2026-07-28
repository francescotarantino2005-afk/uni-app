// Logica condivisa dal briefing: raccolta contesto, generazione (AI o statica), invio push.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const FUSO = 'Europe/Rome'; // gli atenei sono tutti in Italia
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

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

export type ContestoBriefing = {
  lezioniOggi: { titolo: string; ora_inizio: string; ora_fine: string | null; aula: string | null }[];
  scadenze: { titolo: string; data: string; categoria: string | null }[];
  esami: { materia: string; data_esame: string }[];
};

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

  return {
    lezioniOggi: lez.data ?? [],
    scadenze: scad.data ?? [],
    esami: es.data ?? [],
  };
}

function contestoVuoto(c: ContestoBriefing): boolean {
  return c.lezioniOggi.length === 0 && c.scadenze.length === 0 && c.esami.length === 0;
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
  return 'Buongiorno! Oggi niente lezioni in calendario e nessuna scadenza in vista. Giornata tua: sfruttala come vuoi. 💪';
}

/** Riassunto costruito dai soli dati, senza AI (usato in caso di errore/budget esaurito). */
export function briefingStaticoDaDati(c: ContestoBriefing, dataOggi: string): string {
  const parti: string[] = ['Buongiorno! Ecco la tua giornata:'];
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

function promptContesto(c: ContestoBriefing, dataOggi: string, giorno: number): string {
  const righe: string[] = [`Oggi è ${GIORNI[giorno - 1]}.`];

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
  }

  if (c.esami.length) {
    righe.push('Esami entro 21 giorni:');
    for (const e of c.esami) {
      const g = giorniA(dataOggi, e.data_esame);
      righe.push(`- ${e.materia}: tra ${g} giorni`);
    }
  }

  return righe.join('\n');
}

const SYSTEM_BRIEFING = `Sei l'assistente personale di uno studente universitario italiano. Scrivi il briefing del mattino, dando del tu.
Tono: un amico sveglio e in gamba, non una segretaria. Diretto, caldo, un pizzico di grinta. Zero burocratese.

Regole ferree:
- 2-3 frasi, circa 35 parole in tutto. Asciutto ma umano.
- La PRIMA frase è la cosa più importante o urgente della giornata (la lezione principale o la scadenza più vicina): è quella che si legge nell'anteprima della notifica. Se saluti, fallo nella stessa frase (es. "Buongiorno! Oggi Analisi alle 10 in aula T4"), non sprecarci una frase intera.
- Italiano completo e corretto: parole intere, mai troncate o abbreviate.
- Testo semplice: niente asterischi, niente markdown, niente elenchi puntati, frasi scorrevoli. Al massimo una emoji.
Copri le lezioni di oggi (orari e aule) e la scadenza o l'esame più urgente, e chiudi con una spinta o un consiglio pratico. Rispondi SOLO col testo del briefing.`;

/**
 * Genera il briefing per un utente.
 * Ritorna { contenuto, usaAI } — usaAI=false se è stato usato un testo statico (nessun costo AI).
 * Non lancia mai: in caso di errore AI degrada al riassunto statico.
 */
export async function generaBriefing(
  anthropic: Anthropic,
  contesto: ContestoBriefing,
  dataOggi: string,
  giorno: number
): Promise<{ contenuto: string; usaAI: boolean }> {
  if (contestoVuoto(contesto)) {
    return { contenuto: briefingGiornataLibera(), usaAI: false };
  }

  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM_BRIEFING,
      messages: [{ role: 'user', content: promptContesto(contesto, dataOggi, giorno) }],
    });
    const testo = risposta.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();
    if (!testo) throw new Error('risposta vuota');
    return { contenuto: testo, usaAI: true };
  } catch (e) {
    // Degrado grazioso: budget esaurito / errore rete / servizio occupato.
    console.error('Briefing AI fallito, uso statico:', e);
    return { contenuto: briefingStaticoDaDati(contesto, dataOggi), usaAI: false };
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
