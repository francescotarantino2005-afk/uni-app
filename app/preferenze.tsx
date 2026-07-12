import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { programmaBriefingLocale, salvaTokenPush } from '@/lib/notifiche';
import { inviaBriefingProva } from '@/lib/briefingDb';
import { oraBreve } from '@/lib/date';
import { BottonePrimario } from '@/components/BottonePrimario';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

// Orari proposti per il briefing (mezz'ora dalle 6:00 alle 10:00).
const ORARI: string[] = [];
for (let h = 6; h <= 10; h++) {
  ORARI.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 10) ORARI.push(`${String(h).padStart(2, '0')}:30`);
}

export default function SchermataPreferenze() {
  const utente = useAppStore((s) => s.utente);
  const profilo = useAppStore((s) => s.profilo);
  const aggiornaOraBriefing = useAppStore((s) => s.aggiornaOraBriefing);

  const [ora, setOra] = useState(oraBreve(profilo?.ora_briefing ?? '07:30') || '07:30');
  const [salvataggio, setSalvataggio] = useState(false);
  const [prova, setProva] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const salva = async () => {
    setErrore(null);
    setInfo(null);
    setSalvataggio(true);

    const erroreDb = await aggiornaOraBriefing(ora);
    if (erroreDb) {
      setErrore(erroreDb);
      setSalvataggio(false);
      return;
    }

    // Programma la notifica locale all'ora scelta e registra il token push (best effort).
    const notificheOk = await programmaBriefingLocale(ora);
    if (utente) await salvaTokenPush(utente.id);
    setSalvataggio(false);

    if (!notificheOk) {
      setInfo(
        `Orario salvato (${ora}). Per ricevere la notifica del mattino, attiva i permessi delle notifiche dalle impostazioni del telefono.`
      );
      return;
    }
    setInfo(`Fatto! Ogni mattina alle ${ora} ti avviso con il tuo briefing.`);
  };

  const inviaProva = async () => {
    setErrore(null);
    setInfo(null);
    setProva(true);
    const { contenuto, errore: erroreProva } = await inviaBriefingProva();
    setProva(false);
    if (erroreProva) {
      setErrore(erroreProva);
      return;
    }
    const messaggio = contenuto
      ? `Ecco un'anteprima del tuo briefing:\n\n${contenuto}`
      : 'Briefing generato. Se hai una dev build con le notifiche attive, riceverai anche la push.';
    if (Platform.OS === 'web') {
      setInfo(messaggio);
    } else {
      Alert.alert('Briefing di prova', messaggio);
    }
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Text style={stili.titoloPagina}>Il briefing del mattino</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={stili.contenuto}>
        <Text style={stili.descrizione}>
          Ogni mattina all'ora che scegli ti mando la tua giornata: lezioni, scadenze in arrivo
          e cosa conviene studiare.
        </Text>

        <Text style={stili.etichettaGruppo}>A che ora?</Text>
        <View style={stili.griglia}>
          {ORARI.map((o) => {
            const attivo = ora === o;
            return (
              <Pressable
                key={o}
                onPress={() => setOra(o)}
                style={[stili.chip, attivo && stili.chipAttivo]}
              >
                <Text style={[stili.testoChip, attivo && stili.testoChipAttivo]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>

        <MessaggioErrore messaggio={errore} />
        <MessaggioErrore messaggio={info} informativo />

        <BottonePrimario etichetta="Salva" onPress={salva} caricamento={salvataggio} />

        <View style={stili.separatore} />

        <Text style={stili.etichettaGruppo}>Vuoi vederlo subito?</Text>
        <Text style={stili.notaProva}>
          Genero ora un briefing di prova sui tuoi dati reali (e te lo invio come push, se le
          notifiche sono attive).
        </Text>
        <Pressable
          style={[stili.bottoneProva, prova && stili.bottoneProvaDisabilitato]}
          onPress={inviaProva}
          disabled={prova}
        >
          <Ionicons name="sparkles-outline" size={18} color={colori.accento} />
          <Text style={stili.testoProva}>
            {prova ? 'Sto generando…' : 'Mandami un briefing di prova'}
          </Text>
        </Pressable>
      </ScrollView>
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
  descrizione: {
    color: colori.testoSecondario,
    fontSize: 14,
    lineHeight: 21,
  },
  etichettaGruppo: {
    color: colori.testo,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spazi.sm,
  },
  griglia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spazi.sm,
  },
  chip: {
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
    borderRadius: raggi.pieno,
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
    fontSize: 15,
    fontWeight: '600',
  },
  testoChipAttivo: {
    color: colori.accento,
  },
  separatore: {
    height: 1,
    backgroundColor: colori.bordo,
    marginVertical: spazi.sm,
  },
  notaProva: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 19,
  },
  bottoneProva: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.md,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderColor: colori.accento,
    backgroundColor: colori.accentoTenue,
  },
  bottoneProvaDisabilitato: {
    opacity: 0.6,
  },
  testoProva: {
    color: colori.accento,
    fontSize: 15,
    fontWeight: '700',
  },
});
