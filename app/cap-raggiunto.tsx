import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { registraEvento } from '@/lib/chatDb';
import { BottonePrimario } from '@/components/BottonePrimario';
import { colori, raggi, spazi } from '@/lib/theme';

// Schermata "cap raggiunto" = UPSELL (CLAUDE.md): messaggio Plus in arrivo,
// bottone "Avvisami" (evento tracciato), referral.
export default function SchermataCapRaggiunto() {
  const [avvisami, setAvvisami] = useState(false);
  const [referral, setReferral] = useState(false);

  const chiediAvviso = async () => {
    setAvvisami(true);
    await registraEvento('plus_avvisami');
  };

  const invitaCompagno = async () => {
    setReferral(true);
    await registraEvento('referral_interesse');
  };

  return (
    <SafeAreaView style={stili.schermo}>
      <View style={stili.intestazione}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colori.testoSecondario} />
        </Pressable>
      </View>

      <View style={stili.contenuto}>
        <View style={stili.cerchioIcona}>
          <Ionicons name="rocket-outline" size={40} color={colori.accento} />
        </View>
        <Text style={stili.titolo}>Hai finito i messaggi di oggi</Text>
        <Text style={stili.sottotitolo}>
          La chat gratuita ha un limite giornaliero. Domani riparti da capo — oppure passa a{' '}
          <Text style={stili.plus}>Plus</Text> per chattare senza limiti.
        </Text>

        <View style={stili.cardPlus}>
          <View style={stili.badgePlus}>
            <Ionicons name="sparkles" size={14} color={colori.accento} />
            <Text style={stili.testoBadge}>Plus in arrivo</Text>
          </View>
          <Text style={stili.testoPlus}>
            Chat illimitata, kit di studio dai PDF, piani multi-esame e statistiche. Sta arrivando:
            vuoi che ti avvisi appena esce?
          </Text>

          {avvisami ? (
            <View style={stili.fatto}>
              <Ionicons name="checkmark-circle" size={20} color={colori.successo} />
              <Text style={stili.testoFatto}>Perfetto, ti avviserò appena è pronto!</Text>
            </View>
          ) : (
            <BottonePrimario etichetta="Avvisami quando esce" onPress={chiediAvviso} />
          )}
        </View>

        <Pressable
          style={[stili.cardReferral, referral && stili.cardReferralFatto]}
          onPress={() => !referral && invitaCompagno()}
          disabled={referral}
        >
          <Ionicons
            name={referral ? 'checkmark-circle' : 'people-outline'}
            size={22}
            color={referral ? colori.successo : colori.accento}
          />
          <View style={{ flex: 1 }}>
            <Text style={stili.titoloReferral}>
              {referral ? 'Grazie! Ti faremo sapere' : 'Invita un compagno di corso'}
            </Text>
            <Text style={stili.sottoReferral}>
              {referral
                ? 'Il programma inviti sta arrivando: sarai tra i primi.'
                : '+5 messaggi al giorno per sempre, per ogni amico che entra'}
            </Text>
          </View>
        </Pressable>
      </View>

      <Pressable onPress={() => router.back()} style={stili.tornaIndietro}>
        <Text style={stili.testoTorna}>Torna alla chat</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: colori.sfondo,
  },
  intestazione: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spazi.lg,
    paddingVertical: spazi.md,
  },
  contenuto: {
    flex: 1,
    paddingHorizontal: spazi.lg,
    alignItems: 'center',
    gap: spazi.md,
  },
  cerchioIcona: {
    width: 88,
    height: 88,
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
  plus: {
    color: colori.accento,
    fontWeight: '800',
  },
  cardPlus: {
    alignSelf: 'stretch',
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.lg,
    padding: spazi.lg,
    gap: spazi.md,
    marginTop: spazi.sm,
  },
  badgePlus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.xs,
    alignSelf: 'flex-start',
    backgroundColor: colori.accentoTenue,
    borderRadius: raggi.pieno,
    paddingVertical: spazi.xs,
    paddingHorizontal: spazi.sm,
  },
  testoBadge: {
    color: colori.accento,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testoPlus: {
    color: colori.testo,
    fontSize: 14,
    lineHeight: 21,
  },
  fatto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.sm,
    paddingVertical: spazi.sm,
  },
  testoFatto: {
    color: colori.successo,
    fontSize: 14,
    fontWeight: '600',
  },
  cardReferral: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazi.md,
    backgroundColor: colori.superficie,
    borderColor: colori.bordo,
    borderWidth: 1,
    borderRadius: raggi.md,
    padding: spazi.md,
  },
  cardReferralFatto: {
    borderColor: colori.successo,
  },
  titoloReferral: {
    color: colori.testo,
    fontSize: 15,
    fontWeight: '700',
  },
  sottoReferral: {
    color: colori.testoSecondario,
    fontSize: 13,
    lineHeight: 18,
  },
  tornaIndietro: {
    alignItems: 'center',
    paddingVertical: spazi.lg,
  },
  testoTorna: {
    color: colori.testoSecondario,
    fontSize: 14,
    fontWeight: '600',
  },
});
