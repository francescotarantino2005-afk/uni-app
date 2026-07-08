import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { colori } from '@/lib/theme';

type NomeIcona = keyof typeof Ionicons.glyphMap;

function icona(nome: NomeIcona) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={nome} size={size} color={color} />
  );
}

export default function LayoutTab() {
  return (
    <Tabs
      initialRouteName="oggi"
      screenOptions={{
        headerStyle: { backgroundColor: colori.sfondo },
        headerTitleStyle: { color: colori.testo, fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colori.superficie,
          borderTopColor: colori.bordo,
        },
        tabBarActiveTintColor: colori.accento,
        tabBarInactiveTintColor: colori.testoSecondario,
      }}
    >
      <Tabs.Screen name="oggi" options={{ title: 'Oggi', tabBarIcon: icona('sunny-outline') }} />
      <Tabs.Screen name="orario" options={{ title: 'Orario', tabBarIcon: icona('calendar-outline') }} />
      <Tabs.Screen name="scadenze" options={{ title: 'Scadenze', tabBarIcon: icona('alarm-outline') }} />
      <Tabs.Screen name="libretto" options={{ title: 'Libretto', tabBarIcon: icona('school-outline') }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icona('chatbubble-ellipses-outline') }} />
    </Tabs>
  );
}
