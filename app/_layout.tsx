import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '@/store/useAppStore';
import { colori } from '@/lib/theme';

export default function LayoutRadice() {
  const pronto = useAppStore((s) => s.pronto);
  const avvia = useAppStore((s) => s.avvia);
  const giaGestito = useRef(false);

  useEffect(() => {
    avvia();
  }, [avvia]);

  // La push del briefing (locale o remota) porta alla Home.
  useEffect(() => {
    const vaiAllaHome = (risposta: Notifications.NotificationResponse | null) => {
      const dati = risposta?.notification.request.content.data;
      if (dati?.tipo === 'briefing') {
        router.replace('/oggi');
      }
    };

    // App aperta toccando la notifica da stato chiuso.
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r && !giaGestito.current) {
        giaGestito.current = true;
        vaiAllaHome(r);
      }
    });

    // App già aperta / in background.
    const sub = Notifications.addNotificationResponseReceivedListener(vaiAllaHome);
    return () => sub.remove();
  }, []);

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
        <Stack.Screen name="importa-orario" options={{ presentation: 'modal' }} />
        <Stack.Screen name="anteprima-orario" options={{ presentation: 'modal' }} />
        <Stack.Screen name="preferenze" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
