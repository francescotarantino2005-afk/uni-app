import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '@/store/useAppStore';
import { colori } from '@/lib/theme';

export default function LayoutRadice() {
  const pronto = useAppStore((s) => s.pronto);
  const caricaStato = useAppStore((s) => s.caricaStato);

  useEffect(() => {
    caricaStato();
  }, [caricaStato]);

  // Finché non sappiamo se l'onboarding è già stato fatto, niente flash di schermate sbagliate.
  if (!pronto) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colori.sfondo }}>
        <ActivityIndicator color={colori.accento} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colori.sfondo },
        }}
      />
    </>
  );
}
