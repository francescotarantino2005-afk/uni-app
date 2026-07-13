import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { eliminaEsame, salvaEsame } from '@/lib/esamiDb';
import { Esame } from '@/lib/tipi';
import { VOTO_MAX, VOTO_MIN } from '@/lib/libretto';
import { dataBreveItaliana, parseDataItaliana } from '@/lib/date';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

const VOTI = Array.from({ length: VOTO_MAX - VOTO_MIN + 1 }, (_, i) => VOTO_MIN + i);

// "AAAA-MM-GG" → "GG/MM/AAAA" per il campo di testo
function isoAItaliano(iso: string | null): string {
  if (!iso) return '';
  const [a, m, g] = iso.split('-');
  return a && m && g ? `${g}/${m}/${a}` : '';
}

export default function SchermataEsame() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const idModifica = id;
  const utente = useAppStore((s) => s.utente);

  const [materia, setMateria] = useState('');
  const [cfu, setCfu] = useState('');
  const [sostenuto, setSostenuto] = useState(true);
  const [voto, setVoto] = useState<number | null>(null);
  const [lode, setLode] = useState(false);
  const [dataTesto, setDataTesto] = useState('');
  const [caricamento, setCaricamento] = useState(!!idModifica);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!idModifica) return;
    (async () => {
      const { data } = await supabase.from('exams').select('*').eq('id', idModifica).maybeSingle();
      const e = data as Esame | null;
      if (e) {
        setMateria(e.materia);
        setCfu(e.cfu != null ? String(e.cfu) : '');
        setSostenuto(e.voto != null);
        setVoto(e.voto);
        setLode(e.lode);
        setDataTesto(isoAItaliano(e.data_esame));
      }
      setCaricamento(false);
    })();
  }, [idModifica]);

  const scegliVoto = (v: number) => {
    setVoto(v);
    if (v !== VOTO_MAX) setLode(false); // la lode è solo sul 30
  };

  const salva = async () => {
    setErrore(null);
    if (!utente) {
      setErrore('Sessione scaduta: accedi di nuovo.');
      return;
    }
    if (!materia.trim()) {
      setErrore('Dai un nome alla materia (es. "Analisi Matematica 1").');
      return;
    }
    const cfuNum = cfu.trim() ? Number(cfu) : null;
    if (cfu.trim() && (!Number.isInteger(cfuNum) || cfuNum! <= 0)) {
      setErrore('I CFU devono essere un numero intero positivo.');
      return;
    }
    if (sostenuto && voto == null) {
      setErrore('Scegli il voto, oppure segna l\'esame come "da sostenere".');
      return;
    }
    let dataIso: string | null = null;
    if (dataTesto.trim()) {
      dataIso = parseDataItaliana(dataTesto);
      if (!dataIso) {
        setErrore('Data non valida: usa il formato GG/MM/AAAA (es. 12/06/2026).');
        return;
      }
    }

    setSalvataggio(true);
    const { errore: erroreDb } = await salvaEsame(
      utente.id,
      {
        materia: materia.trim(),
        cfu: cfuNum,
        data_esame: dataIso,
        voto: sostenuto ? voto : null,
        lode: sostenuto && voto === VOTO_MAX ? lode : false,
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
      const { errore: erroreDb } = await eliminaEsame(idModifica);
      setSalvataggio(false);
      if (erroreDb) {
        setErrore(erroreDb);
        return;
      }
      router.back();
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm('Eliminare questo esame?')) await conferma();
      return;
    }
    Alert.alert('Eliminare questo esame?', 'Non si può annullare.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: conferma },
    ]);
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>{idModifica ? 'Modifica esame' : 'Nuovo esame'}</Text>
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
            value={materia}
            onChangeText={setMateria}
            placeholder="Analisi Matematica 1"
          />
          <CampoTesto
            etichetta="CFU"
            value={cfu}
            onChangeText={setCfu}
            placeholder="9"
            keyboardType="number-pad"
          />

          <View style={stili.rigaSwitch}>
            <View style={{ flex: 1 }}>
              <Text style={stili.etichettaSwitch}>Già sostenuto</Text>
              <Text style={stili.notaSwitch}>
                {sostenuto ? 'Inserisci il voto qui sotto' : 'Esame ancora da fare (non entra nella media)'}
              </Text>
            </View>
            <Switch
              value={sostenuto}
              onValueChange={setSostenuto}
              trackColor={{ true: colori.accento, false: colori.bordo }}
              thumbColor="#FFFFFF"
            />
          </View>

          {sostenuto ? (
            <View style={stili.gruppo}>
              <Text style={stili.etichettaGruppo}>Voto</Text>
              <View style={stili.rigaChip}>
                {VOTI.map((v) => {
                  const attivo = voto === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => scegliVoto(v)}
                      style={[stili.chipVoto, attivo && stili.chipVotoAttivo]}
                    >
                      <Text style={[stili.testoChipVoto, attivo && stili.testoChipVotoAttivo]}>
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => voto === VOTO_MAX && setLode(!lode)}
                style={[stili.rigaLode, voto !== VOTO_MAX && stili.rigaLodeDisabilitata]}
              >
                <Ionicons
                  name={lode ? 'star' : 'star-outline'}
                  size={20}
                  color={voto === VOTO_MAX ? colori.successo : colori.testoSecondario}
                />
                <Text style={stili.testoLode}>
                  30 e lode {voto !== VOTO_MAX ? '(solo con il 30)' : ''}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <CampoTesto
            etichetta={sostenuto ? 'Data (opzionale)' : 'Data prevista (opzionale)'}
            value={dataTesto}
            onChangeText={setDataTesto}
            placeholder="12/06/2026"
            keyboardType="numbers-and-punctuation"
          />

          <MessaggioErrore messaggio={errore} />

          <BottonePrimario
            etichetta={idModifica ? 'Salva modifiche' : 'Aggiungi esame'}
            onPress={salva}
            caricamento={salvataggio}
          />

          {idModifica ? (
            <Pressable onPress={elimina} disabled={salvataggio}>
              <Text style={stili.linkElimina}>Elimina esame</Text>
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
  rigaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  etichettaSwitch: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '600',
  },
  notaSwitch: {
    color: colori.testoSecondario,
    fontSize: 12,
  },
  gruppo: {
    gap: spazi.sm,
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
  rigaLode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.xs,
  },
  rigaLodeDisabilitata: {
    opacity: 0.5,
  },
  testoLode: {
    color: colori.testo,
    fontSize: 14,
    fontWeight: '600',
  },
  linkElimina: {
    color: colori.errore,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spazi.sm,
  },
});
