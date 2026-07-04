/**
 * Logros persistentes del jugador (MC-21): lógica PURA de la ficha de
 * ciudadanía.
 *
 * archipelagoProgress (MC-20) ya deriva BARATO del journey todo lo calculable
 * (certificados, %, objetivo, ciudadanías, badges). Lo único que el journey no
 * puede contar es CUÁNDO se logró cada cosa: este módulo añade exactamente eso
 * — el registro de fechas — y nada más. El doc de achievements
 * (/people/{personId}/career/achievements, junto al journey) guarda solo:
 *
 *   { citizenships: { [islandId]: { achievedAt } }, badges: { superCitizen?, legend? } }
 *
 * donde `achievedAt` es un ISO 8601 del momento del logro, o `null` cuando el
 * logro es anterior a MC-21 y su fecha se desconoce («fecha no registrada»).
 *
 * DECISIONES (documentadas, ver ADR de progresión):
 *  - Fechas en ISO con el reloj del CLIENTE (no serverTimestamp): el modelo se
 *    mantiene puro y simétrico con el journey (valores planos, testeable sin
 *    Firestore), y el registro lo escribe el mismo gesto de juego que acaba de
 *    escribir el journey. La precisión de minutos no es requisito de negocio.
 *  - Migración suave: un logro que YA se cumplía sin registro (pre-MC-21) se
 *    registra con `achievedAt: null` la primera vez que la vista de juego lo
 *    detecta — registrar la fecha del día del descubrimiento sería inventarla.
 *    La ficha lo muestra como «(fecha no registrada)» para siempre: honesto.
 *  - Un registro NUNCA se re-escribe (newAchievements solo devuelve lo que
 *    falta): retirar certificados no borra logros — la ficha es historia.
 *
 * @typedef {import('./citizenship.js').ArchipelagoProgress} ArchipelagoProgress
 */

/**
 * Registro de UN logro: cuándo se consiguió (ISO 8601) o null si la fecha se
 * desconoce (logro anterior a MC-21, «fecha no registrada»).
 * @typedef {Object} AchievementRecord
 * @property {string|null} achievedAt
 */

/**
 * Ids de los badges del archipiélago (MC-20): super-ciudadano y leyenda.
 * @typedef {'superCitizen'|'legend'} BadgeId
 */

/**
 * Logros persistentes de un jugador (doc /people/{id}/career/achievements).
 * @typedef {Object} Achievements
 * @property {Record<string, AchievementRecord>} citizenships Por id de isla.
 * @property {Partial<Record<BadgeId, AchievementRecord>>} badges
 */

/** Logros vacíos (jugador sin nada registrado todavía). @type {Achievements} */
export const EMPTY_ACHIEVEMENTS = Object.freeze({
  citizenships: Object.freeze({}),
  badges: Object.freeze({}),
});

/** Badges reconocidos del doc (cualquier otra clave se descarta al normalizar). */
const BADGE_IDS = /** @type {ReadonlyArray<BadgeId>} */ (Object.freeze(['superCitizen', 'legend']));

/**
 * Sanea un registro crudo a AchievementRecord, o null si no tiene la forma
 * mínima (un objeto). `achievedAt` solo se acepta como string no vacío
 * (cualquier otra cosa — Timestamp sin convertir, número, basura — cae a null:
 * «fecha no registrada» antes que una fecha corrupta).
 * @param {unknown} raw
 * @returns {AchievementRecord|null}
 */
function normalizeRecord(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const at = /** @type {Record<string, unknown>} */ (raw).achievedAt;
  return { achievedAt: typeof at === 'string' && at.trim() !== '' ? at : null };
}

/**
 * Reconstruye los achievements desde el documento de Firestore (o null si no
 * existe): sanea tipos y descarta claves sin registro válido. Sin doc → vacíos.
 * @param {Record<string, unknown>|null|undefined} data data() del doc de achievements.
 * @returns {Achievements}
 */
export function normalizeAchievements(data) {
  if (!data) return { citizenships: {}, badges: {} };
  /** @type {Record<string, AchievementRecord>} */
  const citizenships = {};
  const rawCit = data.citizenships;
  if (typeof rawCit === 'object' && rawCit !== null) {
    for (const [islandId, raw] of Object.entries(rawCit)) {
      const record = normalizeRecord(raw);
      if (record && islandId.trim() !== '') citizenships[islandId] = record;
    }
  }
  /** @type {Partial<Record<BadgeId, AchievementRecord>>} */
  const badges = {};
  const rawBadges = data.badges;
  if (typeof rawBadges === 'object' && rawBadges !== null) {
    for (const id of BADGE_IDS) {
      const record = normalizeRecord(/** @type {Record<string, unknown>} */ (rawBadges)[id]);
      if (record) badges[id] = record;
    }
  }
  return { citizenships, badges };
}

/**
 * Parche de logros PENDIENTES de registrar: lo que el progreso actual dice
 * conseguido y aún no tiene registro. Nunca incluye claves ya registradas
 * (las fechas existentes no se re-escriben, ni siquiera las `null` de la
 * migración) y devuelve null si no falta nada (el caller se ahorra la
 * escritura).
 * @param {ArchipelagoProgress} progress Progresión derivada del journey (MC-20).
 * @param {Achievements} achievements Registros ya persistidos.
 * @param {string|null} achievedAt Fecha ISO del gesto que registra (cruce de
 *   umbral), o null para la migración de logros pre-MC-21 («fecha no registrada»).
 * @returns {Achievements|null} Parche a fusionar/persistir, o null si nada nuevo.
 */
export function newAchievements(progress, achievements, achievedAt) {
  /** @type {Record<string, AchievementRecord>} */
  const citizenships = {};
  for (const island of progress?.islands ?? []) {
    if (island.achieved && !(island.id in (achievements?.citizenships ?? {}))) {
      citizenships[island.id] = { achievedAt };
    }
  }
  /** @type {Partial<Record<BadgeId, AchievementRecord>>} */
  const badges = {};
  const recorded = achievements?.badges ?? {};
  if (progress?.superCitizen === true && !('superCitizen' in recorded)) {
    badges.superCitizen = { achievedAt };
  }
  if (progress?.legend === true && !('legend' in recorded)) {
    badges.legend = { achievedAt };
  }
  if (Object.keys(citizenships).length === 0 && Object.keys(badges).length === 0) return null;
  return { citizenships, badges };
}

/**
 * Fusión de un parche sobre los achievements en memoria (misma semántica que
 * el setDoc merge de la persistencia): las claves del parche se añaden, las
 * existentes NO se pisan — el registro es de solo-añadir.
 * @param {Achievements} achievements
 * @param {Achievements|null} patch Parche de newAchievements (o null).
 * @returns {Achievements}
 */
export function mergeAchievements(achievements, patch) {
  if (!patch) return achievements;
  return {
    citizenships: { ...patch.citizenships, ...achievements.citizenships },
    badges: { ...patch.badges, ...achievements.badges },
  };
}

/**
 * Etiqueta humana de la fecha de un logro para la ficha: fecha larga en
 * español («4 de julio de 2026»), o null si no hay fecha válida (el caller
 * pinta «fecha no registrada»).
 * @param {string|null|undefined} achievedAt ISO 8601 del registro, o null.
 * @returns {string|null}
 */
export function formatAchievedAt(achievedAt) {
  if (typeof achievedAt !== 'string' || achievedAt.trim() === '') return null;
  const date = new Date(achievedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(date);
}
