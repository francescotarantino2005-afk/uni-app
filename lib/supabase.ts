import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Le variabili EXPO_PUBLIC_* vengono lette da .env (mai committato — vedi .env.example).
// Qui vive SOLO la anon key pubblica: la chiave Anthropic e la service role
// stanno esclusivamente nelle env delle Edge Functions.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase non configurato: copia .env.example in .env e inserisci URL e anon key del progetto.'
  );
}

// La sessione utente viene salvata in modo cifrato sul dispositivo.
const archivioSicuro = {
  getItem: (chiave: string) => SecureStore.getItemAsync(chiave),
  setItem: (chiave: string, valore: string) => SecureStore.setItemAsync(chiave, valore),
  removeItem: (chiave: string) => SecureStore.deleteItemAsync(chiave),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: archivioSicuro,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
