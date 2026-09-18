import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FotoOrario } from '@/store/useAppStore';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  foto: FotoOrario | null;
  onFoto: (foto: FotoOrario | null) => void;
};

/** Scelta/anteprima della foto dell'orario (fotocamera o galleria), con base64 per l'estrazione AI. */
export function SelettoreFotoOrario({ foto, onFoto }: Props) {
  const [errore, setErrore] = useState<string | null>(null);

  const opzioni: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: 0.6,
    base64: true,
  };

  const gestisciRisultato = (risultato: ImagePicker.ImagePickerResult) => {
    const asset = !risultato.canceled ? risultato.assets[0] : null;
    if (!asset) return;
    if (!asset.base64) {
      setErrore('Non sono riuscito a leggere la foto: riprova.');
      return;
    }
    setErrore(null);
    onFoto({
      uri: asset.uri,
      base64: asset.base64,
      tipo: asset.mimeType ?? 'image/jpeg',
    });
  };

  const scegliDallaGalleria = async () => {
    setErrore(null);
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permesso.granted) {
      setErrore('Senza accesso alle foto non possiamo leggere il tuo orario: concedilo dalle impostazioni.');
      return;
    }
    gestisciRisultato(await ImagePicker.launchImageLibraryAsync(opzioni));
  };

  const scattaFoto = async () => {
    setErrore(null);
    const permesso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permesso.granted) {
      setErrore("Senza fotocamera non possiamo fotografare l'orario: concedila dalle impostazioni.");
      return;
    }
    gestisciRisultato(await ImagePicker.launchCameraAsync(opzioni));
  };

  return (
    <View style={stili.contenitore}>
      {foto ? (
        <View style={stili.anteprimaContenitore}>
          <Image source={{ uri: foto.uri }} style={stili.anteprima} resizeMode="cover" />
          <Pressable onPress={() => onFoto(null)}>
            <Text style={stili.linkRimuovi}>Rimuovi e scegli un'altra foto</Text>
          </Pressable>
        </View>
      ) : (
        <View style={stili.riquadroAzioni}>
          <Pressable style={stili.azione} onPress={scattaFoto}>
            <Ionicons name="camera-outline" size={26} color={colori.testoSecondario} />
            <Text style={stili.testoAzione}>Scatta una foto</Text>
          </Pressable>
          <Pressable style={stili.azione} onPress={scegliDallaGalleria}>
            <Ionicons name="images-outline" size={26} color={colori.testoSecondario} />
            <Text style={stili.testoAzione}>Scegli dalla galleria</Text>
          </Pressable>
        </View>
      )}
      <MessaggioErrore messaggio={errore} />
    </View>
  );
}

const stili = StyleSheet.create({
  contenitore: {
    alignSelf: 'stretch',
    gap: spazi.md,
  },
  riquadroAzioni: {
    flexDirection: 'row',
    gap: spazi.md,
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
    alignItems: 'center',
    gap: spazi.sm,
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
