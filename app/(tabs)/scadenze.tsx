import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { aggiungiScadenza, caricaScadenze, impostaCompletata } from '@/lib/scadenzeDb';
import { Scadenza } from '@/lib/tipi';
import { parseDataItaliana } from '@/lib/date';
import { CATEGORIE, ChiaveCategoria } from '@/lib/categorie';
import { useAppStore } from '@/store/useAppStore';
import { RigaScadenza } from '@/components/RigaScadenza';
import { StatoVuoto } from '@/components/StatoVuoto';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function SchermataScadenze() {
  const utente = useAppStore((s) => s.utente);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  // form di aggiunta rapida
  const [formAperto, setFormAperto] = useState(false);
  const [titolo, setTitolo] = useState('');
  const [dataTesto, setDataTesto] = useState('');
  const [categoria, setCategoria] = useState<ChiaveCategoria>('altro');
  const [salvataggio, setSalvataggio] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  const carica = useCallback(async () => {
    const { dati, errore } = await caricaScadenze();
    setScadenze(dati);
    setErrore(errore);
    setCaricamento(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carica();
    }, [carica])
  );

  const aggiungi = async () => {
    setErroreForm(null);
    if (!utente) {
      setErroreForm('Sessione scaduta: accedi di nuovo.');
      return;
    }
    if (!titolo.trim()) {
      setErroreForm('Dai un titolo alla scadenza (es. "Seconda rata tasse").');
      return;
    }
    const dataIso = parseDataItaliana(dataTesto);
    if (!dataIso) {
      setErroreForm('Data non valida: usa il formato GG/MM/AAAA (es. 30/09/2026).');
      return;
    }

    setSalvataggio(true);
    const { errore: erroreDb } = await aggiungiScadenza(utente.id, {
      titolo: titolo.trim(),
      data: dataIso,
      categoria,
    });
    setSalvataggio(false);

    if (erroreDb) {
      setErroreForm(erroreDb);
      return;
    }
    setTitolo('');
    setDataTesto('');
    setCategoria('altro');
    setFormAperto(false);
    await carica();
  };

  const commuta = async (scadenza: Scadenza) => {
    // aggiornamento ottimista, con rollback se il server dice di no
    setScadenze((prima) =>
      prima.map((s) => (s.id === scadenza.id ? { ...s, completata: !s.completata } : s))
    );
    const { errore: erroreDb } = await impostaCompletata(scadenza.id, !scadenza.completata);
    if (erroreDb) {
      setScadenze((prima) =>
        prima.map((s) => (s.id === scadenza.id ? { ...s, completata: scadenza.completata } : s))
      );
      setErrore(erroreDb);
    }
  };

  const ordinate = [...scadenze].sort((a, b) => {
    if (a.completata !== b.completata) return a.completata ? 1 : -1;
    return a.data.localeCompare(b.data);
  });

  return (
    <View style={stili.schermo}>
      <MessaggioErrore messaggio={errore} />

      {!formAperto ? (
        <Pressable style={stili.banner} onPress={() => router.push('/template-scadenze')}>
          <Ionicons name="sparkles-outline" size={20} color={colori.accento} />
          <View style={{ flex: 1 }}>
            <Text style={stili.testoBanner}>Scadenze da non perdere</Text>
            <Text style={stili.sottoBanner}>ISEE, tasse, borse: aggiungile in un tap</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colori.testoSecondario} />
        </Pressable>
      ) : null}

      {formAperto ? (
        <View style={stili.form}>
          <CampoTesto
            etichetta="Titolo"
            value={titolo}
            onChangeText={setTitolo}
            placeholder="Seconda rata tasse"
          />
          <CampoTesto
            etichetta="Data"
            value={dataTesto}
            onChangeText={setDataTesto}
            placeholder="30/09/2026"
            keyboardType="numbers-and-punctuation"
          />
          <View style={stili.rigaChip}>
            {CATEGORIE.map((c) => {
              const attiva = categoria === c.chiave;
              return (
                <Pressable
                  key={c.chiave}
                  onPress={() => setCategoria(c.chiave)}
                  style={[stili.chip, attiva && stili.chipAttivo]}
                >
                  <Ionicons
                    name={c.icona}
                    size={14}
                    color={attiva ? colori.accento : colori.testoSecondario}
                  />
                  <Text style={[stili.testoChip, attiva && stili.testoChipAttivo]}>
                    {c.etichetta}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <MessaggioErrore messaggio={erroreForm} />
          <BottonePrimario etichetta="Aggiungi scadenza" onPress={aggiungi} caricamento={salvataggio} />
          <Pressable onPress={() => setFormAperto(false)} disabled={salvataggio}>
            <Text style={stili.linkAnnulla}>Annulla</Text>
          </Pressable>
        </View>
      ) : null}

      {caricamento ? (
        <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.xl }} />
      ) : (
        <FlatList
          data={ordinate}
          keyExtractor={(s) => s.id}
          contentContainerStyle={stili.lista}
          renderItem={({ item }) => (
            <RigaScadenza scadenza={item} onToggle={() => commuta(item)} />
          )}
          ListEmptyComponent={
            <StatoVuoto
              titolo="Nessuna scadenza (per ora)"
              suggerimento="ISEE, tasse, borse, esami: aggiungi la prima col bottone qui sotto."
            />
          }
        />
      )}

      {!formAperto ? (
        <Pressable style={stili.bottoneAggiungi} onPress={() => setFormAperto(true)}>
          <Ionicons name="add" size={26} color="#0D0F14" />
          <Text style={stili.testoAggiungi}>Scadenza</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
    padding: spazi.md,
    gap: spazi.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.md,
    paddingHorizontal: spazi.md,
  },
  testoBanner: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '700',
  },
  sottoBanner: {
    color: colori.testoSecondario,
    fontSize: 12,
  },
  form: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
    gap: spazi.md,
  },
  rigaChip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spazi.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spazi.xs + 2,
    paddingHorizontal: spazi.sm,
    borderRadius: raggi.pieno,
    backgroundColor: colori.sfondo,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  chipAttivo: {
    backgroundColor: colori.accentoTenue,
    borderColor: colori.accento,
  },
  testoChip: {
    color: colori.testoSecondario,
    fontSize: 12,
    fontWeight: '600',
  },
  testoChipAttivo: {
    color: colori.accento,
  },
  linkAnnulla: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  lista: {
    gap: spazi.sm,
    // FAB (42: spazi.sm*2 + icona 26) + margine bottom spazi.lg (24) + 16
    paddingBottom: 82,
  },
  bottoneAggiungi: {
    position: 'absolute',
    right: spazi.lg,
    bottom: spazi.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    backgroundColor: colori.accento,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
  },
  testoAggiungi: {
    color: '#0D0F14',
    fontSize: 15,
    fontWeight: '700',
  },
});
