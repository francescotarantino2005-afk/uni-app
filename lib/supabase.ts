import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Le variabili EXPO_PUBLIC_* vengono lette da .env (mai committato — vedi .env.example).
// Qui vive SOLO la publishable key: la chiave Anthropic e la service role
// stanno esclusivamente nelle env delle Edge Functions.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase non configurato: copia .env.example in .env e inserisci URL e publishable key.'
  );
}

// Sessione salvata cifrata sul dispositivo con SecureStore.
// Sul web (usato solo in sviluppo) si lascia lo storage di default del browser:
// un adapter che fallisce in silenzio farebbe perdere la sessione alle richieste.
const archivioSicuro = {
  getItem: (chiave: string) => SecureStore.getItemAsync(chiave),
  setItem: (chiave: string, valore: string) => SecureStore.setItemAsync(chiave, valore),
  removeItem: (chiave: string) => SecureStore.deleteItemAsync(chiave),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: archivioSicuro } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Il refresh del token va fermato in background e ripreso in foreground
// (raccomandazione ufficiale Supabase per React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (stato) => {
    if (stato === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
