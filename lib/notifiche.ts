import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const ID_BRIEFING_LOCALE = 'briefing-quotidiano';

// Le notifiche in primo piano vengono comunque mostrate (banner + suono).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Chiede il permesso per le notifiche. Ritorna true se concesso. */
export async function richiediPermessoNotifiche(): Promise<boolean> {
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Briefing e avvisi',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const attuale = await Notifications.getPermissionsAsync();
  if (attuale.granted) return true;
  const richiesto = await Notifications.requestPermissionsAsync();
  return richiesto.granted;
}

/**
 * Recupera il token push Expo e lo salva in push_tokens.
 * Best effort: senza projectId EAS o su account Apple senza push, non blocca nulla.
 */
export async function salvaTokenPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await supabase.from('push_tokens').upsert({ user_id: userId, token });
  } catch {
    // Nessun token disponibile (es. iOS senza APNs/account a pagamento): va bene.
  }
}

/**
 * Programma una notifica LOCALE ricorrente all'ora scelta.
 * Funziona senza push remoto (nessun account Apple a pagamento necessario):
 * apre l'app sul briefing, che viene poi mostrato dai dati già scaricati.
 */
export async function programmaBriefingLocale(oraHHMM: string): Promise<boolean> {
  const permesso = await richiediPermessoNotifiche();
  if (!permesso) return false;

  const [ore, minuti] = oraHHMM.split(':').map(Number);
  await annullaBriefingLocale();
  await Notifications.scheduleNotificationAsync({
    identifier: ID_BRIEFING_LOCALE,
    content: {
      title: 'Il tuo briefing ☀️',
      body: 'Apri per vedere la tua giornata: lezioni, scadenze e cosa studiare.',
      data: { tipo: 'briefing' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: ore,
      minute: minuti,
    },
  });
  return true;
}

export async function annullaBriefingLocale(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_BRIEFING_LOCALE);
  } catch {
    // niente da annullare
  }
}
