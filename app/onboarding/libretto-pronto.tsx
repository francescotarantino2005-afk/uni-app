import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaEsami } from '@/lib/esamiDb';
import { StatoLibretto, calcolaLibretto, formattaMedia } from '@/lib/libretto';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { colori, raggi, spazi } from '@/lib/theme';

/**
 * La ricompensa dopo l'import: media, CFU e proiezione del voto di laurea,
 * calcolati da ciò che è davvero finito nel libretto (riletto dal database).
 */
export default function LibrettoPronto() {
  const nomeBot = useAppStore((s) => s.profilo?.nome_bot ?? 'Lode');
  const [stato, setStato] = useState<StatoLibretto | null>(null);

  useEffect(() => {
    caricaEsami().then(({ dati }) => setStato(calcolaLibretto(dati)));
  }, []);

  // L'accoglienza è già avanzata a "orario" al salvataggio.
  const continua = () => router.replace('/onboarding/foto-orario');

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.contenuto}>
        <View style={stili.cerchioIcona}>
          <Ionicons name="ribbon-outline" size={40} color={colori.successo} />
        </View>
        <Text style={stili.titolo}>Il tuo libretto è dentro</Text>

        {!stato ? (
          <ActivityIndicator color={colori.accento} />
        ) : (
          <View style={stili.card}>
            <Text style={stili.etichetta}>Media ponderata</Text>
            <Text style={stili.media}>{formattaMedia(stato.media)}</Text>
            <View style={stili.rigaStat}>
              <View style={stili.stat}>
                <Text style={stili.statNumero}>{stato.cfuAcquisiti}</Text>
                <Text style={stili.statEtichetta}>CFU acquisiti</Text>
              </View>
              <View style={stili.stat}>
                <Text style={stili.statNumero}>{stato.numeroSostenuti}</Text>
                <Text style={stili.statEtichetta}>esami superati</Text>
              </View>
              <View style={stili.stat}>
                <Text style={stili.statNumero}>{stato.numeroLodi}</Text>
                <Text style={stili.statEtichetta}>lodi</Text>
              </View>
            </View>
            {stato.proiezioneLaurea != null ? (
              <View style={stili.proiezione}>
                <Text style={stili.testoProiezione}>
                  Se chiudessi oggi, partiresti da{' '}
                  <Text style={stili.valoreProiezione}>{Math.round(stato.proiezioneLaurea)}/110</Text>
                </Text>
                <Text style={stili.nota}>
                  Stima dalla media (media/30×110), senza punti di commissione e tesi.
                </Text>
              </View>
            ) : (
              <Text style={stili.nota}>
                La media comparirà appena c'è almeno un esame con voto e CFU.
              </Text>
            )}
          </View>
        )}

        <Text style={stili.descrizione}>
          D'ora in poi {nomeBot} ragiona sui tuoi numeri veri. Li trovi sempre nella tab Libretto,
          col simulatore per il prossimo voto.
        </Text>
      </View>

      <View style={stili.pie}>
        <BottonePrimario etichetta="Continua" onPress={continua} disabilitato={!stato} />
      </View>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
    paddingHorizontal: spazi.lg,
  },
  contenuto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.md,
  },
  cerchioIcona: {
    width: 96,
    height: 96,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titolo: {
    color: colori.testo,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    alignItems: 'center',
    gap: spazi.xs,
  },
  etichetta: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  media: {
    color: colori.testo,
    fontSize: 52,
    fontWeight: '800',
  },
  rigaStat: {
    flexDirection: 'row',
    gap: spazi.lg,
    marginTop: spazi.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statNumero: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '700',
  },
  statEtichetta: {
    color: colori.testoSecondario,
    fontSize: 12,
  },
  proiezione: {
    marginTop: spazi.md,
    paddingTop: spazi.md,
    borderTopWidth: 1,
    borderTopColor: colori.bordo,
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 2,
  },
  testoProiezione: {
    color: colori.testo,
    fontSize: 15,
    textAlign: 'center',
  },
  valoreProiezione: {
    fontWeight: '800',
  },
  nota: {
    color: colori.testoSecondario,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spazi.xs,
  },
  descrizione: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  pie: {
    paddingBottom: spazi.lg,
  },
});
