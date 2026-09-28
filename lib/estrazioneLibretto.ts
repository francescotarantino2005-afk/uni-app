import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { FotoOrario } from '@/store/useAppStore';

/** Esito letto per una riga del libretto. */
export type EsitoLetto = 'voto' | 'idoneita' | 'nessun_esito';

/**
 * Un esame come l'ha letto estrai-libretto. Ogni campo che non si legge è null:
 * con esito "voto" e voto null lo studente deve completarlo nella conferma.
 */
export type EsameEstratto = {
  materia: string;
  esito: EsitoLetto;
  voto: number | null;
  lode: boolean;
  cfu: number | null;
  /** ISO "AAAA-MM-GG" */
  data_esame: string | null;
};

export const MAX_FOTO_LIBRETTO = 8;

const MESSAGGI: Record<string, string> = {
  FOTO_ILLEGGIBILE:
    'Non riesco a leggere il libretto da queste foto. Prova con foto più nitide e ben illuminate, una pagina per foto.',
  LIMITE_RAGGIUNTO:
    'Hai usato tutte le letture di oggi: riprova domani, o aggiungi gli esami a mano dal Libretto.',
  TIMEOUT: 'La lettura sta impiegando troppo: riprova con meno foto alla volta.',
  SERVIZIO_OCCUPATO: 'Il servizio è affollato in questo momento: riprova tra poco.',
  IMMAGINE_TROPPO_GRANDE: 'Le foto sono troppo pesanti tutte insieme: togline qualcuna e riprova.',
  TROPPE_FOTO: `Al massimo ${MAX_FOTO_LIBRETTO} foto per volta: togline qualcuna e riprova.`,
  NON_AUTORIZZATO: 'Sessione scaduta: esci e accedi di nuovo.',
};

const ERRORE_GENERICO = 'Qualcosa è andato storto durante la lettura. Riprova tra poco.';
const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';

/** Manda tutte le foto in una sola chiamata a estrai-libretto e ritorna gli esami letti. */
export async function estraiLibrettoDaFoto(
  foto: FotoOrario[]
): Promise<{ esami: EsameEstratto[] | null; errore: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('estrai-libretto', {
      body: { immagini: foto.map((f) => ({ immagine: f.base64, media_type: f.tipo })) },
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const corpo = await error.context.json().catch(() => null);
        const codice = corpo?.errore as string | undefined;
        return { esami: null, errore: (codice && MESSAGGI[codice]) || ERRORE_GENERICO };
      }
      return { esami: null, errore: ERRORE_RETE };
    }

    const esami = (data?.esami ?? []) as EsameEstratto[];
    if (!esami.length) {
      return { esami: null, errore: MESSAGGI.FOTO_ILLEGGIBILE };
    }
    return { esami, errore: null };
  } catch {
    return { esami: null, errore: ERRORE_RETE };
  }
}
