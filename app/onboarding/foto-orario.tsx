import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { useAppStore } from '@/store/useAppStore';
import { colori, raggi, spazi } from '@/lib/theme';

export default function PassoFotoOrario() {
  const fotoOrarioUri = useAppStore((s) => s.fotoOrarioUri);
  const impostaFotoOrario = useAppStore((s) => s.impostaFotoOrario);
  const [errore, setErrore] = useState<string | null>(null);

  const opzioniPicker: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: 0.8,
  };

  const gestisciRisultato = (risultato: ImagePicker.ImagePickerResult) => {
    if (!risultato.canceled && risultato.assets[0]) {
      impostaFotoOrario(risultato.assets[0].uri);
      setErrore(null);
    }
  };

  const scegliDallaGalleria = async () => {
    setErrore(null);
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permesso.granted) {
      setErrore('Senza accesso alle foto non possiamo leggere il tuo orario: puoi concederlo dalle impostazioni, o saltare questo passo.');
      return;
    }
    gestisciRisultato(await ImagePicker.launchImageLibraryAsync(opzioniPicker));
  };

  const scattaFoto = async () => {
    setErrore(null);
    const permesso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permesso.granted) {
      setErrore('Senza fotocamera non possiamo fotografare l\'orario: puoi concederla dalle impostazioni, o saltare questo passo.');
      return;
    }
    gestisciRisultato(await ImagePicker.launchCameraAsync(opzioniPicker));
  };

  const avanti = () => router.push('/onboarding/notifiche');

  return (
    <PassoOnboarding
      passo={2}
      icona="camera-outline"
      titolo="Fotografa il tuo orario"
      descrizione="Una foto o uno screenshot dell'orario delle lezioni: presto l'AI lo trasformerà nel tuo calendario personale."
      etichettaBottone="Continua"
      bottoneDisabilitato={!fotoOrarioUri}
      onAvanti={avanti}
      etichettaSecondaria="Salto, lo farò dopo"
      onSecondaria={avanti}
      errore={errore}
    >
      {fotoOrarioUri ? (
        <View style={stili.anteprimaContenitore}>
          <Image source={{ uri: fotoOrarioUri }} style={stili.anteprima} resizeMode="cover" />
          <Pressable onPress={() => impostaFotoOrario(null)}>
            <Text style={stili.linkRimuovi}>Rimuovi e scegli un'altra foto</Text>
          </Pressable>
        </View>
      ) : (
        <View style={stili.riquadroAzioni}>
          <Pressable style={stili.azione} onPress={scattaFoto}>
            <Ionicons name="camera-outline" size={26} color={colori.accento} />
            <Text style={stili.testoAzione}>Scatta una foto</Text>
          </Pressable>
          <Pressable style={stili.azione} onPress={scegliDallaGalleria}>
            <Ionicons name="images-outline" size={26} color={colori.accento} />
            <Text style={stili.testoAzione}>Scegli dalla galleria</Text>
          </Pressable>
        </View>
      )}
    </PassoOnboarding>
  );
}

const stili = StyleSheet.create({
  riquadroAzioni: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spazi.md,
    marginTop: spazi.sm,
  },
  azione: {
    flex: 1,
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.lg,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colori.bordo,
    backgroundColor: colori.superficie,
  },
  testoAzione: {
    color: colori.testo,
    fontSize: 14,
    fontWeight: '600',
  },
  anteprimaContenitore: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spazi.sm,
    marginTop: spazi.sm,
  },
  anteprima: {
    width: '100%',
    height: 200,
    borderRadius: raggi.md,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  linkRimuovi: {
    color: colori.testoSecondario,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: spazi.xs,
  },
});
