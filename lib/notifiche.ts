import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/** Chiede il permesso per le notifiche push. Ritorna true se concesso. */
export async function richiediPermessoNotifiche(): Promise<boolean> {
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifiche',
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
 * Best effort: in Expo Go (SDK 53+) il push remoto non è disponibile,
 * quindi il token arriverà con la development build (Sprint 3) — qui
 * non deve mai bloccare l'onboarding.
 */
export async function salvaTokenPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!token) return;

    await supabase.from('push_tokens').upsert({ user_id: userId, token });
  } catch {
    // Niente token in Expo Go o senza projectId EAS: va bene così, per ora.
  }
}
