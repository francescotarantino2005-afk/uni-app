import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LezioneEstratta } from '@/lib/estrazioneOrario';
import { GIORNI_BREVI, normalizzaOra } from '@/lib/date';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { StatoVuoto } from '@/components/StatoVuoto';
import { colori, coloriLezione, raggi, spazi } from '@/lib/theme';

/** Anteprima modificabile delle lezioni estratte dalla foto, prima del salvataggio. */
export default function SchermataAnteprimaOrario() {
  const { da } = useLocalSearchParams<{ da?: string }>();
  const daOnboarding = da === 'onboarding';

  const utente = useAppStore((s) => s.utente);
  const ateneoSelezionato = useAppStore((s) => s.ateneoSelezionato);
  const lezioniIniziali = useAppStore((s) => s.lezioniEstratte);
  const impostaLezioniEstratte = useAppStore((s) => s.impostaLezioniEstratte);
  const impostaFotoOrario = useAppStore((s) => s.impostaFotoOrario);

  const [lezioni, setLezioni] = useState<LezioneEstratta[]>(lezioniIniziali ?? []);
  const [aperta, setAperta] = useState<number | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const aggiorna = (indice: number, patch: Partial<LezioneEstratta>) => {
    setLezioni((prima) => prima.map((l, i) => (i === indice ? { ...l, ...patch } : l)));
  };

  const rimuovi = (indice: number) => {
    setAperta(null);
    setLezioni((prima) => prima.filter((_, i) => i !== indice));
  };

  const conferma = async () => {
    setErrore(null);
    if (!utente) {
      setErrore('Sessione scaduta: accedi di nuovo.');
      return;
    }

    // validazione: titolo e ora di inizio obbligatori
    for (const [i, l] of lezioni.entries()) {
      if (!l.titolo.trim() || !normalizzaOra(l.ora_inizio)) {
        setAperta(i);
        setErrore(`Controlla la lezione ${i + 1}: serve un nome e un'ora di inizio valida (HH:MM).`);
        return;
      }
      if (l.ora_fine && !normalizzaOra(l.ora_fine)) {
        setAperta(i);
        setErrore(`Controlla la lezione ${i + 1}: ora di fine non valida (usa HH:MM).`);
        return;
      }
    }

    setSalvataggio(true);
    try {
      // Durante l'onboarding il profilo non esiste ancora: lo creiamo qui
      // (schedule_events.user_id punta a profiles).
      if (daOnboarding) {
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: utente.id, ateneo: ateneoSelezionato });
        if (error) throw error;
      }

      const righe = lezioni.map((l, i) => ({
        user_id: utente.id,
        titolo: l.titolo.trim(),
        giorno: l.giorno,
        ora_inizio: normalizzaOra(l.ora_inizio)!,
        ora_fine: l.ora_fine ? normalizzaOra(l.ora_fine) : null,
        aula: l.aula?.trim() || null,
        colore: coloriLezione[i % coloriLezione.length],
      }));
      const { error } = await supabase.from('schedule_events').insert(righe);
      if (error) throw error;

      impostaLezioniEstratte(null);
      impostaFotoOrario(null);
      if (daOnboarding) {
        router.replace('/onboarding/notifiche');
      } else {
        router.back();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setErrore(
        /network request failed|fetch failed/i.test(msg)
          ? 'Sembra che tu sia offline: controlla la connessione e riprova.'
          : 'Non siamo riusciti a salvare le lezioni. Riprova tra poco.'
      );
    } finally {
      setSalvataggio(false);
    }
  };

  const riga = (lezione: LezioneEstratta, indice: number) => {
    const espansa = aperta === indice;
    return (
      <View style={stili.riga}>
        <Pressable
          style={stili.intestazioneRiga}
          onPress={() => setAperta(espansa ? null : indice)}
        >
          <View style={stili.badgeGiorno}>
            <Text style={stili.testoBadge}>{GIORNI_BREVI[lezione.giorno - 1] ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={stili.titoloRiga} numberOfLines={1}>
              {lezione.titolo || '(senza nome)'}
            </Text>
            <Text style={stili.dettagliRiga}>
              {lezione.ora_inizio}
              {lezione.ora_fine ? `–${lezione.ora_fine}` : ''}
              {lezione.aula ? `  ·  ${lezione.aula}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => rimuovi(indice)} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={colori.testoSecondario} />
          </Pressable>
          <Ionicons
            name={espansa ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colori.testoSecondario}
          />
        </Pressable>

        {espansa ? (
          <View style={stili.editor}>
            <CampoTesto
              etichetta="Materia"
              value={lezione.titolo}
              onChangeText={(t) => aggiorna(indice, { titolo: t })}
            />
            <View style={stili.rigaChip}>
              {GIORNI_BREVI.map((etichetta, g) => {
                const attivo = lezione.giorno === g + 1;
                return (
                  <Pressable
                    key={etichetta}
                    onPress={() => aggiorna(indice, { giorno: g + 1 })}
                    style={[stili.chip, attivo && stili.chipAttivo]}
                  >
                    <Text style={[stili.testoChip, attivo && stili.testoChipAttivo]}>
                      {etichetta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={stili.rigaOre}>
              <View style={{ flex: 1 }}>
                <CampoTesto
                  etichetta="Inizio"
                  value={lezione.ora_inizio}
                  onChangeText={(t) => aggiorna(indice, { ora_inizio: t })}
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <CampoTesto
                  etichetta="Fine"
                  value={lezione.ora_fine ?? ''}
                  onChangeText={(t) => aggiorna(indice, { ora_fine: t || null })}
                  placeholder="11:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <CampoTesto
                  etichetta="Aula"
                  value={lezione.aula ?? ''}
                  onChangeText={(t) => aggiorna(indice, { aula: t || null })}
                  placeholder="T4"
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <View>
          <Text style={stili.titoloPagina}>Ecco il tuo orario 🎉</Text>
          <Text style={stili.sottotitolo}>
            Controlla le {lezioni.length} lezioni trovate: tocca per correggere, poi conferma.
          </Text>
        </View>
      </View>

      <FlatList
        data={lezioni}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={stili.lista}
        renderItem={({ item, index }) => riga(item, index)}
        ListEmptyComponent={
          <StatoVuoto
            titolo="Nessuna lezione rimasta"
            suggerimento="Torna indietro e riprova con un'altra foto."
          />
        }
      />

      <View style={stili.pie}>
        <MessaggioErrore messaggio={errore} />
        <BottonePrimario
          etichetta={`Conferma ${lezioni.length} lezioni`}
          onPress={conferma}
          disabilitato={lezioni.length === 0}
          caricamento={salvataggio}
        />
        <Pressable onPress={() => router.back()} disabled={salvataggio}>
          <Text style={stili.linkSecondario}>Riprova con un'altra foto</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  intestazione: {
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
    gap: spazi.xs,
  },
  titoloPagina: {
    color: colori.testo,
    fontSize: 22,
    fontWeight: '800',
  },
  sottotitolo: {
    color: colori.testoSecondario,
    fontSize: 14,
    lineHeight: 20,
  },
  lista: {
    paddingHorizontal: spazi.lg,
    gap: spazi.sm,
    paddingBottom: spazi.md,
  },
  riga: {
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
  },
  intestazioneRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    padding: spazi.md,
  },
  badgeGiorno: {
    width: 44,
    paddingVertical: spazi.xs,
    borderRadius: raggi.sm,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
  },
  testoBadge: {
    color: colori.testoSecondario,
    fontSize: 12,
    fontWeight: '700',
  },
  titoloRiga: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '600',
  },
  dettagliRiga: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  editor: {
    padding: spazi.md,
    paddingTop: 0,
    gap: spazi.sm,
  },
  rigaChip: {
    flexDirection: 'row',
    gap: spazi.xs,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: spazi.xs + 2,
    paddingHorizontal: spazi.sm,
    borderRadius: raggi.sm,
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
  rigaOre: {
    flexDirection: 'row',
    gap: spazi.sm,
  },
  pie: {
    padding: spazi.lg,
    paddingTop: spazi.sm,
    gap: spazi.md,
  },
  linkSecondario: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
