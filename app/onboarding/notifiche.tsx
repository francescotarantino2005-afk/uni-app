import { router } from 'expo-router';
import { PassoOnboarding } from '@/components/PassoOnboarding';
import { useAppStore } from '@/store/useAppStore';

export default function PassoNotifiche() {
  const completaOnboarding = useAppStore((s) => s.completaOnboarding);

  const concludi = async () => {
    // La richiesta vera del permesso (expo-notifications) arriva con il briefing, Sprint 3.
    await completaOnboarding();
    router.replace('/oggi');
  };

  return (
    <PassoOnboarding
      passo={3}
      icona="notifications-outline"
      titolo="Il briefing del mattino"
      descrizione="Ogni mattina, all'ora che scegli tu: le lezioni di oggi, le scadenze in arrivo e cosa studiare. Ti chiederemo il permesso per le notifiche."
      etichettaBottone="Inizia"
      onAvanti={concludi}
    />
  );
}
