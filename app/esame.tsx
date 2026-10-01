import { useEffect, useRef, useState } from 'react';
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
import { Esame, TipoEsame } from '@/lib/tipi';
import { VOTO_MAX, VOTO_MIN } from '@/lib/libretto';
import { isoAItaliano, parseDataItaliana } from '@/lib/date';
import { eEsameTarget, reazionePerEsame } from '@/lib/reazioni';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

const VOTI = Array.from({ length: VOTO_MAX - VOTO_MIN + 1 }, (_, i) => VOTO_MIN + i);

const TIPI_ESAME: { valore: TipoEsame; etichetta: string }[] = [
  { valore: 'scritto', etichetta: 'Scritto' },
  { valore: 'orale', etichetta: 'Orale' },
  { valore: 'entrambi', etichetta: 'Entrambi' },
  { valore: 'progetto', etichetta: 'Progetto' },
  { valore: 'altro', etichetta: 'Altro' },
];

export default function SchermataEsame() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const idModifica = id;
  const utente = useAppStore((s) => s.utente);

  const [materia, setMateria] = useState('');
  const [cfu, setCfu] = useState('');
  const [sostenuto, setSostenuto] = useState(true);
  // superato senza voto: CFU sì, media no
  const [idoneita, setIdoneita] = useState(false);
  const [voto, setVoto] = useState<number | null>(null);
  const [lode, setLode] = useState(false);
  const [dataTesto, setDataTesto] = useState('');
  const [professore, setProfessore] = useState('');
  const [tipoEsame, setTipoEsame] = useState<TipoEsame | null>(null);
  const [caricamento, setCaricamento] = useState(!!idModifica);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Com'era l'esame prima di questa modifica: una reazione nasce solo quando
  // un esame DIVENTA superato, non quando se ne corregge uno già a libretto.
  const eraSuperato = useRef(false);

  useEffect(() => {
    if (!idModifica) return;
    (async () => {
      const { data } = await supabase.from('exams').select('*').eq('id', idModifica).maybeSingle();
      const e = data as Esame | null;
      if (e) {
        setMateria(e.materia);
        setCfu(e.cfu != null ? String(e.cfu) : '');
        setSostenuto(e.voto != null || e.idoneita);
        setIdoneita(e.idoneita);
        eraSuperato.current = e.voto != null || e.idoneita;
        setVoto(e.voto);
        setLode(e.lode);
        setDataTesto(isoAItaliano(e.data_esame));
        setProfessore(e.professore ?? '');
        setTipoEsame(e.tipo_esame ?? null);
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
    const conVoto = sostenuto && !idoneita;
    if (conVoto && voto == null) {
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
        voto: conVoto ? voto : null,
        lode: conVoto && voto === VOTO_MAX ? lode : false,
        idoneita: sostenuto && idoneita,
        professore: professore.trim() || null,
        tipo_esame: tipoEsame,
      },
      idModifica
    );
    setSalvataggio(false);

    if (erroreDb) {
      setErrore(erroreDb);
      return;
    }

    // Reazione del personaggio: al massimo una per salvataggio, e solo se
    // l'esame è appena diventato superato.
    const stato = useAppStore.getState();
    const eraTarget = eEsameTarget(stato.profilo?.profilo_studio?.esame_target, {
      id: idModifica ?? null,
      materia: materia.trim(),
    });
    const reazione = sostenuto
      ? reazionePerEsame({
          materia: materia.trim(),
          voto: conVoto ? voto : null,
          lode: conVoto && voto === VOTO_MAX ? lode : false,
          giaSuperato: eraSuperato.current,
          eraTarget,
        })
      : null;
    if (sostenuto && !eraSuperato.current && eraTarget) stato.segnaTargetSuperato();

    router.back();
    // Dopo la chiusura della schermata, così compare sopra il libretto.
    if (reazione) setTimeout(() => useAppStore.getState().mostraReazione(reazione), 450);
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
                {!sostenuto
                  ? 'Esame ancora da fare (non entra nella media)'
                  : idoneita
                    ? 'Idoneità: i CFU contano, la media no'
                    : 'Inserisci il voto qui sotto'}
              </Text>
            </View>
            <Switch
              value={sostenuto}
              onValueChange={setSostenuto}
              trackColor={{ true: colori.accento, false: colori.bordo }}
              thumbColor={colori.superficie}
            />
          </View>

          {sostenuto ? (
            <View style={stili.rigaChip}>
              {[
                { valore: false, etichetta: 'Con voto' },
                { valore: true, etichetta: 'Idoneità (senza voto)' },
              ].map((o) => {
                const attivo = idoneita === o.valore;
                return (
                  <Pressable
                    key={o.etichetta}
                    onPress={() => setIdoneita(o.valore)}
                    style={[stili.chipTipo, attivo && stili.chipTipoAttivo]}
                  >
                    <Text style={[stili.testoChipTipo, attivo && stili.testoChipTipoAttivo]}>
                      {o.etichetta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {sostenuto && !idoneita ? (
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

          <CampoTesto
            etichetta="Professore (facoltativo)"
            value={professore}
            onChangeText={setProfessore}
            placeholder="Nome del docente"
          />

          <View style={stili.gruppo}>
            <Text style={stili.etichettaGruppo}>Tipo d'esame (facoltativo)</Text>
            <View style={stili.rigaChip}>
              {TIPI_ESAME.map((t) => {
                const attivo = tipoEsame === t.valore;
                return (
                  <Pressable
                    key={t.valore}
                    onPress={() => setTipoEsame(attivo ? null : t.valore)}
                    style={[stili.chipTipo, attivo && stili.chipTipoAttivo]}
                  >
                    <Text style={[stili.testoChipTipo, attivo && stili.testoChipTipoAttivo]}>
                      {t.etichetta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

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
  chipTipo: {
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
    borderRadius: raggi.sm,
    backgroundColor: colori.superficie,
    borderWidth: 1,
    borderColor: colori.bordo,
    alignItems: 'center',
  },
  chipTipoAttivo: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
  },
  testoChipTipo: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
  },
  testoChipTipoAttivo: {
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
