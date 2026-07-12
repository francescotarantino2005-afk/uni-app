import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { eliminaLezione, salvaLezione } from '@/lib/orarioDb';
import { EventoOrario } from '@/lib/tipi';
import { GIORNI_BREVI, normalizzaOra, oraBreve } from '@/lib/date';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, coloriLezione, raggi, spazi } from '@/lib/theme';

/** Form di inserimento/modifica di una lezione ricorrente. */
export default function SchermataLezione() {
  const parametri = useLocalSearchParams<{ id?: string; giorno?: string }>();
  const idModifica = parametri.id;
  const utente = useAppStore((s) => s.utente);

  const [titolo, setTitolo] = useState('');
  const [giorno, setGiorno] = useState(Number(parametri.giorno) || 1);
  const [oraInizio, setOraInizio] = useState('');
  const [oraFine, setOraFine] = useState('');
  const [aula, setAula] = useState('');
  const [colore, setColore] = useState(coloriLezione[0]);
  const [caricamento, setCaricamento] = useState(!!idModifica);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!idModifica) return;
    (async () => {
      const { data } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('id', idModifica)
        .maybeSingle();
      const lezione = data as EventoOrario | null;
      if (lezione) {
        setTitolo(lezione.titolo);
        setGiorno(lezione.giorno);
        setOraInizio(oraBreve(lezione.ora_inizio));
        setOraFine(oraBreve(lezione.ora_fine));
        setAula(lezione.aula ?? '');
        setColore(lezione.colore ?? coloriLezione[0]);
      }
      setCaricamento(false);
    })();
  }, [idModifica]);

  const salva = async () => {
    setErrore(null);
    if (!utente) {
      setErrore('Sessione scaduta: accedi di nuovo.');
      return;
    }
    if (!titolo.trim()) {
      setErrore('Dai un nome alla lezione (es. "Analisi Matematica 1").');
      return;
    }
    const inizio = normalizzaOra(oraInizio);
    if (!inizio) {
      setErrore('Ora di inizio non valida: usa il formato 09:00.');
      return;
    }
    let fine: string | null = null;
    if (oraFine.trim()) {
      fine = normalizzaOra(oraFine);
      if (!fine) {
        setErrore('Ora di fine non valida: usa il formato 11:00.');
        return;
      }
      if (fine <= inizio) {
        setErrore("L'ora di fine deve venire dopo l'inizio.");
        return;
      }
    }

    setSalvataggio(true);
    const { errore: erroreDb } = await salvaLezione(
      utente.id,
      {
        titolo: titolo.trim(),
        giorno,
        ora_inizio: inizio,
        ora_fine: fine,
        aula: aula.trim() || null,
        colore,
      },
      idModifica
    );
    setSalvataggio(false);

    if (erroreDb) {
      setErrore(erroreDb);
      return;
    }
    router.back();
  };

  const elimina = async () => {
    if (!idModifica) return;

    const conferma = async () => {
      setSalvataggio(true);
      const { errore: erroreDb } = await eliminaLezione(idModifica);
      setSalvataggio(false);
      if (erroreDb) {
        setErrore(erroreDb);
        return;
      }
      router.back();
    };

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm('Eliminare questa lezione?')) await conferma();
      return;
    }
    Alert.alert('Eliminare questa lezione?', 'Non si può annullare.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: conferma },
    ]);
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>{idModifica ? 'Modifica lezione' : 'Nuova lezione'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <ScrollView contentContainerStyle={stili.modulo} keyboardShouldPersistTaps="handled">
          <CampoTesto
            etichetta="Materia"
            value={titolo}
            onChangeText={setTitolo}
            placeholder="Analisi Matematica 1"
          />

          <View style={stili.gruppo}>
            <Text style={stili.etichettaGruppo}>Giorno</Text>
            <View style={stili.rigaChip}>
              {GIORNI_BREVI.map((etichetta, i) => {
                const valore = i + 1;
                const attivo = giorno === valore;
                return (
                  <Pressable
                    key={etichetta}
                    onPress={() => setGiorno(valore)}
                    style={[stili.chip, attivo && stili.chipAttivo]}
                  >
                    <Text style={[stili.testoChip, attivo && stili.testoChipAttivo]}>
                      {etichetta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={stili.rigaOre}>
            <View style={{ flex: 1 }}>
              <CampoTesto
                etichetta="Inizio"
                value={oraInizio}
                onChangeText={setOraInizio}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTesto
                etichetta="Fine (opzionale)"
                value={oraFine}
                onChangeText={setOraFine}
                placeholder="11:00"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <CampoTesto
            etichetta="Aula (opzionale)"
            value={aula}
            onChangeText={setAula}
            placeholder="T4"
          />

          <View style={stili.gruppo}>
            <Text style={stili.etichettaGruppo}>Colore</Text>
            <View style={stili.rigaChip}>
              {coloriLezione.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColore(c)}
                  style={[
                    stili.pallinoColore,
                    { backgroundColor: c },
                    colore === c && stili.pallinoSelezionato,
                  ]}
                />
              ))}
            </View>
          </View>

          <MessaggioErrore messaggio={errore} />

          <BottonePrimario
            etichetta={idModifica ? 'Salva modifiche' : 'Aggiungi lezione'}
            onPress={salva}
            caricamento={salvataggio}
          />

          {idModifica ? (
            <Pressable onPress={elimina} disabled={salvataggio}>
              <Text style={stili.linkElimina}>Elimina lezione</Text>
            </Pressable>
          ) : null}
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
  modulo: {
    padding: spazi.lg,
    paddingTop: spazi.sm,
    gap: spazi.md,
  },
  gruppo: {
    gap: spazi.xs,
  },
  etichettaGruppo: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
  },
  rigaChip: {
    flexDirection: 'row',
    gap: spazi.xs,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.sm + 2,
    borderRadius: raggi.sm,
    backgroundColor: colori.superficie,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  chipAttivo: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
  },
  testoChip: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
  },
  testoChipAttivo: {
    color: colori.accento,
  },
  rigaOre: {
    flexDirection: 'row',
    gap: spazi.md,
  },
  pallinoColore: {
    width: 34,
    height: 34,
    borderRadius: raggi.pieno,
  },
  pallinoSelezionato: {
    borderWidth: 3,
    borderColor: colori.testo,
  },
  linkElimina: {
    color: colori.errore,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spazi.sm,
  },
});
