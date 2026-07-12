import { supabase } from '@/lib/supabase';
import { Briefing } from '@/lib/tipi';
import { dataOggiIso } from '@/lib/date';

/** Il briefing di oggi, se già generato dal cron. */
export async function caricaBriefingOggi(): Promise<Briefing | null> {
  const { data } = await supabase
    .from('briefings')
    .select('*')
    .eq('data', dataOggiIso())
    .maybeSingle();
  return (data as Briefing) ?? null;
}

/**
 * Chiede al server di generare e inviare SUBITO un briefing di prova
 * (usa il modello AI vero, sui dati reali dell'utente). Per il test dalla dev build.
 */
export async function inviaBriefingProva(): Promise<{ contenuto: string | null; errore: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('invia-briefing', {
      body: { prova: true },
    });
    if (error) {
      return { contenuto: null, errore: 'Non sono riuscito a generare il briefing di prova. Riprova tra poco.' };
    }
    return { contenuto: (data?.contenuto as string) ?? null, errore: null };
  } catch {
    return { contenuto: null, errore: 'Sembra che tu sia offline: controlla la connessione e riprova.' };
  }
}
