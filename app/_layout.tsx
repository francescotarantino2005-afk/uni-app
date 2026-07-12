import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '@/store/useAppStore';
import { colori } from '@/lib/theme';

export default function LayoutRadice() {
  const pronto = useAppStore((s) => s.pronto);
  const avvia = useAppStore((s) => s.avvia);

  useEffect(() => {
    avvia();
  }, [avvia]);

  // Finché non abbiamo ripristinato sessione e profilo, niente flash di schermate sbagliate.
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
      >
        <Stack.Screen name="lezione" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
