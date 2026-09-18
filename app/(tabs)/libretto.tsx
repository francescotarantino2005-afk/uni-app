import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaEsami } from '@/lib/esamiDb';
import { calcolaLibretto, formattaMedia, formattaVoto, sostenuto } from '@/lib/libretto';
import { Esame } from '@/lib/tipi';
import { dataBreveItaliana } from '@/lib/date';
import { StatoVuoto } from '@/components/StatoVuoto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { BottoneChat } from '@/components/BottoneChat';
import { colori, raggi, spazi } from '@/lib/theme';

export default function SchermataLibretto() {
  const [esami, setEsami] = useState<Esame[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let attivo = true;
      (async () => {
        const { dati, errore } = await caricaEsami();
        if (!attivo) return;
        setEsami(dati);
        setErrore(errore);
        setCaricamento(false);
      })();
      return () => {
        attivo = false;
      };
    }, [])
  );

  const stato = calcolaLibretto(esami);
  const sostenuti = esami.filter(sostenuto);
  const daSostenere = esami.filter((e) => !sostenuto(e));

  const rigaEsame = (e: Esame) => (
    <Pressable
      key={e.id}
      style={stili.riga}
      onPress={() => router.push(`/esame?id=${e.id}`)}
    >
      <View style={{ flex: 1 }}>
        <Text style={stili.materia} numberOfLines={1}>
          {e.materia}
        </Text>
        <Text style={stili.dettagli}>
          {e.cfu ? `${e.cfu} CFU` : 'CFU non indicati'}
          {e.data_esame ? `  ·  ${dataBreveItaliana(e.data_esame)}` : ''}
        </Text>
      </View>
      {sostenuto(e) ? (
        <View style={[stili.badgeVoto, e.lode && e.voto === 30 && stili.badgeLode]}>
          <Text style={[stili.testoVoto, e.lode && e.voto === 30 && stili.testoLode]}>
            {formattaVoto(e)}
          </Text>
        </View>
      ) : (
        <Ionicons name="ellipse-outline" size={22} color={colori.testoSecondario} />
      )}
    </Pressable>
  );

  return (
    <View style={stili.schermo}>
      <ScrollView contentContainerStyle={stili.contenuto}>
        {caricamento ? (
          <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
        ) : (
          <>
            {/* Statistiche in cima */}
            <View style={stili.cardMedia}>
              <Text style={stili.etichettaMedia}>Media ponderata</Text>
              <Text style={stili.mediaGrande}>{formattaMedia(stato.media)}</Text>
              <View style={stili.rigaStat}>
                <View style={stili.stat}>
                  <Text style={stili.statNumero}>{stato.cfuAcquisiti}</Text>
                  <Text style={stili.statEtichetta}>CFU acquisiti</Text>
                </View>
                <View style={stili.stat}>
                  <Text style={stili.statNumero}>{stato.numeroLodi}</Text>
                  <Text style={stili.statEtichetta}>lodi</Text>
                </View>
                <View style={stili.stat}>
                  <Text style={stili.statNumero}>{stato.numeroSostenuti}</Text>
                  <Text style={stili.statEtichetta}>esami</Text>
                </View>
              </View>
              {stato.proiezioneLaurea != null ? (
                <View style={stili.proiezione}>
                  <Text style={stili.testoProiezione}>
                    Voto di laurea di partenza:{' '}
                    <Text style={stili.proiezioneValore}>
                      {Math.round(stato.proiezioneLaurea)}/110
                    </Text>
                  </Text>
                  <Text style={stili.notaProiezione}>
                    Stima dalla media (media/30×110), senza punti di commissione e tesi.
                  </Text>
                </View>
              ) : null}
            </View>

            <Pressable style={stili.bottoneSimulatore} onPress={() => router.push('/simulatore')}>
              <Ionicons name="calculator-outline" size={20} color={colori.testoSecondario} />
              <Text style={stili.testoSimulatore}>Simulatore media</Text>
              <Ionicons name="chevron-forward" size={18} color={colori.testoSecondario} />
            </Pressable>

            <MessaggioErrore messaggio={errore} />

            {esami.length === 0 ? (
              <View style={stili.cardVuoto}>
                <Text style={stili.titoloVuoto}>Il tuo libretto parte da qui 🌱</Text>
                <Text style={stili.testoVuoto}>
                  Normale se sei all'inizio: ancora nessun esame. Man mano che li dai e li aggiungi,
                  qui trovi la media ponderata aggiornata da sola, i CFU, le lodi e la proiezione del
                  voto di laurea. E col simulatore puoi già vedere che media faresti col prossimo voto.
                </Text>
                <Text style={stili.suggerimentoVuoto}>
                  Hai già dato qualche esame? Aggiungilo col bottone qui sotto.
                </Text>
              </View>
            ) : (
              <>
                <Text style={stili.titoloSezione}>Sostenuti ({sostenuti.length})</Text>
                {sostenuti.length === 0 ? (
                  <Text style={stili.vuotoSezione}>Ancora nessun esame verbalizzato.</Text>
                ) : (
                  <View style={stili.lista}>{sostenuti.map(rigaEsame)}</View>
                )}

                <Text style={stili.titoloSezione}>Da sostenere ({daSostenere.length})</Text>
                {daSostenere.length === 0 ? (
                  <Text style={stili.vuotoSezione}>Nessun esame in programma.</Text>
                ) : (
                  <View style={stili.lista}>{daSostenere.map(rigaEsame)}</View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Pressable style={stili.bottoneAggiungi} onPress={() => router.push('/esame')}>
        <Ionicons name="add" size={26} color={colori.sfondo} />
        <Text style={stili.testoAggiungi}>Esame</Text>
      </Pressable>

      <BottoneChat />
    </View>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  contenuto: {
    padding: spazi.md,
    gap: spazi.md,
    // spazio per il "+" (alzato sopra il chat FAB) + il chat FAB: l'ultima riga resta libera.
    paddingBottom: 140,
  },
  cardVuoto: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    gap: spazi.sm,
  },
  titoloVuoto: {
    color: colori.testo,
    fontSize: 18,
    fontWeight: '800',
  },
  testoVuoto: {
    color: colori.testoSecondario,
    fontSize: 14,
    lineHeight: 21,
  },
  suggerimentoVuoto: {
    color: colori.testo,
    fontSize: 14,
    fontWeight: '600',
  },
  cardMedia: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    alignItems: 'center',
    gap: spazi.xs,
  },
  etichettaMedia: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mediaGrande: {
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
    fontSize: 14,
  },
  proiezioneValore: {
    color: colori.testo,
    fontWeight: '800',
  },
  notaProiezione: {
    color: colori.testoSecondario,
    fontSize: 11,
    textAlign: 'center',
  },
  bottoneSimulatore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  testoSimulatore: {
    flex: 1,
    color: colori.testo,
    fontSize: 15,
    fontWeight: '600',
  },
  titoloSezione: {
    color: colori.testo,
    fontSize: 16,
    fontWeight: '800',
    marginTop: spazi.sm,
  },
  vuotoSezione: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  lista: {
    gap: spazi.sm,
  },
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  materia: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '600',
  },
  dettagli: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  badgeVoto: {
    minWidth: 44,
    paddingVertical: spazi.xs,
    paddingHorizontal: spazi.sm,
    borderRadius: raggi.sm,
    backgroundColor: colori.bordo,
    alignItems: 'center',
  },
  badgeLode: {
    backgroundColor: colori.superficie,
  },
  testoVoto: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '800',
  },
  testoLode: {
    color: colori.successo,
  },
  bottoneAggiungi: {
    position: 'absolute',
    right: spazi.lg,
    // alzato sopra il pulsante chat flottante (56 + margine).
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    backgroundColor: colori.accento,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoAggiungi: {
    color: colori.sfondo,
    fontSize: 15,
    fontWeight: '700',
  },
});
