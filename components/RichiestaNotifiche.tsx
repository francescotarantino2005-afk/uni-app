import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { pose } from '@/lib/pose';
import { programmaBriefingLocale, richiediPermessoNotifiche, salvaTokenPush } from '@/lib/notifiche';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { colori, raggi, spazi } from '@/lib/theme';

/**
 * La richiesta del permesso per le notifiche. Compare UNA volta, quando lo
 * studente aggiunge la sua prima scadenza (lo decide lo store): prima il bot
 * spiega a cosa serve, poi, solo se lo studente dice di sì, parte la richiesta
 * del sistema. Va montato una volta sola, nel layout radice.
 */
export function RichiestaNotifiche() {
  const visibile = useAppStore((s) => s.richiestaNotifiche);
  const chiudi = useAppStore((s) => s.chiudiRichiestaNotifiche);
  const utente = useAppStore((s) => s.utente);
  const oraBriefing = useAppStore((s) => s.profilo?.ora_briefing);
  const nomeBot = useAppStore((s) => s.profilo?.nome_bot ?? 'Lode');
  const [inCorso, setInCorso] = useState(false);

  if (!visibile) return null;

  const accetta = async () => {
    setInCorso(true);
    try {
      const concesso = await richiediPermessoNotifiche();
      if (concesso) {
        // Il promemoria del mattino, all'ora già scelta nel profilo.
        await programmaBriefingLocale((oraBriefing ?? '07:30').slice(0, 5));
        if (utente) await salvaTokenPush(utente.id); // best effort
      }
    } finally {
      setInCorso(false);
      chiudi();
    }
  };

  return (
    <View style={stili.velo}>
      <View style={stili.card}>
        <Image source={pose.guarda} style={stili.personaggio} resizeMode="contain" />
        <Text style={stili.titolo}>Te la ricordo io?</Text>
        <Text style={stili.testo}>
          Hai segnato la tua prima scadenza. Se mi dai il permesso per le notifiche, ogni mattina{' '}
          {nomeBot} ti avvisa di quello che scade e delle lezioni del giorno, così non devi ricordarti
          di aprire l'app.
        </Text>
        <BottonePrimario etichetta="Sì, avvisami" onPress={accetta} caricamento={inCorso} />
        <Pressable onPress={chiudi} disabled={inCorso} hitSlop={8}>
          <Text style={stili.rifiuta}>Non adesso</Text>
        </Pressable>
      </View>
    </View>
  );
}

const stili = StyleSheet.create({
  velo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spazi.lg,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colori.superficie,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    gap: spazi.md,
  },
  personaggio: {
    width: 150,
    height: 150,
    alignSelf: 'center',
  },
  titolo: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  testo: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  rifiuta: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spazi.xs,
  },
});
