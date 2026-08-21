// id univoco lato client, generato UNA volta alla composizione di un messaggio e
// riusato nel retry (stesso id in locale e lato server → niente duplicati).
// Serve solo come chiave di idempotenza, non come segreto: crypto.randomUUID se
// c'è, altrimenti un uuid v4 basato su Math.random (formato valido per una colonna uuid).
export function nuovoId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
