// Le pose del personaggio: UNICA mappa, in un unico file.
// Per ora puntano tutte all'immagine attuale (la testa col cappello): quando
// arrivano le pose vere a figura intera basta cambiare UNA riga per posa, qui,
// senza toccare nient'altro.
export const pose = {
  esulta: require('@/assets/images/lode-bot-testa.png'),
  esultaMax: require('@/assets/images/lode-bot-testa.png'),
  vicino: require('@/assets/images/lode-bot-testa.png'),
  ascolta: require('@/assets/images/lode-bot-testa.png'),
  guarda: require('@/assets/images/lode-bot-testa.png'),
  pensa: require('@/assets/images/lode-bot-testa.png'),
};

export type Posa = keyof typeof pose;
