/**
 * Tareas de una sesión de Scrum Poker (RMR-TSK-0522). Dominio puro.
 *
 * El organizador deja la lista preparada al convocar (una tarea por línea) y
 * puede añadir más en vivo. Cada tarea guarda el valor acordado cuando la
 * votación termina en acuerdo, y la siguiente pasa a ser la actual.
 *
 * @typedef {{ id: string, title: string, value: string|null }} PokerTask
 */

const TITLE_MAX = 160;

/** Un id corto y estable por tarea, sin depender de crypto en el dominio. */
export function taskId(index, seed = Date.now()) {
  return `t${seed.toString(36)}${index.toString(36)}`;
}

/**
 * Título limpio, o '' si no hay nada que guardar.
 * @param {unknown} input
 */
export function cleanTitle(input) {
  return String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
}

/**
 * Las tareas escritas en un área de texto, una por línea. Las líneas vacías
 * no son tareas; el orden es el orden en que se escribieron.
 * @param {string} text
 * @param {number} [seed]
 * @returns {PokerTask[]}
 */
export function parseTaskLines(text, seed = Date.now(), guilds = []) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(cleanTitle)
    .filter(Boolean)
    .map((title, i) => ({ id: taskId(i, seed), title, value: null, guilds: [...guilds] }));
}

// ── Gremios de la tarea (RMR-PCS-0043 · F1) ──────────────────────────────────
// Los gremios son NOMBRES del catálogo /guilds de la instancia. Una tarea sin
// gremios es GENERAL: votan todos. QA va marcado por defecto porque todo pasa
// por QA, pero se puede quitar.

const QA_RE = /^qa$/i;

/** El gremio de QA tal como se llame en el catálogo, o null si no existe. */
export function qaGuild(catalog) {
  return (catalog ?? []).find((g) => QA_RE.test(String(g).trim())) ?? null;
}

/** Gremios con los que nace una tarea: QA si el catálogo lo tiene. */
export function defaultGuilds(catalog) {
  const qa = qaGuild(catalog);
  return qa ? [qa] : [];
}

/**
 * Deja solo gremios del catálogo, sin repetidos y en el orden del catálogo.
 * Con catálogo vacío (no cargado) se conservan tal cual, limpios.
 */
export function normalizeGuilds(guilds, catalog = []) {
  const limpios = [...new Set((guilds ?? []).map((g) => String(g ?? '').trim()).filter(Boolean))];
  const cat = (catalog ?? []).map(String);
  if (cat.length === 0) return limpios;
  return cat.filter((g) => limpios.includes(g));
}

/** @returns {string[]} gremios de la tarea (vacío = general). */
export function taskGuilds(task) {
  return Array.isArray(task?.guilds) ? task.guilds : [];
}

/** Una tarea sin gremios es general: la votan todos los gremios. */
export function isGeneralTask(task) {
  return taskGuilds(task).length === 0;
}

/** Cambia los gremios de una tarea (inmutable). */
export function setTaskGuilds(tasks, id, guilds, catalog = []) {
  const limpios = normalizeGuilds(guilds, catalog);
  return (tasks ?? []).map((t) => (t.id === id ? { ...t, guilds: limpios } : t));
}

/** La tarea actual, o null si no hay (sesión sin tareas o ya terminada). */
export function currentTask(session) {
  const tasks = session?.tasks ?? [];
  return tasks.find((t) => t.id === session?.currentTaskId) ?? null;
}

/** La primera tarea sin valor después de la dada (o desde el principio), o null si no queda ninguna. */
export function nextPendingTask(tasks, afterId = null) {
  const list = tasks ?? [];
  const from = afterId ? list.findIndex((t) => t.id === afterId) + 1 : 0;
  return list.slice(from).find((t) => t.value == null) ?? list.find((t) => t.value == null) ?? null;
}

/**
 * Cierra la tarea dada con su valor y elige la siguiente pendiente. Devuelve
 * la lista nueva y el id de la siguiente (null si no queda ninguna).
 * @param {PokerTask[]} tasks @param {string} id @param {string} value
 */
export function closeTask(tasks, id, value) {
  const list = (tasks ?? []).map((t) => (t.id === id ? { ...t, value } : t));
  const next = nextPendingTask(list, id);
  return { tasks: list, nextId: next?.id ?? null };
}

/** Añade una tarea al final. Devuelve la lista nueva y la tarea (null si el título está vacío). */
export function appendTask(tasks, title, seed = Date.now(), guilds = []) {
  const clean = cleanTitle(title);
  if (!clean) return { tasks: tasks ?? [], task: null };
  const task = { id: taskId((tasks ?? []).length, seed), title: clean, value: null, guilds: [...guilds] };
  return { tasks: [...(tasks ?? []), task], task };
}

/** Renombra una tarea. Con título vacío no cambia nada. */
export function retitleTask(tasks, id, title) {
  const clean = cleanTitle(title);
  if (!clean) return tasks ?? [];
  return (tasks ?? []).map((t) => (t.id === id ? { ...t, title: clean } : t));
}

/** Quita una tarea que aún no tiene valor: lo estimado no se borra. */
export function removeTask(tasks, id) {
  return (tasks ?? []).filter((t) => t.id !== id || t.value != null);
}

/** Mueve una tarea un puesto arriba (-1) o abajo (+1); en los extremos no hace nada. */
export function moveTask(tasks, id, dir) {
  const list = tasks ?? [];
  const i = list.findIndex((t) => t.id === id);
  const j = i + dir;
  const cabe = i !== -1 && j >= 0 && j < list.length;
  return cabe ? list.with(i, list[j]).with(j, list[i]) : list;
}

/**
 * Qué tarea queda como actual tras editar la lista: la que ya lo era si sigue
 * ahí y sin valor; si no, la primera pendiente; si no hay, null.
 */
export function pickCurrent(tasks, currentId) {
  const list = tasks ?? [];
  const sigue = list.find((t) => t.id === currentId && t.value == null);
  return sigue?.id ?? list.find((t) => t.value == null)?.id ?? null;
}

/**
 * Borradores de gremios de Convocar, uno por línea escrita, reconciliados al
 * editar el texto: cada línea nueva hereda el borrador de la línea anterior con
 * el MISMO título que aún no se haya usado (dos líneas iguales conservan cada
 * una el suyo), y la que no encuentra pareja nace con los de por defecto. Así
 * insertar, quitar o reordenar líneas no mueve los gremios a otra tarea.
 * @param {Array<{ title: string, guilds: string[] }>} previous
 * @param {string[]} titles  títulos de las líneas actuales, en orden
 * @param {string[]} defaults
 * @returns {Array<{ title: string, guilds: string[] }>}
 */
export function reconcileGuildDrafts(previous, titles, defaults = []) {
  const libres = [...(previous ?? [])];
  return (titles ?? []).map((title) => {
    const i = libres.findIndex((d) => d.title === title);
    if (i === -1) return { title, guilds: [...defaults] };
    const [draft] = libres.splice(i, 1);
    return { title, guilds: [...draft.guilds] };
  });
}
