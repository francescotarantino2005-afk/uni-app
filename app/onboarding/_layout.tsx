import { Stack } from 'expo-router';
import { colori } from '@/lib/theme';

export default function LayoutOnboarding() {
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
