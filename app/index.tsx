import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';

/** Punto d'ingresso: al primo avvio si va all'onboarding, poi sempre alle tab. */
export default function Ingresso() {
  const onboardingCompletato = useAppStore((s) => s.onboardingCompletato);
  return <Redirect href={onboardingCompletato ? '/oggi' : '/onboarding/ateneo'} />;
}
