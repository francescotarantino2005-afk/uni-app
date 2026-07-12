import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type LezioneEstratta = {
  titolo: string;
  giorno: number;
  ora_inizio: string;
  ora_fine: string | null;
  aula: string | null;
};

const MESSAGGI: Record<string, string> = {
  FOTO_ILLEGGIBILE:
    "Non riesco a leggere l'orario da questa foto. Prova con una più nitida e ben illuminata — o inserisci le lezioni a mano dalla tab Orario.",
  LIMITE_RAGGIUNTO:
    'Hai usato tutte le estrazioni di oggi: riprova domani, o inserisci le lezioni a mano.',
  TIMEOUT: 'La lettura sta impiegando troppo: riprova tra qualche secondo.',
  SERVIZIO_OCCUPATO: 'Il servizio è affollato in questo momento: riprova tra poco.',
  IMMAGINE_TROPPO_GRANDE: 'La foto è troppo pesante: riprova scattandola di nuovo.',
  NON_AUTORIZZATO: 'Sessione scaduta: esci e accedi di nuovo.',
};

const ERRORE_GENERICO = 'Qualcosa è andato storto durante la lettura. Riprova tra poco.';
const ERRORE_RETE = 'Sembra che tu sia offline: controlla la connessione e riprova.';

/** Manda la foto alla Edge Function estrai-orario e ritorna le lezioni estratte. */
export async function estraiOrarioDaFoto(
  base64: string,
  tipo: string
): Promise<{ lezioni: LezioneEstratta[] | null; errore: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('estrai-orario', {
      body: { immagine: base64, media_type: tipo },
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const corpo = await error.context.json().catch(() => null);
        const codice = corpo?.errore as string | undefined;
        return { lezioni: null, errore: (codice && MESSAGGI[codice]) || ERRORE_GENERICO };
      }
      return { lezioni: null, errore: ERRORE_RETE };
    }

    const lezioni = (data?.lezioni ?? []) as LezioneEstratta[];
    if (!lezioni.length) {
      return { lezioni: null, errore: MESSAGGI.FOTO_ILLEGGIBILE };
    }
    return { lezioni, errore: null };
  } catch {
    return { lezioni: null, errore: ERRORE_RETE };
  }
}
