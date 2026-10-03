// Quando il modello non risponde (credito esaurito, sovraccarico, rete...) la
// chat non deve rompersi: l'app mostra un normale messaggio di Lode. Qui sta la
// classificazione dell'errore, il messaggio e la riga di log riconoscibile
// (LODE_ERRORE_MODELLO). Logica PURA: la usano chat, accoglienza-dialogo, i test.

export const MESSAGGIO_BLOCCO = 'Mi sono bloccato un attimo, riprova tra qualche minuto.';

export type TipoErroreModello =
  | 'credito_esaurito'
  | 'sovraccarico'
  | 'limite_richieste'
  | 'timeout'
  | 'connessione'
  | 'autenticazione'
  | 'richiesta_non_valida'
  | 'risposta_vuota'
  | 'altro';

/** Il tipo di errore da una risposta HTTP dell'API (stato + corpo). */
export function tipoDaRisposta(stato: number, corpo: string): TipoErroreModello {
  if (/credit balance|billing|insufficient (?:funds|credit)/i.test(corpo)) return 'credito_esaurito';
  if (stato === 529 || /overloaded/i.test(corpo)) return 'sovraccarico';
  if (stato === 429) return 'limite_richieste';
  if (stato === 401 || stato === 403) return 'autenticazione';
  if (stato === 400 || stato === 404 || stato === 413) return 'richiesta_non_valida';
  if (stato >= 500) return 'sovraccarico';
  return 'altro';
}

/** Il tipo di errore da un'eccezione (SDK Anthropic, fetch, timeout). */
export function tipoErrore(e: unknown): TipoErroreModello {
  const x = (e ?? {}) as { status?: unknown; message?: unknown; name?: unknown; error?: unknown };
  const messaggio = `${typeof x.message === 'string' ? x.message : ''} ${JSON.stringify(x.error ?? '')}`;
  if (typeof x.status === 'number') return tipoDaRisposta(x.status, messaggio);
  if (/timeout|timed out|abort/i.test(`${String(x.name)} ${messaggio}`)) return 'timeout';
  if (/risposta vuota/i.test(messaggio)) return 'risposta_vuota';
  if (/credit balance/i.test(messaggio)) return 'credito_esaurito';
  if (/fetch failed|network|connection|econn|enotfound/i.test(messaggio)) return 'connessione';
  return 'altro';
}

/** La riga di log riconoscibile: LODE_ERRORE_MODELLO tipo=... contesto=... */
export function rigaErroreModello(contesto: string, tipo: TipoErroreModello, stato?: number): string {
  return `LODE_ERRORE_MODELLO tipo=${tipo} contesto=${contesto}${stato ? ` stato=${stato}` : ''}`;
}

export function logErroreModello(contesto: string, tipo: TipoErroreModello, stato?: number): void {
  console.error(rigaErroreModello(contesto, tipo, stato));
}
