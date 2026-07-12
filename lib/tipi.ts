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
