import { Ionicons } from '@expo/vector-icons';

// Categorie delle scadenze (stesse chiavi dello schema DB).

export type ChiaveCategoria = 'tasse' | 'isee' | 'borsa' | 'affitto' | 'esame' | 'altro';

export const CATEGORIE: {
  chiave: ChiaveCategoria;
  etichetta: string;
  icona: keyof typeof Ionicons.glyphMap;
}[] = [
  { chiave: 'tasse', etichetta: 'Tasse', icona: 'card-outline' },
  { chiave: 'isee', etichetta: 'ISEE', icona: 'document-text-outline' },
  { chiave: 'borsa', etichetta: 'Borsa di studio', icona: 'school-outline' },
  { chiave: 'affitto', etichetta: 'Affitto', icona: 'home-outline' },
  { chiave: 'esame', etichetta: 'Esame', icona: 'create-outline' },
  { chiave: 'altro', etichetta: 'Altro', icona: 'ellipse-outline' },
];

export function iconaCategoria(chiave: string | null): keyof typeof Ionicons.glyphMap {
  return CATEGORIE.find((c) => c.chiave === chiave)?.icona ?? 'ellipse-outline';
}
