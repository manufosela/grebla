/**
 * Objetivos medibles de una persona (RMR-TSK-0748). Las EXPECTATIVAS son lo
 * que pide su nivel, iguales para todos; los OBJETIVOS son compromisos de esta
 * persona, con cómo se mide y para cuándo. Pueden ir enganchados a una
 * expectativa del nivel (así se ve qué la acerca) o sueltos.
 * Vive en /people/{personId}/careerObjectives. Módulo PURO.
 *
 * @typedef {'open'|'achieved'|'missed'|'dropped'} ObjectiveStatus
 * @typedef {{ title: string, measure: string, dueDate: string|null, levelId: string|null,
 *   dimensionId: string|null, status: ObjectiveStatus, closingNote: string, closedAt: string|null,
 *   by: { uid: string, name: string }, at: string }} Objective
 */

/** Rótulo de cada estado, en el orden en que se ofrecen. */
export const OBJECTIVE_STATUS = {
  open: 'En curso',
  achieved: 'Conseguido',
  missed: 'No conseguido',
  dropped: 'Descartado',
};

const TITLE_MAX = 200;
const MEASURE_MAX = 500;
const NOTE_MAX = 1000;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');

function checkInstant(at) {
  if (typeof at !== 'string' || !ISO_UTC.test(at) || new Date(at).toISOString() !== at) throw new Error(`Fecha no válida: «${at}».`);
}

function checkDay(day) {
  if (day === null) return;
  const ok = typeof day === 'string' && DAY.test(day) && new Date(`${day}T00:00:00.000Z`).toISOString().startsWith(day);
  if (!ok) throw new Error(`La fecha límite no es válida: «${day}» (AAAA-MM-DD).`);
}

/**
 * Objetivo nuevo, validado y abierto.
 * @returns {Objective}
 */
export function newObjective({ title, measure, dueDate = null, levelId = null, dimensionId = null, by, at }) {
  const name = trimmed(title);
  if (!name || name.length > TITLE_MAX) throw new Error(`El objetivo necesita un título (hasta ${TITLE_MAX} caracteres).`);
  const how = trimmed(measure);
  if (!how || how.length > MEASURE_MAX) throw new Error(`Falta cómo se mide (hasta ${MEASURE_MAX} caracteres).`);
  checkDay(dueDate);
  if (!levelId !== !dimensionId) throw new Error('Para engancharlo a una expectativa hacen falta su nivel y su dimensión.');
  const uid = trimmed(by?.uid);
  const who = trimmed(by?.name);
  if (!uid || !who) throw new Error('Falta el autor del objetivo.');
  checkInstant(at);
  return {
    title: name, measure: how, dueDate, levelId: levelId || null, dimensionId: dimensionId || null,
    status: 'open', closingNote: '', closedAt: null, by: { uid, name: who }, at,
  };
}

/**
 * Lo que cambia al editarlo (RMR-TSK-0771): título, medida, fecha y expectativa,
 * con las mismas reglas que al crearlo. Solo en curso: el resultado de uno
 * cerrado no se reescribe.
 * @param {{ status: ObjectiveStatus, by: { uid: string, name: string }, at: string }} objective
 * @param {{ title: string, measure: string, dueDate?: string|null, levelId?: string|null, dimensionId?: string|null }} input
 */
export function editObjective(objective, input) {
  if (objective?.status !== 'open') throw new Error('Este objetivo ya está cerrado: no se edita.');
  const { title, measure, dueDate, levelId, dimensionId } = newObjective({ ...input, by: objective.by, at: objective.at });
  return { title, measure, dueDate, levelId, dimensionId };
}

/**
 * Lo que cambia al cerrarlo. Se cierra una vez: el resultado no se reescribe.
 * @param {{ status: ObjectiveStatus }} objective
 * @param {ObjectiveStatus} status
 * @param {string} note
 * @param {string} at
 */
export function closeObjective(objective, status, note, at) {
  if (status === 'open' || !Object.hasOwn(OBJECTIVE_STATUS, status)) throw new Error(`Estado de cierre desconocido: «${status}».`);
  if (objective?.status !== 'open') throw new Error('Este objetivo ya está cerrado.');
  const closingNote = trimmed(note);
  if (closingNote.length > NOTE_MAX) throw new Error(`La nota no puede pasar de ${NOTE_MAX} caracteres.`);
  checkInstant(at);
  return { status, closingNote, closedAt: at };
}

const byDate = (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.at.localeCompare(b.at);

/**
 * Los objetivos de una expectativa concreta, el que vence antes primero.
 * @template {Objective} O
 * @param {O[]} list @param {string} levelId @param {string} dimensionId
 * @returns {O[]}
 */
export function objectivesFor(list, levelId, dimensionId) {
  return (list ?? []).filter((o) => o.levelId === levelId && o.dimensionId === dimensionId).toSorted(byDate);
}

/**
 * Los que no cuelgan de una expectativa del nivel que se mira: los sueltos y
 * los de otro nivel. Se enseñan arriba, para que ninguno se quede sin ver.
 * @template {Objective} O
 * @param {O[]} list @param {string} levelId
 * @returns {O[]}
 */
export function looseObjectives(list, levelId) {
  return (list ?? []).filter((o) => !o.dimensionId || o.levelId !== levelId).toSorted(byDate);
}
