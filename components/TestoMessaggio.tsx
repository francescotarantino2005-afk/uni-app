import { Platform, StyleSheet, Text, View } from 'react-native';
import { blocchi, type Pezzo, type Riga } from '@/lib/markdown';
import { coloriChat, fontChat } from '@/lib/theme';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function stilePezzo(p: Pezzo) {
  if (p.codice) return stili.codiceInline;
  if (p.formula) return [stili.formula, p.grassetto && stili.formulaGrassetto];
  if (p.grassetto) return stili.grassetto;
  if (p.corsivo) return stili.corsivo;
  return null;
}

function RigaTesto({ riga }: { riga: Riga }) {
  return (
    <>
      {riga.map((p, i) => (
        <Text key={i} style={stilePezzo(p)}>
          {p.testo}
        </Text>
      ))}
    </>
  );
}

/**
 * Il testo di un messaggio di Lode in Markdown leggero (lib/markdown.ts):
 * EB Garamond 19, formule in Source Serif 4 al 92%, grassetto per i punti
 * chiave. I messaggi in testo semplice si leggono come prima.
 */
export function TestoMessaggio({ testo, colore = coloriChat.testo }: { testo: string; colore?: string }) {
  const b = blocchi(testo);
  return (
    <View style={stili.contenitore}>
      {b.map((x, i) => {
        if (x.tipo === 'titolo') {
          return (
            <Text key={i} style={[stili.base, stili.titolo, { color: colore }]} accessibilityRole="header">
              <RigaTesto riga={x.riga} />
            </Text>
          );
        }
        if (x.tipo === 'paragrafo') {
          return (
            <Text key={i} style={[stili.base, { color: colore }]} selectable>
              {x.righe.map((r, j) => (
                <Text key={j}>
                  {j > 0 ? '\n' : ''}
                  <RigaTesto riga={r} />
                </Text>
              ))}
            </Text>
          );
        }
        if (x.tipo === 'elenco') {
          return (
            <View key={i} style={stili.elenco}>
              {x.voci.map((v, j) => (
                <View key={j} style={stili.voce}>
                  <Text style={[stili.base, stili.segno, { color: colore }]}>{v.segno}</Text>
                  <Text style={[stili.base, stili.testoVoce, { color: colore }]} selectable>
                    <RigaTesto riga={v.riga} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        if (x.tipo === 'codice') {
          return (
            <View key={i} style={stili.bloccoCodice}>
              <Text style={stili.testoCodice} selectable>
                {x.testo}
              </Text>
            </View>
          );
        }
        return <View key={i} style={stili.separatore} />;
      })}
    </View>
  );
}

const stili = StyleSheet.create({
  contenitore: {
    gap: 8,
  },
  base: {
    fontFamily: fontChat.testo,
    fontSize: fontChat.dimensione,
    lineHeight: fontChat.interlinea,
    color: coloriChat.testo,
  },
  titolo: {
    fontFamily: fontChat.grassetto,
    fontSize: 21,
    lineHeight: 27,
    marginTop: 4,
  },
  grassetto: {
    fontFamily: fontChat.grassetto,
  },
  corsivo: {
    fontFamily: fontChat.corsivo,
  },
  formula: {
    fontFamily: fontChat.formula,
    fontSize: fontChat.dimensioneFormula,
  },
  formulaGrassetto: {
    fontWeight: '600',
  },
  codiceInline: {
    fontFamily: MONO,
    fontSize: 15,
    backgroundColor: coloriChat.codice,
  },
  elenco: {
    gap: 4,
  },
  voce: {
    flexDirection: 'row',
    gap: 8,
  },
  segno: {
    minWidth: 18,
    color: coloriChat.viola,
  },
  testoVoce: {
    flex: 1,
  },
  bloccoCodice: {
    backgroundColor: coloriChat.codice,
    borderRadius: 10,
    padding: 10,
  },
  testoCodice: {
    fontFamily: MONO,
    fontSize: 14,
    lineHeight: 20,
    color: coloriChat.testo,
  },
  separatore: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: coloriChat.bordo,
    marginVertical: 4,
  },
});
