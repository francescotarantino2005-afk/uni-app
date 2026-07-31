import { Piano, SessionePiano, StatoSessione } from '@/lib/tipi';
import { dataOggiIso } from '@/lib/date';

// Logica DETERMINISTICA del piano di studio — nessuna chiamata AI.
// Modello: le sessioni sono "slot" con un contenuto e uno stato.
// - 'da_fare': slot ancora da affrontare (tiene il contenuto corrente/futuro)
// - 'fatta' | 'meta' | 'saltata': slot già affrontato (storia)
// Quando salti o fai a metà una sessione, il suo contenuto SLITTA sulla prima
// sessione libera utile e a cascata; il contenuto che non entra più prima
// dell'esame è ciò che ti manda "indietro".

function ordina(sessioni: SessionePiano[]): SessionePiano[] {
  return [...sessioni].sort((a, b) =>
    (a.data + a.ora_inizio).localeCompare(b.data + b.ora_inizio)
  );
}

/** La prossima sessione da fare = il primo slot ancora 'da_fare'. */
export function prossimaSessione(piano: Piano): { sessione: SessionePiano; indice: number } | null {
  const ord = ordina(piano.sessioni);
  const i = ord.findIndex((s) => s.stato === 'da_fare');
  if (i === -1) return null;
  return { sessione: ord[i], indice: i };
}

export type Avanzamento = {
  totale: number;
  fatte: number;
  arretrate: number; // slot 'da_fare' con data già passata
  inRitardo: boolean; // più di 3 arretrate
  percentualeRaggiungibile: number; // stima onesta di quanto programma copri a questo ritmo
};

export function avanzamento(piano: Piano, oggi = dataOggiIso()): Avanzamento {
  const s = piano.sessioni;
  const totale = s.length;
  const fatte = s.filter((x) => x.stato === 'fatta').length;
  const meta = s.filter((x) => x.stato === 'meta').length;
  const daFare = s.filter((x) => x.stato === 'da_fare');
  const arretrate = daFare.filter((x) => x.data < oggi).length;
  const futuriDaFare = daFare.filter((x) => x.data >= oggi).length;

  const raggiungibili = fatte + meta * 0.5 + futuriDaFare;
  const percentualeRaggiungibile =
    totale === 0 ? 0 : Math.round((100 * Math.min(totale, raggiungibili)) / totale);

  return { totale, fatte, arretrate, inRitardo: arretrate > 3, percentualeRaggiungibile };
}

export type Esito = 'fatto' | 'meta' | 'saltata';

/**
 * Applica l'esito alla sessione all'indice dato (sull'array ORDINATO).
 * Ritorna un nuovo piano. Su "saltata"/"meta" il contenuto slitta in avanti
 * sugli slot ancora liberi; ciò che eccede oltre l'esame va perso (→ ritardo).
 */
export function applicaEsito(piano: Piano, indice: number, esito: Esito): Piano {
  const sessioni = ordina(piano.sessioni).map((s) => ({ ...s }));
  const s = sessioni[indice];
  if (!s) return piano;

  if (esito === 'fatto') {
    s.stato = 'fatta';
    return { ...piano, sessioni };
  }

  s.stato = esito === 'saltata' ? 'saltata' : 'meta';
  const reflow =
    esito === 'saltata'
      ? { argomento: s.argomento, obiettivo: s.obiettivo }
      : { argomento: s.argomento, obiettivo: `Completa la parte rimasta: ${s.obiettivo}` };

  // slot ancora 'da_fare' dopo questo, in ordine
  const futuriIdx = sessioni
    .map((x, i) => ({ x, i }))
    .filter((o) => o.i > indice && o.x.stato === 'da_fare')
    .map((o) => o.i);

  // il contenuto slittato va in testa; il resto scala; l'eccedenza si perde
  const contenuti = [reflow, ...futuriIdx.map((i) => ({ argomento: sessioni[i].argomento, obiettivo: sessioni[i].obiettivo }))];
  futuriIdx.forEach((slotI, k) => {
    if (k < contenuti.length) {
      sessioni[slotI].argomento = contenuti[k].argomento;
      sessioni[slotI].obiettivo = contenuti[k].obiettivo;
    }
  });

  return { ...piano, sessioni };
}

/** Durata in minuti di una sessione (default 45 se le ore non tornano). */
export function durataMinuti(s: SessionePiano): number {
  const [hi, mi] = s.ora_inizio.split(':').map(Number);
  const [hf, mf] = s.ora_fine.split(':').map(Number);
  const d = hf * 60 + mf - (hi * 60 + mi);
  return d > 0 ? d : 45;
}

export function etichettaStato(stato: StatoSessione): string {
  switch (stato) {
    case 'fatta':
      return 'Fatta';
    case 'meta':
      return 'A metà';
    case 'saltata':
      return 'Saltata';
    default:
      return 'Da fare';
  }
}
