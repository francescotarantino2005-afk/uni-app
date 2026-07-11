// Tipi TypeScript condivisi (rispecchiano lo schema in /supabase/migrations)

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
