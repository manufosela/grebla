/**
 * Lógica pura de las acciones de retro (RMR-TSK-0246): resolver owners a nombres,
 * quién puede cambiar el estado y filtro de ámbito. Compartida por <retro-actions>,
 * <retro-carryover> y <retro-action-row> para no duplicar.
 */

/**
 * Nombres de los owners de una acción (o «Sin owner»). Prefiere los ownerNames
 * denormalizados (para que los vea quien no tiene el roster, p. ej. el ingeniero);
 * si no, resuelve los uids contra `members`.
 * @param {any} action @param {Array<{uid:string,name:string}>} members
 */
export function ownersText(action, members = []) {
  if (action?.ownerNames?.length) return action.ownerNames.join(', ');
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

/** Seguimiento (RMR-TSK-0644): 'pending' | 'done' | 'all'. */
export function filterByStatus(actions, status) {
  return status === 'all' ? actions : actions.filter((a) => (a.status ?? 'pending') === status);
}

/** Una celda CSV: entre comillas si hace falta y sin dejar que la hoja de cálculo la tome por fórmula. */
function csvCell(value) {
  let text = String(value ?? '');
  // También tras espacios o caracteres de control iniciales: la hoja de cálculo los salta.
  if (/^[\s\p{Cc}]*[=+\-@]/u.test(text)) text = `'${text}`;
  return /[",\r\n]|^'/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const isoDay = (ts) => (ts?.seconds ? new Date(ts.seconds * 1000).toISOString().slice(0, 10) : '');

/**
 * Las acciones en CSV (RMR-TSK-0644): acción, responsable, retro, estado y día de creación.
 * @param {any[]} actions @param {Map<string, string>} retroNameById
 */
export function actionsCsv(actions, retroNameById) {
  const rows = actions.map((a) => [
    a.text, ownersText(a), retroNameById.get(a.fromRetroId) ?? a.fromRetroId ?? '',
    a.status === 'done' ? 'Hecha' : 'Pendiente', isoDay(a.createdAt),
  ]);
  return [['Acción', 'Responsable', 'Retro', 'Estado', 'Creada'], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** ¿La acción pertenece a este ámbito (equipo o el mismo squad)? */
export function sameScope(action, scope = {}) {
  const a = action?.scope ?? {};
  if ((a.type ?? 'team') !== (scope?.type ?? 'team')) return false;
  return scope?.type === 'squad' ? (a.label ?? null) === (scope?.label ?? null) : true;
}
