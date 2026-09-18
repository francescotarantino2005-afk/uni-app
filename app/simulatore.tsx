import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { caricaEsami } from '@/lib/esamiDb';
import {
  calcolaLibretto,
  formattaMedia,
  mediaConEsame,
  votoNecessarioPerMedia,
  VOTO_MAX,
  VOTO_MIN,
} from '@/lib/libretto';
import { Esame } from '@/lib/tipi';
import { CampoTesto } from '@/components/CampoTesto';
import { colori, raggi, spazi } from '@/lib/theme';

const VOTI = Array.from({ length: VOTO_MAX - VOTO_MIN + 1 }, (_, i) => VOTO_MIN + i);
type Modalita = 'media' | 'voto';

export default function SchermataSimulatore() {
  const [esami, setEsami] = useState<Esame[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [modalita, setModalita] = useState<Modalita>('media');

  // Modalità A: voto + cfu → media
  const [votoA, setVotoA] = useState(28);
  const [cfuA, setCfuA] = useState('9');

  // Modalità B: media target + cfu → voto necessario
  const [targetB, setTargetB] = useState('27');
  const [cfuB, setCfuB] = useState('9');

  useEffect(() => {
    (async () => {
      const { dati } = await caricaEsami();
      setEsami(dati);
      setCaricamento(false);
    })();
  }, []);

  const stato = calcolaLibretto(esami);

  // ---- Risultato modalità A ----
  const cfuANum = Number(cfuA);
  const cfuAValido = Number.isInteger(cfuANum) && cfuANum > 0;
  const nuovaMedia = cfuAValido ? mediaConEsame(esami, votoA, cfuANum) : null;
  const delta =
    nuovaMedia != null && stato.media != null ? nuovaMedia - stato.media : null;

  // ---- Risultato modalità B ----
  const targetNum = Number(targetB.replace(',', '.'));
  const targetValido = targetNum >= VOTO_MIN && targetNum <= VOTO_MAX;
  const cfuBNum = Number(cfuB);
  const cfuBValido = Number.isInteger(cfuBNum) && cfuBNum > 0;
  const esitoB =
    targetValido && cfuBValido ? votoNecessarioPerMedia(esami, targetNum, cfuBNum) : null;

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Simulatore media</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <ScrollView contentContainerStyle={stili.contenuto} keyboardShouldPersistTaps="handled">
          <View style={stili.mediaAttuale}>
            <Text style={stili.etichettaAttuale}>La tua media ora</Text>
            <Text style={stili.valoreAttuale}>{formattaMedia(stato.media)}</Text>
          </View>

          {/* Selettore modalità */}
          <View style={stili.selettore}>
            <Pressable
              onPress={() => setModalita('media')}
              style={[stili.tab, modalita === 'media' && stili.tabAttivo]}
            >
              <Text style={[stili.testoTab, modalita === 'media' && stili.testoTabAttivo]}>
                Che media avrò?
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setModalita('voto')}
              style={[stili.tab, modalita === 'voto' && stili.tabAttivo]}
            >
              <Text style={[stili.testoTab, modalita === 'voto' && stili.testoTabAttivo]}>
                Che voto mi serve?
              </Text>
            </Pressable>
          </View>

          {modalita === 'media' ? (
            <View style={stili.gruppo}>
              <Text style={stili.domanda}>
                Se al prossimo esame prendo…
              </Text>
              <Text style={stili.etichettaGruppo}>Voto</Text>
              <View style={stili.rigaChip}>
                {VOTI.map((v) => {
                  const attivo = votoA === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setVotoA(v)}
                      style={[stili.chipVoto, attivo && stili.chipVotoAttivo]}
                    >
                      <Text style={[stili.testoChipVoto, attivo && stili.testoChipVotoAttivo]}>
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <CampoTesto
                etichetta="…a un esame da quanti CFU?"
                value={cfuA}
                onChangeText={setCfuA}
                placeholder="9"
                keyboardType="number-pad"
              />

              <View style={stili.risultato}>
                {nuovaMedia != null ? (
                  <>
                    <Text style={stili.etichettaRisultato}>La tua nuova media sarebbe</Text>
                    <Text style={stili.valoreRisultato}>{formattaMedia(nuovaMedia)}</Text>
                    {delta != null ? (
                      <Text
                        style={[
                          stili.delta,
                          delta >= 0 ? stili.deltaSu : stili.deltaGiu,
                        ]}
                      >
                        {delta >= 0 ? '▲' : '▼'} {formattaMedia(Math.abs(delta))} rispetto a ora
                      </Text>
                    ) : (
                      <Text style={stili.notaRisultato}>Sarebbe il tuo primo voto in media.</Text>
                    )}
                  </>
                ) : (
                  <Text style={stili.notaRisultato}>Inserisci un numero di CFU valido.</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={stili.gruppo}>
              <Text style={stili.domanda}>Per arrivare a una media di…</Text>
              <CampoTesto
                etichetta="Media che vuoi raggiungere (18–30)"
                value={targetB}
                onChangeText={setTargetB}
                placeholder="27"
                keyboardType="numbers-and-punctuation"
              />
              <CampoTesto
                etichetta="…al prossimo esame da quanti CFU?"
                value={cfuB}
                onChangeText={setCfuB}
                placeholder="9"
                keyboardType="number-pad"
              />

              <View style={stili.risultato}>
                {!targetValido ? (
                  <Text style={stili.notaRisultato}>La media deve stare tra 18 e 30.</Text>
                ) : !cfuBValido ? (
                  <Text style={stili.notaRisultato}>Inserisci un numero di CFU valido.</Text>
                ) : esitoB?.tipo === 'ok' ? (
                  <>
                    <Text style={stili.etichettaRisultato}>Ti serve almeno</Text>
                    <Text style={stili.valoreRisultato}>{esitoB.voto}</Text>
                    <Text style={stili.notaRisultato}>a quell'esame per arrivarci.</Text>
                  </>
                ) : esitoB?.tipo === 'gia_raggiunta' ? (
                  <>
                    <Text style={stili.etichettaRisultato}>Ci sei già 💪</Text>
                    <Text style={stili.notaRisultato}>
                      Anche prendendo il minimo (18) resti sopra questa media.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={stili.etichettaRisultato}>Non con un solo esame</Text>
                    <Text style={stili.notaRisultato}>
                      Servirebbe più di 30: ti serviranno più esami alti per arrivarci.
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}

          <Text style={stili.notaFinale}>
            La lode vale 30 nel calcolo della media.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: {
    color: colori.testo,
    fontSize: 20,
    fontWeight: '800',
  },
  contenuto: {
    padding: spazi.lg,
    paddingTop: spazi.sm,
    gap: spazi.md,
  },
  mediaAttuale: {
    alignItems: 'center',
    gap: 2,
  },
  etichettaAttuale: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  valoreAttuale: {
    color: colori.testo,
    fontSize: 28,
    fontWeight: '800',
  },
  selettore: {
    flexDirection: 'row',
    gap: spazi.xs,
    backgroundColor: colori.superficie,
    borderRadius: raggi.md,
    padding: spazi.xs,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  tab: {
    flex: 1,
    paddingVertical: spazi.sm,
    borderRadius: raggi.sm,
    alignItems: 'center',
  },
  tabAttivo: {
    backgroundColor: colori.accentoTenue,
  },
  testoTab: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
  },
  testoTabAttivo: {
    color: colori.accento,
    fontWeight: '700',
  },
  gruppo: {
    gap: spazi.md,
  },
  domanda: {
    color: colori.testo,
    fontSize: 16,
    fontWeight: '700',
  },
  etichettaGruppo: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
  },
  rigaChip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spazi.xs,
  },
  chipVoto: {
    width: 44,
    paddingVertical: spazi.sm,
    borderRadius: raggi.sm,
    backgroundColor: colori.superficie,
    borderWidth: 1,
    borderColor: colori.bordo,
    alignItems: 'center',
  },
  chipVotoAttivo: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
  },
  testoChipVoto: {
    color: colori.testoSecondario,
    fontSize: 15,
    fontWeight: '600',
  },
  testoChipVotoAttivo: {
    color: colori.accento,
    fontWeight: '800',
  },
  risultato: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    alignItems: 'center',
    gap: spazi.xs,
  },
  etichettaRisultato: {
    color: colori.testoSecondario,
    fontSize: 14,
  },
  valoreRisultato: {
    color: colori.testo,
    fontSize: 44,
    fontWeight: '800',
  },
  notaRisultato: {
    color: colori.testoSecondario,
    fontSize: 13,
    textAlign: 'center',
  },
  delta: {
    fontSize: 14,
    fontWeight: '700',
  },
  deltaSu: {
    color: colori.successo,
  },
  deltaGiu: {
    color: colori.errore,
  },
  notaFinale: {
    color: colori.testoSecondario,
    fontSize: 12,
    textAlign: 'center',
  },
});
