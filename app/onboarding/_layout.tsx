import { Redirect, Stack } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { colori } from '@/lib/theme';

export default function LayoutOnboarding() {
  const utente = useAppStore((s) => s.utente);

  // L'onboarding ha senso solo per chi è loggato e non ha ancora un profilo.
  if (!utente) return <Redirect href="/auth" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colori.sfondo },
        animation: 'slide_from_right',
      }}
    />
  );
}
