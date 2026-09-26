import { normalizza } from '@/lib/atenei';

// Corsi di laurea comuni: SOLO suggerimenti mentre si scrive. Il campo resta
// libero — si può salvare qualunque testo, anche non in elenco.
export const CORSI = [
  'Ingegneria Informatica',
  'Ingegneria Gestionale',
  'Ingegneria Meccanica',
  'Ingegneria Civile',
  'Ingegneria Elettronica',
  'Ingegneria Biomedica',
  'Ingegneria Aerospaziale',
  'Ingegneria Industriale',
  'Ingegneria Energetica',
  'Medicina e Chirurgia',
  'Odontoiatria',
  'Scienze Infermieristiche',
  'Fisioterapia',
  'Farmacia',
  'Chimica e Tecnologia Farmaceutiche',
  'Giurisprudenza',
  'Economia',
  'Economia Aziendale',
  'Economia e Management',
  'Scienze Politiche',
  'Relazioni Internazionali',
  'Psicologia',
  'Scienze della Formazione',
  'Scienze dell\'Educazione',
  'Lettere',
  'Filosofia',
  'Storia',
  'Lingue e Letterature Straniere',
  'Mediazione Linguistica',
  'Scienze della Comunicazione',
  'Architettura',
  'Design',
  'Disegno Industriale',
  'Biologia',
  'Biotecnologie',
  'Chimica',
  'Fisica',
  'Matematica',
  'Informatica',
  'Scienze Statistiche',
  'Scienze Geologiche',
  'Scienze Naturali',
  'Scienze Motorie',
  'Agraria',
  'Medicina Veterinaria',
  'Sociologia',
  'Servizio Sociale',
  'Beni Culturali',
  'Marketing',
  'Data Science',
  'Intelligenza Artificiale',
];

/** Suggerimenti per il corso di laurea, insensibili a maiuscole e accenti. */
export function suggerisciCorsi(query: string, max = 6): string[] {
  const q = normalizza(query);
  if (q.length < 2) return [];
  return CORSI.filter((c) => normalizza(c).includes(q)).slice(0, max);
}
