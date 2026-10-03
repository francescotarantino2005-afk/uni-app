// Gli aiuti di Lode quando lo studente sta male: i recapiti (gli unici che si
// possono scrivere), il controllo dei numeri di telefono, il riconoscimento di
// un malessere serio. Logica PURA: la usano chat, accoglienza-dialogo e i test.
// I recapiti sono quelli del manuale (sezione 7): se cambiano, cambiano in
// tutti e due i posti.

export const TELEFONO_AMICO =
  'Telefono Amico Italia: 02 2327 2327 (tutti i giorni, dalle 10 alle 24) o in chat su WhatsApp al 324 011 7252';
export const COUNSELING = 'il servizio di counseling psicologico gratuito del tuo ateneo';

/** Le cifre dei soli numeri ammessi (112 e' d'emergenza e si scrive a parte). */
const AMMESSI = ['0223272327', '3240117252'];

// Numeri in forma di telefono: 6-13 cifre, con spazi, punti o trattini, che
// iniziano per 0, 3, 8 o +. Le date e i numeri qualunque di un esercizio non contano.
const TELEFONO = /(?:\+\s?\d{1,3}[\s.-]?)?\d(?:[\s.-]?\d){5,12}/g;
const DATA = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;
// Numeri brevi di servizi ("chiama il 1522"): fuori dal 112 non si scrivono.
const BREVE = /\b(?:chiama(?:re)?|telefona(?:re)?|numero|linea)\s+(?:il\s+|al\s+|l')?(?:numero\s+)?(\d{3,5})\b/gi;

/** I numeri di telefono del testo che non sono quelli ammessi. */
export function telefoniNonAmmessi(testo: string): string[] {
  const fuori: string[] = [];
  for (const m of testo.matchAll(TELEFONO)) {
    const grezzo = m[0].trim();
    if (DATA.test(grezzo)) continue;
    const cifre = grezzo.replace(/\D/g, '');
    if (cifre.length < 6 || cifre.length > 13) continue;
    // senza prefisso si guarda l'inizio (0, 3, 8); con il + e' sempre un telefono
    const nazionale = grezzo.startsWith('+') ? cifre.replace(/^39/, '') : cifre.replace(/^0039/, '');
    if (!grezzo.startsWith('+') && !/^[038]/.test(nazionale)) continue;
    if (!AMMESSI.includes(nazionale)) fuori.push(grezzo);
  }
  for (const m of testo.matchAll(BREVE)) if (m[1] !== '112') fuori.push(m[1]);
  return fuori;
}

/** Il testo senza le frasi che contengono un numero di telefono non ammesso. */
export function senzaTelefoniNonAmmessi(testo: string): string {
  if (telefoniNonAmmessi(testo).length === 0) return testo;
  return testo
    .split('\n')
    .map((riga) =>
      riga
        .split(/(?<=[.!?])\s+/)
        .filter((frase) => telefoniNonAmmessi(frase).length === 0)
        .join(' ')
    )
    .filter((riga, i, tutte) => riga.trim() !== '' || (i > 0 && tutte[i - 1].trim() !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Malessere serio, nei termini della sezione 7 del manuale: disperazione "con
// tutto", farsi del male. L'ansia da esame, lo stress, "sono messo male con la
// preparazione" NON ci sono: restano difficolta' di studio.
const MALESSERE =
  /\bnon ce la faccio\b[^.?!]{0,60}\bcon tutto\s*(?:[.,!?…]|$|questo)|\bnon ne posso pi[uù] di (?:tutto|niente)\b|\bnon (?:voglio|riesco) pi[uù] (?:vivere|andare avanti)\b|\bfarmi del male\b|\bfarla finita\b|\bvorrei (?:sparire|morire)\b|\bautolesion|\bsuicid/i;
const PERICOLO = /\bfarmi del male\b|\bfarla finita\b|\bnon voglio pi[uù] vivere\b|\bvorrei morire\b|\bautolesion|\bsuicid/i;

/** Il messaggio dice, a parole, un malessere serio? (Il modello lo segnala a parte: decide il codice.) */
export function malessereSerio(messaggio: string): boolean {
  return MALESSERE.test(messaggio);
}

/** Parla di farsi del male: allora serve anche il 112. */
export function pericoloImmediato(messaggio: string): boolean {
  return PERICOLO.test(messaggio);
}

/** La risposta calda e fissa di chiusura: i recapiti sono sempre quelli esatti. */
export function rispostaDiAiuto(reazione: string, pericolo: boolean): string {
  return [
    reazione.trim(),
    `Non devi reggere tutto da solo: c'è ${COUNSELING}, e puoi contare su ${TELEFONO_AMICO}.`,
    pericolo ? 'Se in questo momento sei in pericolo, chiama il 112.' : '',
    'Io resto qui, senza fretta.',
  ]
    .filter(Boolean)
    .join(' ');
}
