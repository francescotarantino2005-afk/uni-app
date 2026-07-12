import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Scadenza } from '@/lib/tipi';
import { dataBreveItaliana, giorniMancanti } from '@/lib/date';
import { iconaCategoria } from '@/lib/categorie';
import { colori, raggi, spazi } from '@/lib/theme';

type Props = {
  scadenza: Scadenza;
  /** se presente, il tap sulla spunta commuta lo stato completata */
  onToggle?: () => void;
};

function etichettaTempo(scadenza: Scadenza): { testo: string; urgente: boolean } {
  if (scadenza.completata) return { testo: dataBreveItaliana(scadenza.data), urgente: false };
  const giorni = giorniMancanti(scadenza.data);
  if (giorni < 0) return { testo: `scaduta · ${dataBreveItaliana(scadenza.data)}`, urgente: true };
  if (giorni === 0) return { testo: 'oggi!', urgente: true };
  if (giorni === 1) return { testo: 'domani', urgente: true };
  if (giorni <= 7) return { testo: `tra ${giorni} giorni`, urgente: true };
  return { testo: dataBreveItaliana(scadenza.data), urgente: false };
}

export function RigaScadenza({ scadenza, onToggle }: Props) {
  const tempo = etichettaTempo(scadenza);

  return (
    <View style={[stili.riga, scadenza.completata && stili.rigaCompletata]}>
      {onToggle ? (
        <Pressable onPress={onToggle} hitSlop={10} style={stili.spunta}>
          <Ionicons
            name={scadenza.completata ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={scadenza.completata ? colori.successo : colori.testoSecondario}
          />
        </Pressable>
      ) : (
        <View style={stili.spunta}>
          <Ionicons name={iconaCategoria(scadenza.categoria)} size={22} color={colori.accento} />
        </View>
      )}
      <View style={stili.corpo}>
        <Text
          style={[stili.titolo, scadenza.completata && stili.titoloCompletato]}
          numberOfLines={1}
        >
          {scadenza.titolo}
        </Text>
        <Text style={[stili.data, tempo.urgente && stili.dataUrgente]}>{tempo.testo}</Text>
      </View>
    </View>
  );
}

const stili = StyleSheet.create({
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    paddingVertical: spazi.sm,
    paddingHorizontal: spazi.md,
    gap: spazi.md,
  },
  rigaCompletata: {
    opacity: 0.55,
  },
  spunta: {
    width: 28,
    alignItems: 'center',
  },
  corpo: {
    flex: 1,
    gap: 2,
  },
  titolo: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '600',
  },
  titoloCompletato: {
    textDecorationLine: 'line-through',
    color: colori.testoSecondario,
  },
  data: {
    color: colori.testoSecondario,
    fontSize: 13,
  },
  dataUrgente: {
    color: colori.errore,
    fontWeight: '600',
  },
});
