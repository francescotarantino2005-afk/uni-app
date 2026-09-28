import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EsameEstratto } from '@/lib/estrazioneLibretto';
import { DatiEsame, inserisciEsami } from '@/lib/esamiDb';
import { VOTO_MAX, VOTO_MIN } from '@/lib/libretto';
import { isoAItaliano, parseDataItaliana } from '@/lib/date';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

const VOTI = Array.from({ length: VOTO_MAX - VOTO_MIN + 1 }, (_, i) => VOTO_MIN + i);

type Stato = 'voto' | 'idoneita' | 'da_sostenere';

const STATI: { valore: Stato; etichetta: string }[] = [
  { valore: 'voto', etichetta: 'Con voto' },
  { valore: 'idoneita', etichetta: 'Idoneità' },
  { valore: 'da_sostenere', etichetta: 'Da sostenere' },
];

/** Una riga in revisione: testo libero finché lo studente non conferma. */
type Riga = {
  id: number;
  materia: string;
  stato: Stato;
  voto: number | null;
  lode: boolean;
  cfu: string;
  /** GG/MM/AAAA */
  data: string;
};

function daEstratto(e: EsameEstratto, id: number): Riga {
  return {
    id,
    materia: e.materia,
    stato: e.esito === 'nessun_esito' ? 'da_sostenere' : e.esito,
    voto: e.voto,
    lode: e.lode,
    cfu: e.cfu != null ? String(e.cfu) : '',
    data: isoAItaliano(e.data_esame),
  };
}

/** Riga che richiede un intervento: lo si segnala già da chiusa. */
function daCompletare(r: Riga): boolean {
  return !r.materia.trim() || (r.stato === 'voto' && r.voto == null);
}

function descriviStato(r: Riga): string {
  if (r.stato === 'idoneita') return 'idoneo';
  if (r.stato === 'da_sostenere') return 'da sostenere';
  if (r.voto == null) return 'voto non letto';
  return r.lode && r.voto === VOTO_MAX ? '30 e lode' : String(r.voto);
}

/**
 * Conferma dell'import del libretto. REGOLA: nel libretto entra solo ciò che lo
 * studente ha visto qui e confermato col bottone in fondo. Ogni riga si può
 * correggere, togliere, e se ne può aggiungere una a mano.
 */
export default function ConfermaLibretto() {
  const utente = useAppStore((s) => s.utente);
  const estratti = useAppStore((s) => s.esamiEstratti);
  const impostaEsamiEstratti = useAppStore((s) => s.impostaEsamiEstratti);
  const impostaFotoLibretto = useAppStore((s) => s.impostaFotoLibretto);
  const aggiornaAccoglienza = useAppStore((s) => s.aggiornaAccoglienza);

  const prossimoId = useRef((estratti ?? []).length);
  const [righe, setRighe] = useState<Riga[]>(() => (estratti ?? []).map(daEstratto));
  const [aperta, setAperta] = useState<number | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Gli esami sono già entrati ma l'avanzamento dell'accoglienza no: al nuovo
  // tentativo si ripete solo quello, senza inserire due volte gli stessi esami.
  const esamiSalvati = useRef(false);

  const aggiorna = (id: number, patch: Partial<Riga>) => {
    setRighe((prima) => prima.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const togli = (id: number) => {
    setAperta(null);
    setRighe((prima) => prima.filter((r) => r.id !== id));
  };

  const aggiungiAMano = () => {
    const id = prossimoId.current++;
    setRighe((prima) => [
      ...prima,
      { id, materia: '', stato: 'voto', voto: null, lode: false, cfu: '', data: '' },
    ]);
    setAperta(id);
  };

  const scegliVoto = (id: number, voto: number) => {
    aggiorna(id, voto === VOTO_MAX ? { voto } : { voto, lode: false }); // lode solo sul 30
  };

  const salva = async () => {
    setErrore(null);
    if (!utente) {
      setErrore('Sessione scaduta: accedi di nuovo.');
      return;
    }

    const dati: DatiEsame[] = [];
    for (const [i, r] of righe.entries()) {
      const n = i + 1;
      const problema = (testo: string) => {
        setAperta(r.id);
        setErrore(`Riga ${n}: ${testo}`);
      };
      if (!r.materia.trim()) return problema('manca il nome dell\'esame.');
      if (r.stato === 'voto' && r.voto == null) {
        return problema('non sono riuscito a leggere il voto: sceglilo, o cambia in "Idoneità" o "Da sostenere".');
      }
      const cfu = r.cfu.trim() ? Number(r.cfu.trim()) : null;
      if (cfu != null && (!Number.isInteger(cfu) || cfu <= 0)) {
        return problema('i CFU devono essere un numero intero positivo (o lasciali vuoti).');
      }
      let dataIso: string | null = null;
      if (r.data.trim()) {
        dataIso = parseDataItaliana(r.data);
        if (!dataIso) return problema('data non valida, usa GG/MM/AAAA (o lasciala vuota).');
      }
      dati.push({
        materia: r.materia.trim(),
        cfu,
        data_esame: dataIso,
        voto: r.stato === 'voto' ? r.voto : null,
        lode: r.stato === 'voto' && r.voto === VOTO_MAX && r.lode,
        idoneita: r.stato === 'idoneita',
        professore: null,
        tipo_esame: null,
      });
    }

    setSalvataggio(true);
    if (!esamiSalvati.current) {
      const { errore: erroreDb } = await inserisciEsami(utente.id, dati);
      if (erroreDb) {
        setSalvataggio(false);
        setErrore(erroreDb);
        return;
      }
      esamiSalvati.current = true;
    }
    const err = await aggiornaAccoglienza({ accoglienza_stato: 'orario' });
    setSalvataggio(false);
    if (err) {
      setErrore(err);
      return;
    }

    impostaEsamiEstratti(null);
    impostaFotoLibretto([]);
    router.replace('/onboarding/libretto-pronto');
  };

  const riga = (r: Riga, indice: number) => {
    const espansa = aperta === r.id;
    const attenzione = daCompletare(r);
    return (
      <View key={r.id} style={[stili.riga, attenzione && stili.rigaAttenzione]}>
        <Pressable style={stili.intestazioneRiga} onPress={() => setAperta(espansa ? null : r.id)}>
          <Text style={stili.numero}>{indice + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={stili.titoloRiga} numberOfLines={1}>
              {r.materia.trim() || '(senza nome)'}
            </Text>
            <Text style={stili.dettagliRiga}>
              {r.cfu.trim() ? `${r.cfu.trim()} CFU` : 'CFU ?'}
              {r.data.trim() ? `  ·  ${r.data.trim()}` : ''}
            </Text>
          </View>
          <Text style={[stili.esito, attenzione && stili.esitoAttenzione]}>{descriviStato(r)}</Text>
          <Pressable onPress={() => togli(r.id)} hitSlop={10}>
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
              etichetta="Esame"
              value={r.materia}
              onChangeText={(t) => aggiorna(r.id, { materia: t })}
              placeholder="Analisi Matematica 1"
            />
            <View style={stili.rigaChip}>
              {STATI.map((s) => {
                const attivo = r.stato === s.valore;
                return (
                  <Pressable
                    key={s.valore}
                    onPress={() => aggiorna(r.id, { stato: s.valore })}
                    style={[stili.chip, attivo && stili.chipAttivo]}
                  >
                    <Text style={[stili.testoChip, attivo && stili.testoChipAttivo]}>
                      {s.etichetta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {r.stato === 'voto' ? (
              <>
                <View style={stili.rigaChip}>
                  {VOTI.map((v) => {
                    const attivo = r.voto === v;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => scegliVoto(r.id, v)}
                        style={[stili.chipVoto, attivo && stili.chipAttivo]}
                      >
                        <Text style={[stili.testoChip, attivo && stili.testoChipAttivo]}>{v}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => r.voto === VOTO_MAX && aggiorna(r.id, { lode: !r.lode })}
                  style={[stili.rigaLode, r.voto !== VOTO_MAX && stili.disabilitato]}
                >
                  <Ionicons
                    name={r.lode && r.voto === VOTO_MAX ? 'star' : 'star-outline'}
                    size={18}
                    color={r.voto === VOTO_MAX ? colori.successo : colori.testoSecondario}
                  />
                  <Text style={stili.testoLode}>
                    30 e lode {r.voto !== VOTO_MAX ? '(solo con il 30)' : ''}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={stili.notaStato}>
                {r.stato === 'idoneita'
                  ? 'Superato senza voto: i CFU contano, la media no.'
                  : 'Non ancora dato: non entra nella media.'}
              </Text>
            )}

            <View style={stili.rigaCampi}>
              <View style={{ flex: 1 }}>
                <CampoTesto
                  etichetta="CFU"
                  value={r.cfu}
                  onChangeText={(t) => aggiorna(r.id, { cfu: t })}
                  placeholder="9"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 2 }}>
                <CampoTesto
                  etichetta={r.stato === 'da_sostenere' ? 'Data prevista' : 'Data'}
                  value={r.data}
                  onChangeText={(t) => aggiorna(r.id, { data: t })}
                  placeholder="GG/MM/AAAA"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const nDaCompletare = righe.filter(daCompletare).length;

  return (
    <SafeAreaView style={stili.schermo}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={stili.intestazione}>
          <Text style={stili.titoloPagina}>Ecco cosa ho letto</Text>
          <Text style={stili.sottotitolo}>
            Controlla riga per riga: tocca per correggere. Salvo solo quello che confermi. Dove non
            leggevo bene ho lasciato il campo vuoto.
          </Text>
          {nDaCompletare > 0 ? (
            <Text style={stili.avviso}>
              {nDaCompletare === 1 ? '1 riga da completare' : `${nDaCompletare} righe da completare`}
            </Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={stili.lista} keyboardShouldPersistTaps="handled">
          {righe.map(riga)}
          <Pressable style={stili.aggiungi} onPress={aggiungiAMano}>
            <Ionicons name="add" size={20} color={colori.accento} />
            <Text style={stili.testoAggiungi}>Aggiungi un esame a mano</Text>
          </Pressable>
        </ScrollView>

        <View style={stili.pie}>
          <MessaggioErrore messaggio={errore} />
          <BottonePrimario
            etichetta={
              righe.length === 1 ? 'Salva 1 esame nel libretto' : `Salva ${righe.length} esami nel libretto`
            }
            onPress={salva}
            disabilitato={righe.length === 0}
            caricamento={salvataggio}
          />
          <Pressable onPress={() => router.back()} disabled={salvataggio}>
            <Text style={stili.linkSecondario}>Riprova con altre foto</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  avviso: {
    color: colori.avviso,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spazi.xs,
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
  rigaAttenzione: {
    borderColor: colori.avvisoPallino,
  },
  intestazioneRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    padding: spazi.md,
  },
  numero: {
    color: colori.testoSecondario,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 18,
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
  esito: {
    color: colori.testo,
    fontSize: 13,
    fontWeight: '700',
  },
  esitoAttenzione: {
    color: colori.avviso,
  },
  editor: {
    padding: spazi.md,
    paddingTop: 0,
    gap: spazi.sm,
  },
  rigaChip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spazi.xs,
  },
  chip: {
    paddingVertical: spazi.xs + 2,
    paddingHorizontal: spazi.sm,
    borderRadius: raggi.sm,
    backgroundColor: colori.sfondo,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  chipVoto: {
    width: 40,
    paddingVertical: spazi.xs + 2,
    borderRadius: raggi.sm,
    backgroundColor: colori.sfondo,
    borderWidth: 1,
    borderColor: colori.bordo,
    alignItems: 'center',
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
    fontWeight: '800',
  },
  rigaLode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.xs,
  },
  disabilitato: {
    opacity: 0.5,
  },
  testoLode: {
    color: colori.testo,
    fontSize: 14,
    fontWeight: '600',
  },
  notaStato: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  rigaCampi: {
    flexDirection: 'row',
    gap: spazi.sm,
  },
  aggiungi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazi.xs,
    paddingVertical: spazi.md,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colori.bordo,
  },
  testoAggiungi: {
    color: colori.accento,
    fontSize: 14,
    fontWeight: '700',
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
