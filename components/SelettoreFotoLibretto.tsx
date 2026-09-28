import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FotoOrario } from '@/store/useAppStore';
import { MAX_FOTO_LIBRETTO } from '@/lib/estrazioneLibretto';
import { MessaggioErrore } from '@/components/MessaggioErrore';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  foto: FotoOrario[];
  onFoto: (foto: FotoOrario[]) => void;
};

/**
 * Più foto del libretto in fila (fotocamera o galleria): miniature, si toglie
 * quella sbagliata, si aggiunge la pagina mancante. La lettura avviene dopo,
 * in una sola chiamata per tutte.
 */
export function SelettoreFotoLibretto({ foto, onFoto }: Props) {
  const [errore, setErrore] = useState<string | null>(null);
  const posti = MAX_FOTO_LIBRETTO - foto.length;

  const aggiungi = (risultato: ImagePicker.ImagePickerResult) => {
    if (risultato.canceled) return;
    const nuove: FotoOrario[] = [];
    for (const asset of risultato.assets) {
      if (!asset.base64) continue;
      nuove.push({ uri: asset.uri, base64: asset.base64, tipo: asset.mimeType ?? 'image/jpeg' });
    }
    if (nuove.length === 0) {
      setErrore('Non sono riuscito a leggere la foto: riprova.');
      return;
    }
    const tenute = nuove.slice(0, posti);
    setErrore(
      tenute.length < nuove.length
        ? `Ne ho tenute ${tenute.length}: al massimo ${MAX_FOTO_LIBRETTO} foto per volta.`
        : null
    );
    onFoto([...foto, ...tenute]);
  };

  const scegliDallaGalleria = async () => {
    setErrore(null);
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permesso.granted) {
      setErrore('Senza accesso alle foto non posso leggere il libretto: concedilo dalle impostazioni.');
      return;
    }
    aggiungi(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.5,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: posti,
      })
    );
  };

  const scattaFoto = async () => {
    setErrore(null);
    const permesso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permesso.granted) {
      setErrore('Senza fotocamera non posso fotografare il libretto: concedila dalle impostazioni.');
      return;
    }
    aggiungi(await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.5, base64: true }));
  };

  const togli = (indice: number) => {
    setErrore(null);
    onFoto(foto.filter((_, i) => i !== indice));
  };

  return (
    <View style={stili.contenitore}>
      {foto.length > 0 ? (
        <View style={stili.griglia}>
          {foto.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={stili.miniatura}>
              <Image source={{ uri: f.uri }} style={stili.immagine} resizeMode="cover" />
              <Pressable style={stili.togli} onPress={() => togli(i)} hitSlop={8}>
                <Ionicons name="close" size={14} color={colori.sfondo} />
              </Pressable>
              <Text style={stili.numero}>{i + 1}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {posti > 0 ? (
        <View style={stili.riquadroAzioni}>
          <Pressable style={stili.azione} onPress={scattaFoto}>
            <Ionicons name="camera-outline" size={24} color={colori.testoSecondario} />
            <Text style={stili.testoAzione}>{foto.length ? 'Scatta un\'altra' : 'Scatta una foto'}</Text>
          </Pressable>
          <Pressable style={stili.azione} onPress={scegliDallaGalleria}>
            <Ionicons name="images-outline" size={24} color={colori.testoSecondario} />
            <Text style={stili.testoAzione}>Dalla galleria</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={stili.nota}>Hai raggiunto le {MAX_FOTO_LIBRETTO} foto: leggiamo queste.</Text>
      )}
      <MessaggioErrore messaggio={errore} />
    </View>
  );
}

const LATO = 72;

const stili = StyleSheet.create({
  contenitore: {
    alignSelf: 'stretch',
    gap: spazi.md,
  },
  griglia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spazi.sm,
    justifyContent: 'center',
  },
  miniatura: {
    width: LATO,
    height: LATO,
  },
  immagine: {
    width: LATO,
    height: LATO,
    borderRadius: raggi.sm,
    borderWidth: 1,
    borderColor: colori.bordo,
  },
  togli: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: raggi.pieno,
    backgroundColor: colori.testo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    color: colori.sfondo,
    fontSize: 12,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  riquadroAzioni: {
    flexDirection: 'row',
    gap: spazi.md,
  },
  azione: {
    flex: 1,
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.md,
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
  nota: {
    color: colori.testoSecondario,
    fontSize: 13,
    textAlign: 'center',
  },
});
