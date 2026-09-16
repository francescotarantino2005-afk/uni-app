import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '@/lib/supabase';
import { messaggioErroreAuth } from '@/lib/erroriAuth';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

type Stato = 'verifica' | 'pronto' | 'scaduto';

export default function ResetPassword() {
  const completaRecupero = useAppStore((s) => s.completaRecupero);
  const annullaRecupero = useAppStore((s) => s.annullaRecupero);

  const [stato, setStato] = useState<Stato>('verifica');
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  useEffect(() => {
    // La sessione di recupero deve già esistere: entraInRecupero l'ha stabilita
    // con i token del link. Se manca, il link era scaduto o non valido.
    supabase.auth.getSession().then(({ data }) => {
      setStato(data.session ? 'pronto' : 'scaduto');
    });
  }, []);

  const salva = async () => {
    setErrore(null);

    const pw = password.trim();
    const pw2 = conferma.trim();
    if (pw !== password) setPassword(pw);
    if (pw2 !== conferma) setConferma(pw2);

    if (pw.length < 6) {
      setErrore('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (pw !== pw2) {
      setErrore('Le due password non coincidono.');
      return;
    }

    setCaricamento(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setErrore(messaggioErroreAuth(error));
        return;
      }
      // Riuscito: chiude il recupero e porta dentro l'app, già autenticato.
      await completaRecupero();
      router.replace('/');
    } catch (e) {
      setErrore(messaggioErroreAuth(e));
    } finally {
      setCaricamento(false);
    }
  };

  const richiediNuovo = async () => {
    await annullaRecupero();
    router.replace('/recupera-password');
  };

  const annulla = async () => {
    await annullaRecupero();
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={stili.contenuto} keyboardShouldPersistTaps="handled">
          <View style={stili.cerchioIcona}>
            <Ionicons
              name={stato === 'scaduto' ? 'alert-circle-outline' : 'lock-closed-outline'}
              size={34}
              color={stato === 'scaduto' ? colori.errore : colori.accento}
            />
          </View>

          {stato === 'verifica' ? (
            <ActivityIndicator color={colori.accento} style={{ marginTop: spazi.lg }} />
          ) : stato === 'scaduto' ? (
            <>
              <Text style={stili.titolo}>Link scaduto</Text>
              <Text style={stili.sottotitolo}>
                Questo link per reimpostare la password è scaduto o è già stato usato. Richiedine uno
                nuovo e riprova.
              </Text>
              <View style={stili.modulo}>
                <BottonePrimario etichetta="Richiedi un nuovo link" onPress={richiediNuovo} />
                <Pressable onPress={annulla}>
                  <Text style={stili.linkCambio}>Torna all'accesso</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={stili.titolo}>Nuova password</Text>
              <Text style={stili.sottotitolo}>Scegli una password: almeno 6 caratteri.</Text>

              <View style={stili.modulo}>
                <CampoTesto
                  etichetta="Nuova password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Almeno 6 caratteri"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <CampoTesto
                  etichetta="Conferma password"
                  value={conferma}
                  onChangeText={setConferma}
                  placeholder="Ripeti la password"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />

                <MessaggioErrore messaggio={errore} />

                <BottonePrimario
                  etichetta="Salva la nuova password"
                  onPress={salva}
                  caricamento={caricamento}
                />

                <Pressable onPress={annulla} disabled={caricamento}>
                  <Text style={stili.linkCambio}>Annulla</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  contenuto: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spazi.lg,
    gap: spazi.md,
    alignItems: 'center',
  },
  cerchioIcona: {
    width: 84,
    height: 84,
    borderRadius: raggi.pieno,
    backgroundColor: colori.accentoTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titolo: {
    color: colori.testo,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  sottotitolo: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  modulo: {
    alignSelf: 'stretch',
    gap: spazi.md,
    marginTop: spazi.sm,
  },
  linkCambio: {
    color: colori.accento,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spazi.xs,
  },
});
