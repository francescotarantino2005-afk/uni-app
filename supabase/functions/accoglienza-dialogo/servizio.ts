// Un turno del dialogo di accoglienza, dato l'utente gia' riconosciuto: input,
// tetto anti-abuso, chiamata al modello, scrittura dei messaggi in chat, e
// l'impegno da mantenere con cui si chiude OGNI dialogo. Il contorno HTTP
// (login, CORS) sta in index.ts; le regole stanno in logica.ts.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  CHIAVI,
  type Chiave,
  type EsameElenco,
  type Impegno,
  type Messaggio,
  elaboraTurno,
  leggiGrezzo,
  impegnoDiLode,
  leggiImpegno,
  oggetto,
  profiloCompleto,
  pulisci,
  richiestaModello,
  richiestaRiprova,
} from './logica.ts';

const TIMEOUT_MS = 25_000;
const MAX_MESSAGGIO = 1000;
const MAX_CONVERSAZIONE = 14;
const MAX_ARRETRATI = 12;
const MAX_ESAMI = 60;
const CAP_MESSAGGI_24H = 60; // anti-abuso: il dialogo ne scrive una dozzina

// Quanto si aspetta che l'app salvi il profilo dopo la chiusura, prima di
// rimettere l'impegno e far partire il primo messaggio della chat.
const ATTESA_SALVATAGGIO_MS = 12_000;
const PASSO_ATTESA_MS = 400;

function dataOggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function messaggi(valore: unknown, massimo: number): Messaggio[] {
  return (Array.isArray(valore) ? valore : [])
    .slice(-massimo)
    .map((m: { ruolo?: unknown; contenuto?: unknown }) => ({
      ruolo: m?.ruolo === 'assistant' ? ('assistant' as const) : ('user' as const),
      contenuto: pulisci(m?.contenuto, MAX_MESSAGGIO),
    }))
    .filter((m: Messaggio) => m.contenuto);
}

export type EsitoServizio = {
  stato: number;
  corpo: Record<string, unknown>;
  /** lavoro da finire DOPO aver risposto (EdgeRuntime.waitUntil): null se non c'e' */
  sfondo: Promise<void> | null;
};

function esitoErrore(errore: string, stato: number): EsitoServizio {
  return { stato, corpo: { errore }, sfondo: null };
}

/**
 * Scrive SOLO la chiave "impegno" di profilo_studio, rileggendo il profilo al
 * momento. Con `sempre` = false non tocca un impegno gia' presente (l'app
 * nuova lo conserva da sola, e la chat puo' averlo gia' fatto avanzare).
 */
async function salvaImpegno(admin: SupabaseClient, userId: string, impegno: Impegno, sempre: boolean): Promise<void> {
  const { data } = await admin.from('profiles').select('profilo_studio').eq('id', userId).maybeSingle();
  if (!sempre && leggiImpegno(data?.profilo_studio)) return;
  const { error } = await admin
    .from('profiles')
    .update({ profilo_studio: { ...oggetto(data?.profilo_studio), impegno } })
    .eq('id', userId);
  if (error) console.error('Salvataggio impegno fallito:', error);
}

/** Aspetta che l'app abbia salvato la fine del dialogo (accoglienza_stato "completata"), con un tetto. */
async function attendiSalvataggio(admin: SupabaseClient, userId: string): Promise<void> {
  const fine = Date.now() + ATTESA_SALVATAGGIO_MS;
  while (Date.now() < fine) {
    const { data } = await admin.from('profiles').select('accoglienza_stato').eq('id', userId).maybeSingle();
    if (data?.accoglienza_stato === 'completata') return;
    await new Promise((r) => setTimeout(r, PASSO_ATTESA_MS));
  }
}

/**
 * Un turno del dialogo per `userId`. `mantieni` fa scrivere alla chat il
 * messaggio che mantiene l'impegno (index.ts chiama la function chat).
 */
export async function turnoServizio(
  admin: SupabaseClient,
  userId: string,
  corpo: Record<string, unknown>,
  apiKey: string,
  mantieni: () => Promise<unknown>
): Promise<EsitoServizio> {
  // 2) Input.
  const conversazione = messaggi(corpo.conversazione, MAX_CONVERSAZIONE);
  const ultimo = conversazione[conversazione.length - 1];
  const chieste = (Array.isArray(corpo.chieste) ? corpo.chieste : []).filter(
    (k: unknown, i: number, tutte: unknown[]) =>
      (CHIAVI as readonly unknown[]).includes(k) && tutte.indexOf(k) === i
  ) as Chiave[];
  if (!ultimo || ultimo.ruolo !== 'user' || chieste.length === 0) {
    return esitoErrore('RICHIESTA_NON_VALIDA', 400);
  }
  const libretto = oggetto(corpo.libretto) as {
    media?: unknown;
    cfu?: unknown;
    da_sostenere?: unknown;
  };
  const esami: EsameElenco[] = (Array.isArray(libretto.da_sostenere) ? libretto.da_sostenere : [])
    .slice(0, MAX_ESAMI)
    .map((e: { id?: unknown; materia?: unknown }) => ({
      id: typeof e?.id === 'string' ? e.id : null,
      materia: pulisci(e?.materia, 120),
    }))
    .filter((e: EsameElenco) => e.materia);
  const arretrati = messaggi(corpo.arretrati, MAX_ARRETRATI);

  // 3) Solo durante il dialogo di accoglienza, con un tetto anti-abuso.
  const { data: profilo } = await admin
    .from('profiles')
    .select('accoglienza_stato')
    .eq('id', userId)
    .maybeSingle();
  if (!String(profilo?.accoglienza_stato ?? '').startsWith('dialogo')) {
    return esitoErrore('NON_IN_DIALOGO', 409);
  }
  const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', da);
  if ((count ?? 0) >= CAP_MESSAGGI_24H) return esitoErrore('LIMITE_RAGGIUNTO', 429);

  // 4) Chiamata al modello: una per turno, con timeout.
  const input = {
    nomeBot: pulisci(corpo.nome_bot, 40) || 'Lode',
    oggi: dataOggiRoma(),
    conversazione,
    profilo: profiloCompleto(corpo.profilo_studio),
    chieste,
    esami,
    libretto: {
      media: typeof libretto.media === 'number' ? libretto.media : null,
      cfu: typeof libretto.cfu === 'number' ? libretto.cfu : 0,
    },
  };
  const controllo = new AbortController();
  const scadenza = setTimeout(() => controllo.abort(), TIMEOUT_MS);
  const chiama = async (corpo: unknown) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controllo.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(corpo),
    });
    if (r.ok) return leggiGrezzo(await r.json());
    console.error('Dialogo AI: risposta', r.status, (await r.text()).slice(0, 300));
    return null;
  };
  let grezzo = null;
  try {
    grezzo = await chiama(richiestaModello(input));
  } catch (e) {
    console.error('Dialogo AI fallito:', e);
    if (controllo.signal.aborted) {
      clearTimeout(scadenza);
      return esitoErrore('TIMEOUT', 504);
    }
  }
  // Senza una risposta valida del modello l'app usa il suo ripiego (testi fissi).
  if (!grezzo) {
    clearTimeout(scadenza);
    return esitoErrore('SERVIZIO_NON_DISPONIBILE', 503);
  }

  // 5) Il turno lo decide la logica: profilo, prossima domanda, battuta.
  let esito = elaboraTurno(input, grezzo);
  // Il dialogo si chiude ma il modello non ha scritto un impegno di Lode: lo si
  // richiede UNA volta; se nemmeno la seconda va bene resta quello fisso.
  if (esito.fine && esito.impegno_ripiego) {
    try {
      const riprova = await chiama(richiestaRiprova(input, grezzo));
      if (riprova && impegnoDiLode(riprova.impegno)) {
        esito = elaboraTurno(input, { ...grezzo, impegno: riprova.impegno });
      }
    } catch (e) {
      console.error('Riprova impegno fallita, resta quello fisso:', e);
    }
  }
  clearTimeout(scadenza);

  // 6) Il dialogo diventa la prima conversazione della chat. Prima i turni
  // rimasti indietro (function fallita in precedenza), senza duplicare quelli
  // gia' scritti; poi la risposta dello studente e la battuta del bot.
  const { data: recenti } = await admin
    .from('chat_messages')
    .select('ruolo, contenuto')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  const giaScritti = new Set((recenti ?? []).map((m) => `${m.ruolo}|${m.contenuto}`));
  const daScrivere: Messaggio[] = [
    ...arretrati.filter((m) => !giaScritti.has(`${m.ruolo}|${m.contenuto}`)),
    { ruolo: 'user', contenuto: ultimo.contenuto },
    { ruolo: 'assistant', contenuto: esito.risposta_bot },
  ];
  // created_at espliciti e crescenti: l'ordine di rilettura e' deterministico.
  const base = Date.now();
  const { error: erroreScrittura } = await admin.from('chat_messages').insert(
    daScrivere.map((m, i) => ({
      user_id: userId,
      ruolo: m.ruolo,
      contenuto: m.contenuto,
      created_at: new Date(base + i).toISOString(),
    }))
  );
  if (erroreScrittura) console.error('Scrittura chat fallita:', erroreScrittura);

  // 7) La promessa va mantenuta. Ogni chiusura ha un impegno: lo si salva
  // subito nel profilo ("da_mantenere") e, SENZA far aspettare la battuta di
  // chiusura, parte in background il primo messaggio della chat.
  let sfondo: Promise<void> | null = null;
  // Un malessere serio chiude il dialogo SENZA impegno: l'accoglienza e' finita e
  // la chat non scrive nessun messaggio automatico.
  if (esito.malessere) {
    const { error } = await admin.from('profiles').update({ accoglienza_stato: 'completata' }).eq('id', userId);
    if (error) console.error('Chiusura per malessere: stato non salvato:', error);
  }
  const impegno = esito.fine && !esito.malessere ? esito.profilo.impegno ?? null : null;
  if (impegno) {
    await salvaImpegno(admin, userId, impegno, true);
    sfondo = (async () => {
      try {
        // L'app salva il profilo subito dopo questa risposta, e le versioni
        // gia' installate riscrivono profilo_studio senza la chiave
        // "impegno": si aspetta quel salvataggio e la si rimette.
        await attendiSalvataggio(admin, userId);
        await salvaImpegno(admin, userId, impegno, false);
        await mantieni();
      } catch (e) {
        // Non si perde: resta "da_mantenere" e lo mantiene la chat alla prima
        // apertura o al primo messaggio dello studente.
        console.error('Impegno non mantenuto in background:', e);
      }
    })();
  }

  return {
    stato: 200,
    corpo: {
      risposta_bot: esito.risposta_bot,
      profilo_studio: esito.profilo,
      chieste: esito.chieste,
      prossima_chiave: esito.prossima_chiave,
      fine: esito.fine,
      // L'app apre la chat quando "aiuto" e' vero: ogni chiusura con un impegno
      // porta in chat, dove arriva il messaggio che lo mantiene.
      aiuto: esito.aiuto || !!impegno,
      urgente: esito.urgente === true,
      malessere: esito.malessere === true,
      messaggi_salvati: !erroreScrittura,
    },
    sfondo,
  };
}
