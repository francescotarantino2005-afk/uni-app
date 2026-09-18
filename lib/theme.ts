// Tema dell'app — UNICA fonte di verità per i colori.
// Due palette complete (chiaro e scuro) con gli stessi token. I componenti
// importano `colori`: cambiare `TEMA_PREDEFINITO` (o, in futuro, la preferenza
// che lo seleziona) ricolora tutta l'app SENZA ritoccare le schermate.
//
// Regola sull'accento: il viola (`accento`) indica ciò che è toccabile
// (bottoni, link, elementi attivi, selezione). Non è decorazione: non va usato
// per titoli, bordi o icone decorative.

export type Palette = {
  /** sfondo dell'app; funge anche da colore del testo/icona SOPRA l'accento */
  sfondo: string;
  /** superficie delle card, sopra lo sfondo */
  superficie: string;
  /** bordi e separatori neutri */
  bordo: string;
  /** testo principale */
  testo: string;
  /** testo secondario / didascalie */
  testoSecondario: string;
  /** accento: SOLO per elementi toccabili */
  accento: string;
  /** velatura dell'accento, per lo sfondo di elementi attivi/selezionati */
  accentoTenue: string;
  /** stato positivo */
  successo: string;
  /** stato di errore */
  errore: string;
};

// Palette CHIARA (predefinita): bianco caldo + accenti viola.
export const paletteChiara: Palette = {
  sfondo: '#FBFAF8',
  superficie: '#FFFFFF',
  bordo: '#E9E6F0',
  testo: '#17151F',
  testoSecondario: '#6E6883',
  accento: '#6D4AFF',
  // Non specificati nella richiesta (che dava i 6 core): scelti per il chiaro.
  accentoTenue: 'rgba(109, 74, 255, 0.10)',
  successo: '#15803D',
  errore: '#DC2626',
};

// Palette SCURA: i colori che l'app usava già oggi, riorganizzati negli stessi token.
export const paletteScura: Palette = {
  sfondo: '#0D0F14',
  superficie: '#161922',
  bordo: '#252A36',
  testo: '#F2F4F8',
  testoSecondario: '#98A0B3',
  accento: '#8B7CFF',
  accentoTenue: 'rgba(139, 124, 255, 0.14)',
  successo: '#4ADE80',
  errore: '#F87171',
};

export type NomeTema = 'chiaro' | 'scuro';

export const palette: Record<NomeTema, Palette> = {
  chiaro: paletteChiara,
  scuro: paletteScura,
};

/**
 * Tema predefinito dell'app: CHIARO. Il tema resta commutabile: per tornare
 * allo scuro basta cambiare questa costante (o collegarla a una preferenza
 * salvata), senza toccare nessuna schermata.
 */
export const TEMA_PREDEFINITO: NomeTema = 'chiaro';

/** Token colore ATTIVI. Tutti i componenti importano questo oggetto. */
export const colori: Palette = palette[TEMA_PREDEFINITO];

export const spazi = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/**
 * Palette CATEGORICA per il colore scelto dall'utente sulle lezioni
 * (schedule_events.colore). Non è un token di tema: sono tinte distinte che
 * l'utente assegna alle materie, valide su entrambi gli sfondi.
 */
export const coloriLezione = ['#8B7CFF', '#4ADE80', '#F87171', '#FBBF24', '#38BDF8', '#F472B6'];

export const raggi = {
  sm: 8,
  md: 12,
  lg: 20,
  pieno: 999,
};
