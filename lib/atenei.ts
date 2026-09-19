// Elenco dei 102 atenei italiani riconosciuti dal MUR (statali, non
// statali, telematiche, istituti a ordinamento speciale).
// Fonte: Ministero dell'Università e della Ricerca (mur.gov.it), sezione Le Università, aggiornato 2026-09-18. Generato dal JSON ufficiale.

export type Ateneo = {
  nome: string;
  citta: string;
  tipo: string;
  alias?: string[];
  sedi?: string[];
};

export const ATENEI: Ateneo[] = [
  {
    "nome": "Alma Mater Studiorum - Università di Bologna",
    "citta": "Bologna",
    "tipo": "statale",
    "alias": [
      "unibo",
      "alma mater"
    ]
  },
  {
    "nome": "Centro Alti Studi per la Difesa",
    "citta": "Roma",
    "tipo": "ordinamento speciale",
    "alias": [
      "casd"
    ]
  },
  {
    "nome": "Gran Sasso Science Institute",
    "citta": "L'Aquila",
    "tipo": "ordinamento speciale",
    "alias": [
      "gssi"
    ]
  },
  {
    "nome": "Humanitas University",
    "citta": "Rozzano",
    "tipo": "non statale",
    "alias": [
      "humanitas",
      "hunimed"
    ]
  },
  {
    "nome": "Institute of Advanced Science for Agriculture",
    "citta": "Jolanda di Savoia",
    "tipo": "ordinamento speciale",
    "alias": [
      "iasa"
    ]
  },
  {
    "nome": "Istituto Universitario di Studi Superiori di Pavia",
    "citta": "Pavia",
    "tipo": "ordinamento speciale",
    "alias": [
      "iuss"
    ]
  },
  {
    "nome": "IULM - Libera Università di Lingue e Comunicazione",
    "citta": "Milano",
    "tipo": "non statale",
    "alias": [
      "iulm"
    ]
  },
  {
    "nome": "Libera Università di Bolzano",
    "citta": "Bolzano",
    "tipo": "non statale",
    "alias": [
      "unibz",
      "bozen"
    ]
  },
  {
    "nome": "Link Campus University",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "link campus"
    ],
    "sedi": [
      "Roma",
      "Napoli",
      "Novedrate",
      "Ascoli Piceno",
      "Fano",
      "Macerata",
      "Città di Castello"
    ]
  },
  {
    "nome": "LIUC - Università Cattaneo",
    "citta": "Castellanza",
    "tipo": "non statale",
    "alias": [
      "liuc"
    ]
  },
  {
    "nome": "LUISS Guido Carli",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "luiss"
    ]
  },
  {
    "nome": "LUM - Libera Università Mediterranea \"Giuseppe Degennaro\"",
    "citta": "Casamassima",
    "tipo": "non statale",
    "alias": [
      "lum"
    ]
  },
  {
    "nome": "LUMSA - Libera Università Maria Santissima Assunta",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "lumsa"
    ],
    "sedi": [
      "Roma",
      "Palermo",
      "Taranto"
    ]
  },
  {
    "nome": "Politecnico di Bari",
    "citta": "Bari",
    "tipo": "statale",
    "alias": [
      "poliba"
    ]
  },
  {
    "nome": "Politecnico di Milano",
    "citta": "Milano",
    "tipo": "statale",
    "alias": [
      "polimi"
    ]
  },
  {
    "nome": "Politecnico di Torino",
    "citta": "Torino",
    "tipo": "statale",
    "alias": [
      "polito"
    ]
  },
  {
    "nome": "Saint Camillus International University of Health Sciences",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "unicamillus"
    ]
  },
  {
    "nome": "Sapienza Università di Roma",
    "citta": "Roma",
    "tipo": "statale",
    "alias": [
      "sapienza",
      "la sapienza",
      "uniroma1"
    ]
  },
  {
    "nome": "Scuola IMT Alti Studi Lucca",
    "citta": "Lucca",
    "tipo": "ordinamento speciale",
    "alias": [
      "imt"
    ]
  },
  {
    "nome": "Scuola Internazionale Superiore di Studi Avanzati",
    "citta": "Trieste",
    "tipo": "ordinamento speciale",
    "alias": [
      "sissa"
    ]
  },
  {
    "nome": "Scuola Normale Superiore",
    "citta": "Pisa",
    "tipo": "ordinamento speciale",
    "alias": [
      "normale",
      "sns"
    ]
  },
  {
    "nome": "Scuola Superiore Meridionale",
    "citta": "Napoli",
    "tipo": "ordinamento speciale",
    "alias": [
      "ssm"
    ]
  },
  {
    "nome": "Scuola Superiore Sant'Anna",
    "citta": "Pisa",
    "tipo": "ordinamento speciale",
    "alias": [
      "sant'anna",
      "santanna"
    ]
  },
  {
    "nome": "UNINEUROMED - Neuromed Mediterranean University",
    "citta": "Pozzilli",
    "tipo": "non statale",
    "alias": [
      "neuromed"
    ]
  },
  {
    "nome": "Università Ca' Foscari Venezia",
    "citta": "Venezia",
    "tipo": "statale",
    "alias": [
      "ca foscari",
      "unive"
    ]
  },
  {
    "nome": "Università Campus Bio-Medico di Roma",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "campus bio-medico",
      "unicampus"
    ]
  },
  {
    "nome": "Università Cattolica del Sacro Cuore",
    "citta": "Milano",
    "tipo": "non statale",
    "alias": [
      "cattolica",
      "unicatt"
    ],
    "sedi": [
      "Milano",
      "Roma",
      "Brescia",
      "Piacenza",
      "Cremona"
    ]
  },
  {
    "nome": "Università Commerciale Luigi Bocconi",
    "citta": "Milano",
    "tipo": "non statale",
    "alias": [
      "bocconi"
    ]
  },
  {
    "nome": "Università degli Studi \"Gabriele d'Annunzio\" Chieti-Pescara",
    "citta": "Chieti",
    "tipo": "statale",
    "alias": [
      "d'annunzio",
      "unich"
    ]
  },
  {
    "nome": "Università degli Studi \"Magna Graecia\" di Catanzaro",
    "citta": "Catanzaro",
    "tipo": "statale",
    "alias": [
      "magna graecia",
      "unicz"
    ]
  },
  {
    "nome": "Università degli Studi \"Mediterranea\" di Reggio Calabria",
    "citta": "Reggio Calabria",
    "tipo": "statale",
    "alias": [
      "unirc"
    ]
  },
  {
    "nome": "Università degli Studi del Molise",
    "citta": "Campobasso",
    "tipo": "statale",
    "alias": [
      "unimol"
    ]
  },
  {
    "nome": "Università degli Studi del Piemonte Orientale \"Amedeo Avogadro\"",
    "citta": "Vercelli",
    "tipo": "statale",
    "alias": [
      "upo",
      "piemonte orientale"
    ],
    "sedi": [
      "Alessandria",
      "Novara",
      "Vercelli"
    ]
  },
  {
    "nome": "Università degli Studi del Sannio",
    "citta": "Benevento",
    "tipo": "statale",
    "alias": [
      "unisannio"
    ]
  },
  {
    "nome": "Università degli Studi dell'Aquila",
    "citta": "L'Aquila",
    "tipo": "statale",
    "alias": [
      "univaq"
    ]
  },
  {
    "nome": "Università degli Studi dell'Insubria",
    "citta": "Varese",
    "tipo": "statale",
    "alias": [
      "insubria",
      "uninsubria"
    ],
    "sedi": [
      "Varese",
      "Como"
    ]
  },
  {
    "nome": "Università degli Studi della Basilicata",
    "citta": "Potenza",
    "tipo": "statale",
    "alias": [
      "unibas"
    ],
    "sedi": [
      "Potenza",
      "Matera"
    ]
  },
  {
    "nome": "Università degli Studi della Campania \"Luigi Vanvitelli\"",
    "citta": "Caserta",
    "tipo": "statale",
    "alias": [
      "vanvitelli",
      "seconda universita di napoli"
    ]
  },
  {
    "nome": "Università degli Studi della Tuscia",
    "citta": "Viterbo",
    "tipo": "statale",
    "alias": [
      "unitus"
    ]
  },
  {
    "nome": "Università degli Studi di Bari \"Aldo Moro\"",
    "citta": "Bari",
    "tipo": "statale",
    "alias": [
      "uniba"
    ]
  },
  {
    "nome": "Università degli Studi di Bergamo",
    "citta": "Bergamo",
    "tipo": "statale",
    "alias": [
      "unibg"
    ]
  },
  {
    "nome": "Università degli Studi di Brescia",
    "citta": "Brescia",
    "tipo": "statale",
    "alias": [
      "unibs"
    ]
  },
  {
    "nome": "Università degli Studi di Cagliari",
    "citta": "Cagliari",
    "tipo": "statale",
    "alias": [
      "unica"
    ]
  },
  {
    "nome": "Università degli Studi di Camerino",
    "citta": "Camerino",
    "tipo": "statale",
    "alias": [
      "unicam"
    ]
  },
  {
    "nome": "Università degli Studi di Cassino e del Lazio Meridionale",
    "citta": "Cassino",
    "tipo": "statale",
    "alias": [
      "unicas"
    ]
  },
  {
    "nome": "Università degli Studi di Catania",
    "citta": "Catania",
    "tipo": "statale",
    "alias": [
      "unict"
    ]
  },
  {
    "nome": "Università degli Studi di Enna \"Kore\"",
    "citta": "Enna",
    "tipo": "non statale",
    "alias": [
      "kore",
      "unikore"
    ]
  },
  {
    "nome": "Università degli Studi di Ferrara",
    "citta": "Ferrara",
    "tipo": "statale",
    "alias": [
      "unife"
    ]
  },
  {
    "nome": "Università degli Studi di Firenze",
    "citta": "Firenze",
    "tipo": "statale",
    "alias": [
      "unifi"
    ]
  },
  {
    "nome": "Università degli Studi di Foggia",
    "citta": "Foggia",
    "tipo": "statale",
    "alias": [
      "unifg"
    ]
  },
  {
    "nome": "Università degli Studi di Genova",
    "citta": "Genova",
    "tipo": "statale",
    "alias": [
      "unige"
    ]
  },
  {
    "nome": "Università degli Studi di Macerata",
    "citta": "Macerata",
    "tipo": "statale",
    "alias": [
      "unimc"
    ]
  },
  {
    "nome": "Università degli Studi di Messina",
    "citta": "Messina",
    "tipo": "statale",
    "alias": [
      "unime"
    ]
  },
  {
    "nome": "Università degli Studi di Milano",
    "citta": "Milano",
    "tipo": "statale",
    "alias": [
      "statale di milano",
      "unimi"
    ]
  },
  {
    "nome": "Università degli Studi di Milano-Bicocca",
    "citta": "Milano",
    "tipo": "statale",
    "alias": [
      "bicocca",
      "unimib"
    ]
  },
  {
    "nome": "Università degli Studi di Modena e Reggio Emilia",
    "citta": "Modena",
    "tipo": "statale",
    "alias": [
      "unimore"
    ],
    "sedi": [
      "Modena",
      "Reggio Emilia"
    ]
  },
  {
    "nome": "Università degli Studi di Napoli \"L'Orientale\"",
    "citta": "Napoli",
    "tipo": "statale",
    "alias": [
      "orientale",
      "unior"
    ]
  },
  {
    "nome": "Università degli Studi di Napoli \"Parthenope\"",
    "citta": "Napoli",
    "tipo": "statale",
    "alias": [
      "parthenope",
      "uniparthenope"
    ]
  },
  {
    "nome": "Università degli Studi di Napoli Federico II",
    "citta": "Napoli",
    "tipo": "statale",
    "alias": [
      "federico ii",
      "unina"
    ]
  },
  {
    "nome": "Università degli Studi di Padova",
    "citta": "Padova",
    "tipo": "statale",
    "alias": [
      "unipd"
    ]
  },
  {
    "nome": "Università degli Studi di Palermo",
    "citta": "Palermo",
    "tipo": "statale",
    "alias": [
      "unipa"
    ]
  },
  {
    "nome": "Università degli Studi di Parma",
    "citta": "Parma",
    "tipo": "statale",
    "alias": [
      "unipr"
    ]
  },
  {
    "nome": "Università degli Studi di Pavia",
    "citta": "Pavia",
    "tipo": "statale",
    "alias": [
      "unipv"
    ]
  },
  {
    "nome": "Università degli Studi di Perugia",
    "citta": "Perugia",
    "tipo": "statale",
    "alias": [
      "unipg"
    ]
  },
  {
    "nome": "Università degli Studi di Roma \"Foro Italico\"",
    "citta": "Roma",
    "tipo": "statale",
    "alias": [
      "foro italico",
      "iusm"
    ]
  },
  {
    "nome": "Università degli Studi di Roma \"Tor Vergata\"",
    "citta": "Roma",
    "tipo": "statale",
    "alias": [
      "tor vergata",
      "uniroma2"
    ]
  },
  {
    "nome": "Università degli Studi di Salerno",
    "citta": "Fisciano",
    "tipo": "statale",
    "alias": [
      "unisa"
    ]
  },
  {
    "nome": "Università degli Studi di Sassari",
    "citta": "Sassari",
    "tipo": "statale",
    "alias": [
      "uniss"
    ]
  },
  {
    "nome": "Università degli Studi di Scienze Gastronomiche",
    "citta": "Pollenzo",
    "tipo": "non statale",
    "alias": [
      "unisg",
      "pollenzo"
    ]
  },
  {
    "nome": "Università degli Studi di Siena",
    "citta": "Siena",
    "tipo": "statale",
    "alias": [
      "unisi"
    ]
  },
  {
    "nome": "Università degli Studi di Teramo",
    "citta": "Teramo",
    "tipo": "statale",
    "alias": [
      "unite"
    ]
  },
  {
    "nome": "Università degli Studi di Torino",
    "citta": "Torino",
    "tipo": "statale",
    "alias": [
      "unito"
    ]
  },
  {
    "nome": "Università degli Studi di Trento",
    "citta": "Trento",
    "tipo": "statale",
    "alias": [
      "unitn"
    ]
  },
  {
    "nome": "Università degli Studi di Trieste",
    "citta": "Trieste",
    "tipo": "statale",
    "alias": [
      "units"
    ]
  },
  {
    "nome": "Università degli Studi di Udine",
    "citta": "Udine",
    "tipo": "statale",
    "alias": [
      "uniud"
    ]
  },
  {
    "nome": "Università degli Studi di Urbino \"Carlo Bo\"",
    "citta": "Urbino",
    "tipo": "statale",
    "alias": [
      "uniurb"
    ]
  },
  {
    "nome": "Università degli Studi di Verona",
    "citta": "Verona",
    "tipo": "statale",
    "alias": [
      "univr"
    ]
  },
  {
    "nome": "Università degli Studi Internazionali di Roma",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "unint"
    ]
  },
  {
    "nome": "Università degli Studi Roma Tre",
    "citta": "Roma",
    "tipo": "statale",
    "alias": [
      "roma tre",
      "uniroma3"
    ]
  },
  {
    "nome": "Università degli Studi Suor Orsola Benincasa",
    "citta": "Napoli",
    "tipo": "non statale",
    "alias": [
      "suor orsola",
      "unisob"
    ]
  },
  {
    "nome": "Università del Salento",
    "citta": "Lecce",
    "tipo": "statale",
    "alias": [
      "unisalento"
    ]
  },
  {
    "nome": "Università della Calabria",
    "citta": "Arcavacata di Rende",
    "tipo": "statale",
    "alias": [
      "unical"
    ]
  },
  {
    "nome": "Università della Valle d'Aosta",
    "citta": "Aosta",
    "tipo": "non statale",
    "alias": [
      "univda"
    ]
  },
  {
    "nome": "Università di Pisa",
    "citta": "Pisa",
    "tipo": "statale",
    "alias": [
      "unipi"
    ]
  },
  {
    "nome": "Università Europea di Roma",
    "citta": "Roma",
    "tipo": "non statale",
    "alias": [
      "uer"
    ]
  },
  {
    "nome": "Università Iuav di Venezia",
    "citta": "Venezia",
    "tipo": "statale",
    "alias": [
      "iuav"
    ]
  },
  {
    "nome": "Università per Stranieri \"Dante Alighieri\"",
    "citta": "Reggio Calabria",
    "tipo": "non statale",
    "alias": [
      "unidarc"
    ]
  },
  {
    "nome": "Università per Stranieri di Perugia",
    "citta": "Perugia",
    "tipo": "statale",
    "alias": [
      "stranieri perugia",
      "unistrapg"
    ]
  },
  {
    "nome": "Università per Stranieri di Siena",
    "citta": "Siena",
    "tipo": "statale",
    "alias": [
      "stranieri siena",
      "unistrasi"
    ]
  },
  {
    "nome": "Università Politecnica delle Marche",
    "citta": "Ancona",
    "tipo": "statale",
    "alias": [
      "univpm"
    ]
  },
  {
    "nome": "Università Telematica \"Giustino Fortunato\"",
    "citta": "Benevento",
    "tipo": "telematica",
    "alias": [
      "fortunato",
      "unifortunato"
    ]
  },
  {
    "nome": "Università Telematica \"Guglielmo Marconi\"",
    "citta": "Roma",
    "tipo": "telematica",
    "alias": [
      "marconi",
      "unimarconi"
    ]
  },
  {
    "nome": "Università Telematica \"Leonardo da Vinci\"",
    "citta": "Torrevecchia Teatina",
    "tipo": "telematica",
    "alias": [
      "da vinci",
      "unidav"
    ]
  },
  {
    "nome": "Università Telematica \"Niccolò Cusano\"",
    "citta": "Roma",
    "tipo": "telematica",
    "alias": [
      "cusano",
      "unicusano"
    ]
  },
  {
    "nome": "Università Telematica \"Pegaso\"",
    "citta": "Napoli",
    "tipo": "telematica",
    "alias": [
      "pegaso",
      "unipegaso"
    ]
  },
  {
    "nome": "Università Telematica \"San Raffaele\" Roma",
    "citta": "Roma",
    "tipo": "telematica",
    "alias": [
      "san raffaele roma",
      "unisanraffaele"
    ]
  },
  {
    "nome": "Università Telematica \"Universitas Mercatorum\"",
    "citta": "Roma",
    "tipo": "telematica",
    "alias": [
      "mercatorum",
      "unimercatorum"
    ]
  },
  {
    "nome": "Università Telematica degli Studi IUL",
    "citta": "Firenze",
    "tipo": "telematica",
    "alias": [
      "iul"
    ]
  },
  {
    "nome": "Università Telematica e-Campus",
    "citta": "Novedrate",
    "tipo": "telematica",
    "alias": [
      "ecampus",
      "e-campus"
    ]
  },
  {
    "nome": "Università Telematica Internazionale UniNettuno",
    "citta": "Roma",
    "tipo": "telematica",
    "alias": [
      "uninettuno",
      "nettuno"
    ]
  },
  {
    "nome": "Università Telematica UNITELMA Sapienza",
    "citta": "Roma",
    "tipo": "telematica",
    "alias": [
      "unitelma"
    ]
  },
  {
    "nome": "Università Vita-Salute San Raffaele",
    "citta": "Milano",
    "tipo": "non statale",
    "alias": [
      "san raffaele",
      "unisr"
    ]
  }
];

/**
 * Normalizza per confronti robusti: minuscole, senza accenti e senza apostrofi.
 * Cosi' "citta" trova "Citta'" e "universita" trova "Universita'".
 */
export function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filtra gli atenei per query cercando in nome, citta' e alias (corrispondenza
 * parziale ovunque nella stringa, insensibile a maiuscole e accenti).
 */
export function cercaAtenei(query: string): Ateneo[] {
  const q = normalizza(query);
  if (!q) return ATENEI;
  return ATENEI.filter((a) => {
    const campi = [a.nome, a.citta, ...(a.alias ?? [])];
    return campi.some((c) => normalizza(c).includes(q));
  });
}
