/**
 * Participantes de una retro con su nombre (RMR-TSK-0642), para elegir el
 * responsable de una acción. Quien convoca puede no ser manager y no leer
 * /people, así que lo sirve una callable. Puro: la misma regla de lectura que
 * canReadRetro en firestore.rules y el nombre visible de cada uno.
 */

const list = (v) => (Array.isArray(v) ? v : []);

/** ¿Puede `uid` ver la retro? Igual que las reglas: dentro, en la cadena, o ve todas. */
export function canSeeRetro(retro, uid, seesAll) {
  if (seesAll) return true;
  return list(retro?.memberUids).includes(uid) || list(retro?.branchUids).includes(uid);
}

/**
 * @param {{ memberUids?: string[] }} retro
 * @param {{ fichaByUid: Map<string, string>, accounts: Map<string, { displayName?: string|null, email?: string|null }> }} names
 * @returns {Array<{ uid: string, name: string }>}
 */
export function participantRows(retro, { fichaByUid, accounts }) {
  return list(retro?.memberUids)
    .map((uid) => {
      const account = accounts.get(uid);
      const fromEmail = typeof account?.email === 'string' ? account.email.split('@')[0] : '';
      return { uid, name: fichaByUid.get(uid) || account?.displayName || fromEmail || 'Participante' };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, 'es'));
}
