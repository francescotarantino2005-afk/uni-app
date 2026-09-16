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
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { isErroreRete, messaggioErroreAuth } from '@/lib/erroriAuth';
import { BottonePrimario } from '@/components/BottonePrimario';
import { CampoTesto } from '@/components/CampoTesto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function RecuperaPassword() {
  const [email, setEmail] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  const invia = async () => {
    setErrore(null);

    const mail = email.trim().toLowerCase();
    if (mail !== email) setEmail(mail);
    if (!mail) {
      setErrore('Inserisci la tua email.');
      return;
    }

    setCaricamento(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: Linking.createURL('reset-password'),
      });
      // Un errore di RETE va mostrato, per far ritentare. Ogni altro esito —
      // successo o email inesistente (che l'API di proposito non distingue) —
      // porta allo STESSO messaggio: non riveliamo mai se un account esiste.
      if (error && isErroreRete(error)) {
        setErrore(messaggioErroreAuth(error));
        return;
      }
      setInviato(true);
    } catch (e) {
      if (isErroreRete(e)) setErrore(messaggioErroreAuth(e));
      else setInviato(true);
    } finally {
      setCaricamento(false);
    }
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
              name={inviato ? 'mail-outline' : 'key-outline'}
              size={34}
              color={colori.accento}
            />
          </View>

          {inviato ? (
            <>
              <Text style={stili.titolo}>Controlla la posta</Text>
              <Text style={stili.sottotitolo}>
                Se esiste un account con questa email, ti abbiamo inviato un link per reimpostare la
                password. Guarda anche nello spam.
              </Text>
              <View style={stili.modulo}>
                <BottonePrimario
                  etichetta="Torna all'accesso"
                  onPress={() => router.replace('/auth')}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={stili.titolo}>Password dimenticata?</Text>
              <Text style={stili.sottotitolo}>
                Inserisci la tua email: ti mandiamo un link per impostarne una nuova.
              </Text>

              <View style={stili.modulo}>
                <CampoTesto
                  etichetta="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nome@esempio.it"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />

                <MessaggioErrore messaggio={errore} />

                <BottonePrimario
                  etichetta="Inviami il link"
                  onPress={invia}
                  caricamento={caricamento}
                />

                <Pressable onPress={() => router.back()} disabled={caricamento}>
                  <Text style={stili.linkCambio}>Torna all'accesso</Text>
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
