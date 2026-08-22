import { useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { messaggioErroreAuth } from '@/lib/erroriAuth';
import { useAppStore } from '@/store/useAppStore';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

type Modalita = 'accesso' | 'registrazione';

export default function SchermataAuth() {
  const [modalita, setModalita] = useState<Modalita>('registrazione');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const caricaProfilo = useAppStore((s) => s.caricaProfilo);

  const invia = async () => {
    setErrore(null);
    setInfo(null);

    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      setErrore('Inserisci email e password.');
      return;
    }

    setCaricamento(true);
    try {
      if (modalita === 'registrazione') {
        const { data, error } = await supabase.auth.signUp({ email: mail, password });
        if (error) {
          setErrore(messaggioErroreAuth(error));
          return;
        }
        if (!data.session) {
          // progetto con conferma email attiva
          setInfo(
            'Ti abbiamo mandato una mail di conferma: aprila, poi torna qui e accedi.'
          );
          setModalita('accesso');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) {
          setErrore(messaggioErroreAuth(error));
          return;
        }
      }

      await caricaProfilo();
      router.replace('/');
    } catch (e) {
      setErrore(messaggioErroreAuth(e));
    } finally {
      setCaricamento(false);
    }
  };

  const cambiaModalita = () => {
    setErrore(null);
    setInfo(null);
    setModalita(modalita === 'accesso' ? 'registrazione' : 'accesso');
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={stili.contenuto}
          keyboardShouldPersistTaps="handled"
        >
          <View style={stili.cerchioIcona}>
            <Ionicons name="sparkles-outline" size={36} color={colori.accento} />
          </View>
          <Text style={stili.titolo}>Lode</Text>
          <Text style={stili.sottotitolo}>
            {modalita === 'registrazione'
              ? 'Crea il tuo account: bastano email e password.'
              : 'Bentornato! Accedi per continuare.'}
          </Text>

          <View style={stili.modulo}>
            <CampoTesto
              etichetta="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nome@esempio.it"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <CampoTesto
              etichetta="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Almeno 6 caratteri"
              secureTextEntry
              autoComplete={modalita === 'registrazione' ? 'new-password' : 'current-password'}
            />

            <MessaggioErrore messaggio={errore} />
            <MessaggioErrore messaggio={info} informativo />

            <BottonePrimario
              etichetta={modalita === 'registrazione' ? 'Registrati' : 'Accedi'}
              onPress={invia}
              caricamento={caricamento}
            />

            <Pressable onPress={cambiaModalita} disabled={caricamento}>
              <Text style={stili.linkCambio}>
                {modalita === 'registrazione'
                  ? 'Hai già un account? Accedi'
                  : 'Prima volta qui? Registrati'}
              </Text>
            </Pressable>
          </View>
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
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  sottotitolo: {
    color: colori.testoSecondario,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
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
