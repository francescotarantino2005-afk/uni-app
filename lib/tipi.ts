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

export type StatoInvio = 'inviando' | 'errore';

export type MessaggioChat = {
  id: string;
  ruolo: 'user' | 'assistant';
  contenuto: string;
  // Campi SOLO client: non arrivano dal DB, non vengono mai inviati al server
  // né salvati nello storico. L'errore di rete sta qui, mai dentro `contenuto`.
  statoInvio?: StatoInvio;
  erroreRete?: string;
};

export type CategoriaNota =
  | 'percorso'
  | 'obiettivi'
  | 'metodo_studio'
  | 'ostacoli'
  | 'preferenze'
  | 'contesto';

export type NotaStudente = {
  id: string;
  categoria: CategoriaNota;
  contenuto: string;
  importanza: number; // 1..3
  archiviata: boolean;
  updated_at: string;
};

export type TipoEsame = 'scritto' | 'orale' | 'entrambi' | 'progetto' | 'altro';

export type Esame = {
  id: string;
  user_id: string;
  materia: string;
  cfu: number | null;
  data_esame: string | null;
  voto: number | null; // null = da sostenere (o idoneità, vedi sotto)
  lode: boolean;
  /** superato senza voto: dà CFU ma non entra nella media (voto null). */
  idoneita: boolean;
  professore: string | null;
  tipo_esame: TipoEsame | null;
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

/**
 * Passo raggiunto nell'accoglienza. Il valore è il primo passo NON ancora
 * fatto (dove riprendere). `null` = profilo creato prima della tappa 1
 * (legacy) → trattato come accoglienza completata.
 */
export type AccoglienzaStato =
  | 'corso'
  | 'anno'
  | 'nome_bot'
  | 'libretto'
  // passi rimossi dalla catena: possono esistere su account vecchi, valgono "dialogo:1"
  | 'orario'
  | 'notifiche'
  | `dialogo:${1 | 2 | 3 | 4 | 5}`
  | 'completata';

/** Risposta grezza dello studente a una domanda del dialogo: resta sempre, anche se l'estrazione sbaglia. */
export type NotaLibera = { domanda: string; risposta: string; il: string };

/** Ciò che il dialogo di accoglienza raccoglie (profiles.profilo_studio). */
export type ProfiloStudio = {
  esame_target: { nome: string | null; id: string | null };
  quando: { testo: string | null; data: string | null };
  avanzamento: 'non_iniziato' | 'a_meta' | 'ripasso' | null;
  tempo_al_giorno: { testo: string | null; minuti: number | null };
  ostacolo: string | null;
  note_libere: NotaLibera[];
};

export type ChiaveProfiloStudio = Exclude<keyof ProfiloStudio, 'note_libere'>;

/** Domanda che il bot riproporrà più avanti (profiles.domande_in_coda). */
export type DomandaInCoda = {
  id: string;
  testo: string;
  chiave: string;
  stato: 'da_fare' | 'fatta' | 'saltata';
  priorita: number;
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
  /** nome scelto per il bot (default "Lode"). */
  nome_bot: string;
  /** bivio dell'accoglienza: true = primo anno, false = anni successivi. */
  matricola: boolean | null;
  /** raccolto dal dialogo di accoglienza; {} finché il dialogo non parte. */
  profilo_studio: Partial<ProfiloStudio>;
  /** domande saltate o senza risposta, che il bot riproporrà più avanti. */
  domande_in_coda: DomandaInCoda[];
  accoglienza_stato: AccoglienzaStato | null;
};
