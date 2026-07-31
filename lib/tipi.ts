// Tipi TypeScript condivisi (rispecchiano lo schema in /supabase/migrations)

export type EventoOrario = {
  id: string;
  user_id: string;
  titolo: string;
  /** 1 = lunedì … 7 = domenica */
  giorno: number;
  /** formato Postgres "HH:MM:SS" */
  ora_inizio: string;
  ora_fine: string | null;
  aula: string | null;
  colore: string | null;
};

export type StatoSessione = 'da_fare' | 'fatta' | 'meta' | 'saltata';

export type SessionePiano = {
  data: string; // AAAA-MM-GG
  ora_inizio: string; // HH:MM
  ora_fine: string; // HH:MM
  argomento: string;
  obiettivo: string;
  stato: StatoSessione;
};

export type Piano = {
  materia: string;
  data_esame: string;
  materiale: string;
  ore_al_giorno: number;
  creato_il: string;
  sessioni: SessionePiano[];
  ripassi: { data: string; argomenti_da_ripassare: string }[];
};

export type PianoStudio = {
  id: string;
  exam_id: string;
  piano: Piano;
};

export type MessaggioChat = {
  id: string;
  ruolo: 'user' | 'assistant';
  contenuto: string;
};

export type Esame = {
  id: string;
  user_id: string;
  materia: string;
  cfu: number | null;
  data_esame: string | null;
  voto: number | null; // null = da sostenere
  lode: boolean;
};

export type Briefing = {
  id: string;
  user_id: string;
  data: string;
  contenuto: string | null;
  suggerimento: string | null;
  inviato: boolean;
};

export type Scadenza = {
  id: string;
  user_id: string;
  titolo: string;
  /** formato ISO "AAAA-MM-GG" */
  data: string;
  categoria: string | null;
  spiegazione: string | null;
  completata: boolean;
  fonte: string;
};

export type Profilo = {
  id: string;
  nome: string | null;
  ateneo: string | null;
  corso: string | null;
  anno: number | null;
  fuorisede: boolean;
  regione: string | null;
  ora_briefing: string;
  premium: boolean;
  created_at: string;
};
