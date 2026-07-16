/**
 * Lógica pura de las acciones de retro (RMR-TSK-0246): resolver owners a nombres,
 * quién puede cambiar el estado y filtro de ámbito. Compartida por <retro-actions>,
 * <retro-carryover> y <retro-action-row> para no duplicar.
 */

/** Nombres de los owners de una acción (o «Sin owner»). @param {any} action @param {Array<{uid:string,name:string}>} members */
export function ownersText(action, members = []) {
  const name = (uid) => members.find((m) => m.uid === uid)?.name ?? 'Alguien';
  const names = (action?.owners ?? []).map(name);
  return names.length ? names.join(', ') : 'Sin owner';
}

/** ¿Puede este usuario cambiar el estado? El líder siempre; un owner, la suya. */
export function canToggle(action, uid, leaderUid) {
  if (!uid) return false;
  if (uid === leaderUid) return true;
  return (action?.owners ?? []).includes(uid);
}

/** ¿La acción pertenece a este ámbito (equipo o el mismo squad)? */
export function sameScope(action, scope = {}) {
  const a = action?.scope ?? {};
  if ((a.type ?? 'team') !== (scope?.type ?? 'team')) return false;
  return scope?.type === 'squad' ? (a.label ?? null) === (scope?.label ?? null) : true;
}
