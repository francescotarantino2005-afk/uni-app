// Le pose del personaggio: UNICA mappa, in un unico file. Per cambiarne una
// basta cambiare la sua riga qui, senza toccare nient'altro.
// Immagini a figura intera, sfondo trasparente, 1024x1024, allineate tra loro
// (la visiera sta nello stesso punto in tutte).
export const pose = {
  esulta: require('@/assets/images/pose/esulta.png'),
  // non c'è ancora un'immagine dedicata: usa quella dell'esultanza
  esultaMax: require('@/assets/images/pose/esulta.png'),
  // PROVVISORIA: verrà sostituita
  vicino: require('@/assets/images/pose/vicino.png'),
  ascolta: require('@/assets/images/pose/ascolta.png'),
  guarda: require('@/assets/images/pose/guarda.png'),
  pensa: require('@/assets/images/pose/pensa.png'),
};

export type Posa = keyof typeof pose;
