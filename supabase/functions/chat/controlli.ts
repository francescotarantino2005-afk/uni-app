// I controlli sulle risposte della chat, puri (niente rete): numeri di telefono
// non ammessi e, durante l'interrogazione, voti anticipati o soluzioni rivelate.
// Se una risposta non passa, il server la rigenera UNA volta con un richiamo; se
// ricapita toglie le frasi incriminate. Li usa chat/motore.ts; li copre
// test/correzioni.test.mjs.
import { TELEFONO_AMICO, senzaTelefoniNonAmmessi, telefoniNonAmmessi } from '../_shared/aiuto.ts';
import { type Fase, anticipaVoto, contieneVoto, senzaVoti, spiegaSoluzione } from './interrogazione.ts';
import { estraiTipoEsame } from './logica.ts';

export type Problema = 'voto' | 'soluzione' | 'telefono' | 'chiusura_senza_voto';

/** I problemi di una risposta: voto e soluzione contano solo nei turni di domanda, il telefono sempre. */
export function diagnosi(risposta: string, fase: Fase): Problema[] {
  const p: Problema[] = [];
  if (fase === 'inizio' || fase === 'domanda') {
    if (anticipaVoto(risposta)) p.push('voto');
    if (spiegaSoluzione(risposta)) p.push('soluzione');
  }
  // La chiusura dell'interrogazione deve dare il voto: se il modello continua a fare domande non e' una chiusura.
  if (fase === 'chiusura' && !contieneVoto(risposta)) p.push('chiusura_senza_voto');
  if (telefoniNonAmmessi(risposta).length > 0) p.push('telefono');
  return p;
}

/** Il richiamo da dare al modello per i problemi trovati. */
export function richiamo(problemi: Problema[], risposta: string): string {
  const parti: string[] = [];
  if (problemi.includes('voto') || problemi.includes('soluzione')) {
    const cosa = [
      problemi.includes('voto') ? 'anticipava un voto' : '',
      problemi.includes('soluzione') ? 'dava o spiegava la risposta giusta, o era troppo lunga' : '',
    ]
      .filter(Boolean)
      .join(' e ');
    parti.push(
      `RICHIAMO: la risposta che hai appena scritto ${cosa}. Riscrivila: durante l'interrogazione NON dai la risposta giusta, NON spieghi, NON anticipi voti o giudizi numerici. Al massimo una frase neutra sull'incompletezza, poi la domanda. Massimo due frasi in tutto.`
    );
  }
  if (problemi.includes('chiusura_senza_voto')) {
    parti.push(
      `RICHIAMO: la risposta che hai appena scritto non chiude l'interrogazione. Questo messaggio è il GIUDIZIO FINALE: comincia con "Voto: NN/30", poi cosa ha funzionato, cosa mancava per il voto successivo, le risposte giuste, su cosa lavorare. Nessuna altra domanda d'esame.`
    );
  }
  if (problemi.includes('telefono')) {
    parti.push(
      `RICHIAMO: la risposta che hai appena scritto conteneva numeri di telefono non ammessi (${telefoniNonAmmessi(risposta).join(', ')}). Riscrivila togliendoli. I soli recapiti che puoi scrivere sono ${TELEFONO_AMICO} e il 112, esattamente così: mai numeri, orari o servizi presi dalla memoria.`
    );
  }
  return parti.join('\n');
}

/** Ultima difesa dopo la rigenerazione: via le frasi con numeri non ammessi e, in domanda, con voti. */
export function ripulisci(risposta: string, fase: Fase): string {
  let r = senzaTelefoniNonAmmessi(risposta);
  if (fase === 'inizio' || fase === 'domanda') r = senzaVoti(r);
  return r.trim() || risposta;
}

export type EsitoRisposta = {
  risposta: string;
  /** tipo d'esame segnato dal modello */
  tipo: ReturnType<typeof estraiTipoEsame>['tipo'];
  /** true se si e' dovuto rigenerare (una volta sola) */
  rigenerata: boolean;
  /** i problemi della prima stesura */
  problemiPrima: Problema[];
  /** i problemi rimasti dopo la rigenerazione (poi tolti con ripulisci) */
  problemiDopo: Problema[];
};

/**
 * Una risposta controllata: se contiene un voto o la soluzione (durante
 * l'interrogazione) o numeri di telefono non ammessi, il server la rigenera UNA
 * volta con un richiamo; se ricapita, toglie le frasi incriminate.
 */
export async function rispostaControllata(
  genera: (extra?: string) => Promise<string>,
  extra: string | undefined,
  fase: Fase
): Promise<EsitoRisposta> {
  const prima = estraiTipoEsame(await genera(extra));
  const problemiPrima = diagnosi(prima.testo, fase);
  let { testo: risposta, tipo } = prima;
  let rigenerata = false;
  if (problemiPrima.length) {
    try {
      const seconda = estraiTipoEsame(
        await genera(
          [extra, `La tua risposta precedente era: «${prima.testo}»`, richiamo(problemiPrima, prima.testo)]
            .filter(Boolean)
            .join('\n\n')
        )
      );
      risposta = seconda.testo;
      tipo = seconda.tipo ?? tipo;
      rigenerata = true;
    } catch (e) {
      console.error('Rigenerazione fallita, si ripulisce la prima risposta:', e);
    }
  }
  const problemiDopo = diagnosi(risposta, fase);
  if (problemiDopo.length) risposta = ripulisci(risposta, fase);
  return { risposta, tipo, rigenerata, problemiPrima, problemiDopo };
}
