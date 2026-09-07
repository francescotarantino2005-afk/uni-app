import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { eliminaAccount } from '@/lib/accountDb';
import { BadgeBeta } from '@/components/BadgeBeta';
import { colori, raggi, spazi } from '@/lib/theme';

const NOME_APP = 'Lode';

type Voce = {
  icona: keyof typeof Ionicons.glyphMap;
  titolo: string;
  sottotitolo: string;
  rotta: '/preferenze' | '/in-arrivo' | '/note-memoria';
};

const VOCI: Voce[] = [
  {
    icona: 'sunny-outline',
    titolo: 'Il briefing del mattino',
    sottotitolo: 'Scegli a che ora ricevere la tua giornata',
    rotta: '/preferenze',
  },
  {
    icona: 'bulb-outline',
    titolo: 'Cosa Lode ricorda di me',
    sottotitolo: 'Guarda e gestisci quello che l\'assistente sa di te',
    rotta: '/note-memoria',
  },
  {
    icona: 'sparkles-outline',
    titolo: 'In arrivo',
    sottotitolo: 'Le funzioni su cui stiamo lavorando',
    rotta: '/in-arrivo',
  },
];

export default function SchermataImpostazioni() {
  const profilo = useAppStore((s) => s.profilo);
  const esci = useAppStore((s) => s.esci);
  const [eliminazione, setEliminazione] = useState(false);

  const gestisciUscita = async () => {
    await esci();
    router.replace('/auth');
  };

  const eseguiEliminazione = async () => {
    setEliminazione(true);
    const err = await eliminaAccount();
    if (err) {
      setEliminazione(false);
      Alert.alert('Non completato', err);
      return;
    }
    // Riuscita: la sessione è ormai orfana lato server → esci e torna al login.
    await esci();
    router.replace('/auth');
  };

  const confermaEliminazione = () => {
    Alert.alert(
      'Eliminare l\'account?',
      'Orario, scadenze, libretto, messaggi e annotazioni vengono cancellati per sempre. Non è recuperabile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Continua',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Confermi l\'eliminazione definitiva?', 'Questa azione non si può annullare.', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Elimina', style: 'destructive', onPress: eseguiEliminazione },
            ]),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Impostazioni</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={stili.contenuto}>
        <View style={stili.testata}>
          <View style={stili.rigaNome}>
            <Text style={stili.nomeApp}>{NOME_APP}</Text>
            <BadgeBeta />
          </View>
          {profilo?.ateneo ? <Text style={stili.ateneo}>{profilo.ateneo}</Text> : null}
        </View>

        <View style={stili.lista}>
          {VOCI.map((v) => (
            <Pressable key={v.rotta} style={stili.voce} onPress={() => router.push(v.rotta)}>
              <Ionicons name={v.icona} size={22} color={colori.accento} />
              <View style={{ flex: 1 }}>
                <Text style={stili.voceTitolo}>{v.titolo}</Text>
                <Text style={stili.voceSottotitolo}>{v.sottotitolo}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colori.testoSecondario} />
            </Pressable>
          ))}
        </View>

        <View style={stili.account}>
          <Pressable style={stili.rigaEsci} onPress={gestisciUscita} disabled={eliminazione}>
            <Ionicons name="log-out-outline" size={22} color={colori.testoSecondario} />
            <Text style={stili.testoEsci}>Esci</Text>
          </Pressable>

          <Pressable
            style={[stili.rigaElimina, eliminazione && stili.rigaEliminaOff]}
            onPress={confermaEliminazione}
            disabled={eliminazione}
          >
            {eliminazione ? (
              <ActivityIndicator color={colori.errore} />
            ) : (
              <Ionicons name="trash-outline" size={22} color={colori.errore} />
            )}
            <Text style={stili.testoElimina}>Elimina account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colori.sfondo },
  intestazione: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  titoloPagina: { color: colori.testo, fontSize: 20, fontWeight: '800' },
  contenuto: { padding: spazi.lg, paddingTop: spazi.sm, gap: spazi.lg },
  testata: { gap: spazi.xs },
  rigaNome: { flexDirection: 'row', alignItems: 'center', gap: spazi.sm },
  nomeApp: { color: colori.testo, fontSize: 22, fontWeight: '800' },
  ateneo: { color: colori.testoSecondario, fontSize: 14 },
  lista: { gap: spazi.sm },
  voce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  voceTitolo: { color: colori.testo, fontSize: 16, fontWeight: '700' },
  voceSottotitolo: { color: colori.testoSecondario, fontSize: 13, marginTop: 2 },
  // Sezione Account, separata dalle card sopra dal gap del contenitore.
  account: { gap: spazi.sm, marginTop: spazi.sm },
  rigaEsci: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  testoEsci: { color: colori.testo, fontSize: 16, fontWeight: '700' },
  rigaElimina: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    borderColor: colori.errore,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  rigaEliminaOff: { opacity: 0.6 },
  testoElimina: { color: colori.errore, fontSize: 16, fontWeight: '700' },
});
