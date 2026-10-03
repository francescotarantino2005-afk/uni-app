// La memoria dello studente: note brevi che il tutor tiene su di lui e che la
// chat rilegge a ogni risposta (tabella note_studente, nessuna modifica di
// schema). Logica PURA: niente rete, niente Deno. La usano chat/motore.ts (che
// fa le chiamate e scrive nel database) e i test.
//
// Le sei categorie sono quelle della tabella (vincolo CHECK). Quello che il
// manuale chiede di ricordare si appoggia a loro con un prefisso nel testo:
//   errori ricorrenti   -> ostacoli      "Errore: ..."
//   argomenti deboli    -> ostacoli      "Debole: ..."
//   argomenti solidi    -> percorso      "Solido: ..."
//   metodo che funziona -> metodo_studio
//   contesto umano      -> contesto
//   esame, obiettivi    -> obiettivi / percorso; come vuole essere aiutato -> preferenze
// Le note attive sono al massimo MAX_NOTE_TENUTE: quando crescono, l'estrattore
// le fonde (aggiorna + archivia) e, se non basta, il codice archivia le meno
// importanti. Archiviare non cancella: la riga resta con archiviata = true.
import { MAX_NOTE_PROMPT } from './logica.ts';

export const CATEGORIE_NOTE = ['percorso', 'obiettivi', 'metodo_studio', 'ostacoli', 'preferenze', 'contesto'] as const;
export const MAX_LEN_NOTA = 300;
/** Note attive massime per studente (una ventina). */
export const MAX_NOTE_TENUTE = MAX_NOTE_PROMPT;
/** Da quante note attive in poi l'estrattore deve fare ordine invece di aggiungere. */
export const SOGLIA_RIASSUNTO = 15;
export const MODELLO_MEMORIA = 'claude-haiku-4-5';

// Quando far partire l'aggiornamento: messaggio lungo, OPPURE ogni 3 messaggi
// dello studente, OPPURE quando lo studente torna dopo una pausa (la
// conversazione precedente e' finita: se ne tira la somma).
export const SOGLIA_MESSAGGIO_LUNGO = 120;
export const OGNI_N_SCAMBI = 3;
export const PAUSA_FINE_CONVERSAZIONE_MS = 45 * 60 * 1000;

export function quandoAggiornare(p: {
  testo: string;
  messaggiStudente: number;
  /** Quando e' stato scritto l'ultimo messaggio PRIMA di questo (null se e' il primo). */
  ultimoPrimaIl: string | null;
  adessoMs: number;
}): { aggiorna: boolean; motivo: 'lungo' | 'ogni_n' | 'fine_conversazione' | null } {
  const prima = p.ultimoPrimaIl ? Date.parse(p.ultimoPrimaIl) : NaN;
  if (Number.isFinite(prima) && p.adessoMs - prima > PAUSA_FINE_CONVERSAZIONE_MS) {
    return { aggiorna: true, motivo: 'fine_conversazione' };
  }
  if (p.testo.length > SOGLIA_MESSAGGIO_LUNGO) return { aggiorna: true, motivo: 'lungo' };
  if (p.messaggiStudente > 0 && p.messaggiStudente % OGNI_N_SCAMBI === 0) return { aggiorna: true, motivo: 'ogni_n' };
  return { aggiorna: false, motivo: null };
}

// Difesa in profondità: contenuti che NON devono mai finire in memoria (oltre al
// divieto nel prompt dell'estrattore). In caso di dubbio si scarta la nota.
// Area sanitaria/di cura vietata anche se detta in modo neutro o indiretto
// (medici/psicologi/psichiatri, terapie, visite/appuntamenti, farmaci, ricoveri,
// il fatto stesso di rivolgersi a un professionista sanitario). I confini di
// parola evitano di colpire i corsi di laurea "Medicina/Psicologia/Farmacia".
export const NOTE_VIETATE =
  /diagnos|depress|bipolar|schizo|disturb|panico|suicid|autolesion|anoress|bulim|\bmedic[oi]\b|dottoress|\bdottor[ei]\b|\bpsicolog[oai]\b|psicologic|psichiatr|psicoterap|terapi[ae]|terapeut|\bfarmac[oi]\b|psicofarmac|antidepress|ansiolit|ricover|ospedal|ambulator|\bclinic|sanitar|consultorio|pronto soccorso|visita medic|visite medic|controllo medic|appuntamento (medic|sanitar)|professionista sanitar|religio|cattolic|musulman|\bebre|islam|orientamento sessuale|omosess|\betero|bisess|transgender|\betni|\brazz|partito|di destra|di sinistra/i;

export const SISTEMA_MEMORIA = `Sei l'estrattore di memoria di un tutor universitario. Dalla conversazione aggiorni gli appunti che il tutor tiene sullo studente, così la volta dopo lo conosce meglio, come un buon professore che si ricorda di chi ha davanti. Rispondi SOLO usando lo strumento "memoria".

Cosa vale la pena ricordare (e come si scrive: ogni nota è UN fatto solo, in italiano, al massimo 300 caratteri, concreto, con i nomi precisi degli argomenti):
- errori ricorrenti → categoria "ostacoli", nota che comincia con "Errore: " (es. "Errore: nei limiti dimentica le condizioni di esistenza"). Solo errori che si ripetono o che sono chiaramente sistematici, non una svista isolata;
- argomenti deboli → categoria "ostacoli", nota che comincia con "Debole: ";
- argomenti solidi → categoria "percorso", nota che comincia con "Solido: ";
- il metodo che ha funzionato (o non ha funzionato) con questo studente → categoria "metodo_studio" (es. "Con un esercizio svolto e poi un gemello da solo capisce in fretta");
- contesto umano che serve a studiare con lui → categoria "contesto": lavora, è pendolare o fuorisede, a che ora ha energie, si distrae col telefono, si agita prima degli orali, com'è andato un esame e come l'ha vissuto ("ha preso 18 a Fisica 1 e ci è rimasto male"). Descrivi sempre il comportamento nello studio, mai una condizione;
- obiettivi → "obiettivi" (un esame con la sua data, la media che vuole, laurearsi entro...); percorso e situazione accademica → "percorso"; come vuole essere aiutato → "preferenze".
Un esame, una data, un voto, il tipo di prova (scritto/orale) li scrivi solo se lo studente li ha detti: mai dedurli. Le date relative ("tra due settimane", "domani") le scrivi in forma assoluta partendo dalla data di oggi che ti viene data.

È VIETATO memorizzare, mai, in nessuna forma — nemmeno se detto in modo neutro o indiretto:
- diagnosi, condizioni di salute fisica o mentale, terapie o farmaci;
- medici, psicologi, psichiatri o altri professionisti sanitari, visite, appuntamenti, controlli, percorsi di cura, ricoveri, e persino il fatto che lo studente si sia rivolto — o voglia rivolgersi — a un professionista sanitario;
- origine etnica, religione, opinioni politiche, orientamento o vita sessuale;
- dati riferiti a terze persone.
Regola tassativa: se una nota non si può scrivere senza toccare l'area sanitaria o di cura, NON la scrivi. Nel dubbio, non scrivere la nota. Se lo studente racconta un disagio, scrivi la nota SOLO in termini funzionali sullo studio (motivazione, concentrazione, organizzazione, dubbi sul percorso), senza alcun riferimento a salute, cura o professionisti sanitari. Un momento di sconforto grave che va oltre lo studio non si scrive affatto.

Regole:
- Evita duplicati: se un fatto è già presente e invariato, non fare nulla su di esso.
- Se un fatto nuovo aggiorna o contraddice una nota esistente, usa "aggiorna" sul suo id (non aggiungere una nota incoerente). Se una nota non è più vera, usa "archivia" sul suo id.
- "aggiorna" e "archivia" devono riferirsi a un id presente nell'elenco fornito.
- Le note attive devono restare al massimo ${MAX_NOTE_TENUTE}, meglio una quindicina. Quando sono ${SOGLIA_RIASSUNTO} o più, prima di aggiungere fai ordine: fondi le note che dicono cose vicine (con "aggiorna" scrivi la nota riassunta sull'id di una e "archivia" le altre), archivia quelle superate o poco utili a un professore, tieni quelle che cambiano come si lavora con lui.
- Se non c'è niente di utile e stabile da salvare, restituisci una lista di operazioni vuota.`;

export const SCHEMA_MEMORIA = {
  type: 'object',
  properties: {
    operazioni: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['aggiungi', 'aggiorna', 'archivia'] },
          id: { type: 'string', description: 'id della nota esistente (per aggiorna/archivia)' },
          categoria: { type: 'string', enum: [...CATEGORIE_NOTE] },
          contenuto: { type: 'string', description: 'un fatto solo, max 300 caratteri' },
          importanza: { type: 'integer', enum: [1, 2, 3] },
        },
        required: ['tipo'],
        additionalProperties: false,
      },
    },
  },
  required: ['operazioni'],
  additionalProperties: false,
};

export type Op = { tipo: string; id?: string; categoria?: string; contenuto?: string; importanza?: number };
export type NotaMemoriaRiga = {
  id: string;
  categoria: string;
  contenuto: string;
  importanza?: number | null;
  updated_at?: string | null;
};

/** Nota valida per la memoria? (validazione lato codice, oltre al prompt). */
export function contenutoAmmesso(c: unknown): c is string {
  return typeof c === 'string' && c.trim().length > 0 && c.length <= MAX_LEN_NOTA && !NOTE_VIETATE.test(c);
}

/** Il corpo della chiamata a /v1/messages per aggiornare la memoria. */
export function richiestaMemoria(trascrizione: string, esistenti: NotaMemoriaRiga[], oggi?: string) {
  const elenco = esistenti.length
    ? esistenti.map((n) => `id=${n.id} [${n.categoria}] (importanza ${n.importanza ?? 2}) ${n.contenuto}`).join('\n')
    : '(nessuna nota esistente)';
  return {
    model: MODELLO_MEMORIA,
    max_tokens: 900,
    system: SISTEMA_MEMORIA,
    tools: [{ name: 'memoria', description: 'Registra le operazioni sulla memoria dello studente.', input_schema: SCHEMA_MEMORIA }],
    tool_choice: { type: 'tool', name: 'memoria' },
    messages: [
      {
        role: 'user',
        content: `${oggi ? `Oggi è ${oggi}. ` : ''}Note già in memoria (${esistenti.length} attive):\n${elenco}\n\nUltime battute della conversazione:\n${trascrizione}`,
      },
    ],
  };
}

/** Le operazioni dalla risposta di /v1/messages (lista vuota se manca lo strumento). */
export function leggiOperazioni(risposta: unknown): Op[] {
  const blocchi = (risposta as { content?: { type?: string; input?: unknown }[] } | null)?.content;
  const b = Array.isArray(blocchi) ? blocchi.find((x) => x?.type === 'tool_use') : undefined;
  const ops = (b?.input as { operazioni?: unknown } | undefined)?.operazioni;
  return Array.isArray(ops) ? (ops as Op[]) : [];
}

export type Azione =
  | { tipo: 'inserisci'; riga: { categoria: string; contenuto: string; importanza: number } }
  | { tipo: 'aggiorna'; id: string; patch: { categoria?: string; contenuto?: string; importanza?: number } }
  | { tipo: 'archivia'; id: string };

const importanzaValida = (i: unknown): i is 1 | 2 | 3 => i === 1 || i === 2 || i === 3;
const categoriaValida = (c: unknown): c is string => typeof c === 'string' && (CATEGORIE_NOTE as readonly string[]).includes(c);

/**
 * Dalle operazioni proposte dal modello alle azioni da eseguire: scarta tutto
 * quello che non passa i controlli e, se alla fine le note attive superano
 * MAX_NOTE_TENUTE, archivia le meno importanti (importanza più bassa, poi le
 * più vecchie) tra quelle che c'erano già.
 */
export function pianoMemoria(ops: Op[], esistenti: NotaMemoriaRiga[]): Azione[] {
  const stato = new Map(esistenti.map((n) => [n.id, { ...n, importanza: n.importanza ?? 2, attiva: true }]));
  const azioni: Azione[] = [];
  let nuove = 0;

  for (const op of ops) {
    if (op.tipo === 'aggiungi') {
      if (!categoriaValida(op.categoria) || !contenutoAmmesso(op.contenuto)) continue;
      azioni.push({
        tipo: 'inserisci',
        riga: { categoria: op.categoria, contenuto: op.contenuto.trim(), importanza: importanzaValida(op.importanza) ? op.importanza : 2 },
      });
      nuove++;
    } else if (op.tipo === 'aggiorna') {
      const n = op.id ? stato.get(op.id) : undefined;
      if (!n || !n.attiva) continue;
      const patch: { categoria?: string; contenuto?: string; importanza?: number } = {};
      if (op.categoria !== undefined) {
        if (!categoriaValida(op.categoria)) continue;
        patch.categoria = op.categoria;
      }
      if (op.contenuto !== undefined) {
        if (!contenutoAmmesso(op.contenuto)) continue;
        patch.contenuto = op.contenuto.trim();
      }
      if (importanzaValida(op.importanza)) {
        patch.importanza = op.importanza;
        n.importanza = op.importanza;
      }
      azioni.push({ tipo: 'aggiorna', id: n.id, patch });
    } else if (op.tipo === 'archivia') {
      const n = op.id ? stato.get(op.id) : undefined;
      if (!n || !n.attiva) continue;
      n.attiva = false;
      azioni.push({ tipo: 'archivia', id: n.id });
    }
  }

  // Rete di sicurezza: mai oltre il massimo di note attive.
  const attive = [...stato.values()].filter((n) => n.attiva);
  let troppe = attive.length + nuove - MAX_NOTE_TENUTE;
  if (troppe > 0) {
    const daArchiviare = attive.sort(
      (a, b) => a.importanza - b.importanza || Date.parse(a.updated_at ?? '') - Date.parse(b.updated_at ?? '') || 0
    );
    for (const n of daArchiviare) {
      if (troppe <= 0) break;
      azioni.push({ tipo: 'archivia', id: n.id });
      troppe--;
    }
  }
  return azioni;
}

/** Le note come sono dopo le azioni (per le prove e per i test: nessun database). */
export function applicaAzioni(esistenti: NotaMemoriaRiga[], azioni: Azione[]): NotaMemoriaRiga[] {
  const m = new Map(esistenti.map((n) => [n.id, { ...n }]));
  let k = 0;
  for (const a of azioni) {
    if (a.tipo === 'inserisci') m.set(`nuova-${++k}`, { id: `nuova-${k}`, ...a.riga });
    else if (a.tipo === 'aggiorna') {
      const n = m.get(a.id);
      if (n) m.set(a.id, { ...n, ...a.patch });
    } else m.delete(a.id);
  }
  return [...m.values()];
}
