import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Conversazione, type EsameBarra, gruppiBarra, titoloValido } from '@/lib/conversazioni';
import { coloriChat } from '@/lib/theme';

const LARGHEZZA = Math.min(340, Math.round(Dimensions.get('window').width * 0.84));

type Props = {
  visibile: boolean;
  onChiudi: () => void;
  conversazioni: Conversazione[];
  esami: EsameBarra[];
  correnteId: string | null;
  onScegli: (c: Conversazione) => void;
  onNuova: (examId: string | null) => void;
  onRinomina: (c: Conversazione, titolo: string) => Promise<boolean>;
  onElimina: (c: Conversazione) => Promise<boolean>;
};

/**
 * La barra laterale della chat: le conversazioni raggruppate per esame, "Nuova
 * chat" dentro un esame, rinomina, elimina (con conferma). Entra da sinistra;
 * si chiude toccando fuori o trascinandola verso sinistra.
 */
export function BarraConversazioni(p: Props) {
  const x = useRef(new Animated.Value(-LARGHEZZA)).current;
  const [montata, setMontata] = useState(p.visibile);
  // la conversazione su cui si stanno facendo azioni, e quale
  const [azioni, setAzioni] = useState<string | null>(null);
  const [rinomina, setRinomina] = useState<{ id: string; testo: string } | null>(null);
  const [conferma, setConferma] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (p.visibile) {
      setMontata(true);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else if (montata) {
      Animated.timing(x, { toValue: -LARGHEZZA, duration: 200, useNativeDriver: true }).start(() => {
        setMontata(false);
        setAzioni(null);
        setRinomina(null);
        setConferma(null);
        setErrore(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visibile]);

  // Trascinare la barra verso sinistra la chiude.
  const chiudi = useRef(p.onChiudi);
  chiudi.current = p.onChiudi;
  const trascina = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -LARGHEZZA / 4 || g.vx < -0.5) chiudi.current();
        else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const { generale, gruppi } = useMemo(() => gruppiBarra(p.conversazioni, p.esami), [p.conversazioni, p.esami]);
  const sfondo = x.interpolate({ inputRange: [-LARGHEZZA, 0], outputRange: [0, 0.35] });

  const salvaRinomina = async () => {
    if (!rinomina) return;
    const titolo = titoloValido(rinomina.testo);
    const c = p.conversazioni.find((k) => k.id === rinomina.id);
    if (!titolo || !c) return;
    const ok = await p.onRinomina(c, titolo);
    if (!ok) return setErrore('Non sono riuscito a rinominarla. Riprova.');
    setRinomina(null);
    setAzioni(null);
  };

  const elimina = async (id: string) => {
    const c = p.conversazioni.find((k) => k.id === id);
    if (!c) return;
    const ok = await p.onElimina(c);
    if (!ok) return setErrore('Non sono riuscito a eliminarla. Riprova.');
    setConferma(null);
    setAzioni(null);
  };

  const riga = (c: Conversazione) => {
    const attiva = c.id === p.correnteId;
    if (rinomina?.id === c.id) {
      return (
        <View key={c.id} style={stili.rinomina}>
          <TextInput
            value={rinomina.testo}
            onChangeText={(t) => setRinomina({ id: c.id, testo: t })}
            style={stili.campo}
            autoFocus
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={salvaRinomina}
            accessibilityLabel="Nuovo nome della chat"
          />
          <Pressable onPress={salvaRinomina} hitSlop={8} accessibilityRole="button" accessibilityLabel="Salva il nome">
            <Ionicons name="checkmark" size={22} color={coloriChat.viola} />
          </Pressable>
          <Pressable onPress={() => setRinomina(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Annulla">
            <Ionicons name="close" size={22} color={coloriChat.testoSecondario} />
          </Pressable>
        </View>
      );
    }
    return (
      <View key={c.id}>
        <View style={[stili.riga, attiva && stili.rigaAttiva]}>
          <Pressable style={stili.rigaTocco} onPress={() => p.onScegli(c)} accessibilityRole="button" accessibilityState={{ selected: attiva }}>
            <Text style={[stili.titoloRiga, attiva && stili.titoloAttivo]} numberOfLines={1}>
              {c.titolo}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setConferma(null);
              setAzioni(azioni === c.id ? null : c.id);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Azioni per ${c.titolo}`}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={coloriChat.testoSecondario} />
          </Pressable>
        </View>
        {azioni === c.id ? (
          conferma === c.id ? (
            <View style={stili.conferma}>
              <Text style={stili.testoConferma}>Elimini questa chat e i suoi messaggi? Non si può annullare.</Text>
              <View style={stili.bottoni}>
                <Pressable onPress={() => setConferma(null)} style={stili.bottone} accessibilityRole="button">
                  <Text style={stili.testoBottone}>Annulla</Text>
                </Pressable>
                <Pressable onPress={() => elimina(c.id)} style={[stili.bottone, stili.bottoneElimina]} accessibilityRole="button">
                  <Text style={[stili.testoBottone, stili.testoElimina]}>Elimina</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={stili.bottoni}>
              <Pressable onPress={() => setRinomina({ id: c.id, testo: c.titolo })} style={stili.bottone} accessibilityRole="button">
                <Ionicons name="pencil-outline" size={15} color={coloriChat.viola} />
                <Text style={stili.testoBottone}>Rinomina</Text>
              </Pressable>
              {c.generale ? null : (
                <Pressable onPress={() => setConferma(c.id)} style={stili.bottone} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={15} color={coloriChat.errore} />
                  <Text style={[stili.testoBottone, { color: coloriChat.errore }]}>Elimina</Text>
                </Pressable>
              )}
            </View>
          )
        ) : null}
      </View>
    );
  };

  if (!montata) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={p.onChiudi} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: sfondo }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={p.onChiudi} accessibilityLabel="Chiudi le chat" />
        </Animated.View>
        <Animated.View style={[stili.pannello, { transform: [{ translateX: x }] }]} {...trascina.panHandlers}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={stili.testata}>
              <Text style={stili.titolo}>Le tue chat</Text>
              <Pressable onPress={p.onChiudi} hitSlop={10} accessibilityRole="button" accessibilityLabel="Chiudi">
                <Ionicons name="close" size={24} color={coloriChat.testo} />
              </Pressable>
            </View>
            {errore ? <Text style={stili.errore}>{errore}</Text> : null}
            <ScrollView contentContainerStyle={stili.lista} keyboardShouldPersistTaps="handled">
              {generale ? riga(generale) : null}
              {gruppi.map((g) => (
                <View key={g.examId ?? 'altre'} style={stili.gruppo}>
                  <View style={stili.testataGruppo}>
                    <Text style={stili.titoloGruppo} numberOfLines={1}>
                      {g.titolo}
                    </Text>
                    {g.examId ? (
                      <Pressable
                        onPress={() => p.onNuova(g.examId)}
                        hitSlop={8}
                        style={stili.nuova}
                        accessibilityRole="button"
                        accessibilityLabel={`Nuova chat per ${g.titolo}`}
                      >
                        <Ionicons name="add" size={16} color={coloriChat.viola} />
                        <Text style={stili.testoNuova}>Nuova chat</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {g.conversazioni.length ? g.conversazioni.map(riga) : <Text style={stili.vuoto}>Ancora nessuna chat.</Text>}
                </View>
              ))}
              <Pressable onPress={() => p.onNuova(null)} style={[stili.nuova, stili.nuovaLibera]} accessibilityRole="button">
                <Ionicons name="add" size={16} color={coloriChat.viola} />
                <Text style={stili.testoNuova}>Nuova chat senza esame</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const stili = StyleSheet.create({
  pannello: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LARGHEZZA,
    backgroundColor: coloriChat.sfondo,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: coloriChat.bordo,
  },
  testata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titolo: { fontSize: 20, fontWeight: '800', color: coloriChat.testo },
  errore: { color: coloriChat.errore, fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
  lista: { paddingHorizontal: 10, paddingBottom: 32, gap: 6 },
  gruppo: { marginTop: 14, gap: 2 },
  testataGruppo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 8,
  },
  titoloGruppo: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: coloriChat.testoSecondario,
  },
  nuova: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  nuovaLibera: { marginTop: 18, paddingHorizontal: 8 },
  testoNuova: { color: coloriChat.viola, fontSize: 14, fontWeight: '600' },
  vuoto: { fontSize: 13, color: coloriChat.testoSecondario, paddingHorizontal: 8, paddingVertical: 4 },
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingRight: 10,
  },
  rigaAttiva: { backgroundColor: coloriChat.violaTenue },
  rigaTocco: { flex: 1, paddingVertical: 10, paddingHorizontal: 8 },
  titoloRiga: { fontSize: 16, color: coloriChat.testo },
  titoloAttivo: { fontWeight: '700', color: coloriChat.viola },
  rinomina: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  campo: {
    flex: 1,
    fontSize: 16,
    color: coloriChat.testo,
    borderWidth: 1,
    borderColor: coloriChat.viola,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: coloriChat.superficie,
  },
  bottoni: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingBottom: 6, flexWrap: 'wrap' },
  bottone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: coloriChat.bordo,
    backgroundColor: coloriChat.superficie,
  },
  bottoneElimina: { backgroundColor: coloriChat.errore, borderColor: coloriChat.errore },
  testoBottone: { fontSize: 14, color: coloriChat.viola, fontWeight: '600' },
  testoElimina: { color: '#FFFFFF' },
  conferma: { paddingHorizontal: 8, paddingBottom: 8, gap: 8 },
  testoConferma: { fontSize: 14, color: coloriChat.testo, lineHeight: 19 },
});
