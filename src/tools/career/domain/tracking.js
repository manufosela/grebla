/**
 * Seguimiento del plan de desarrollo (RMR-TSK-0566): lo puro.
 *
 * Reúne en una línea por persona lo que ya está guardado —por dónde va su viaje
 * y cuánto rato le dedica (el cronómetro MC-23)— para poder mirarlo de un
 * vistazo. No mide nada nuevo: no hay ningún dato aquí que no estuviera ya en su
 * ficha.
 *
 * Para qué sirve y para qué no: sirve para ver quién tiene el plan parado y
 * necesita que alguien se siente con él. No es una vara de medir: dedicarle más
 * ratos no es ser mejor ingeniero, y el framework de GREBLA es lo que impide que
 * un número así se use para valorar a nadie.
 */
import { PLAYTIME, normalizePlaytime, dayKey } from './playtime.js';

/**
 * Días de los que se puede hablar. El cronómetro poda su histórico por día, así
 * que cualquier cuenta más larga hablaría de datos que ya no existen.
 */
export const ACTIVITY_WINDOW_DAYS = PLAYTIME.maxDays;

/**
 * @typedef {Object} Activity
 * @property {number} daysActive              días con dedicación dentro de la ventana
 * @property {number} windowMinutes           minutos dentro de la ventana
 * @property {number} totalMinutes            minutos acumulados de siempre
 * @property {number} avgMinutesPerActiveDay  media por día ACTIVO
 * @property {string|null} lastDay            último día con dedicación
 * @property {number|null} idleDays           días desde ese último día (null si nunca)
 */

/**
 * Dedicación de una persona a partir de su cronómetro.
 * @param {{ totalMinutes?: number, byDay?: Record<string, number> }|null|undefined} playtime
 * @param {Date} now
 * @returns {Activity}
 */
export function activityFrom(playtime, now) {
  const { totalMinutes, byDay } = normalizePlaytime(playtime);
  const hoy = dayKey(now);
  // Un día en el futuro es un reloj mal puesto, no dedicación; y un día a cero
  // es un documento, no una sesión.
  const dias = Object.entries(byDay)
    .filter(([day, min]) => min > 0 && day <= hoy)
    .map(([day, min]) => ({ day, min }));

  const windowMinutes = dias.reduce((acc, d) => acc + d.min, 0);
  const daysActive = dias.length;
  const lastDay = daysActive === 0 ? null : dias.map((d) => d.day).toSorted(byDayAsc).at(-1);
  return {
    daysActive,
    windowMinutes,
    totalMinutes,
    avgMinutesPerActiveDay: daysActive === 0 ? 0 : Math.round(windowMinutes / daysActive),
    lastDay,
    idleDays: lastDay === null ? null : daysBetween(lastDay, hoy),
  };
}

/**
 * Orden cronológico de claves 'YYYY-MM-DD'. Comparador explícito y NO
 * localizado: en ISO el orden de texto ya es el del calendario, y un comparador
 * de idioma no lo mejora — puede alterarlo.
 */
function byDayAsc(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Días naturales entre dos claves 'YYYY-MM-DD'. */
function daysBetween(from, to) {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Una línea de seguimiento: por dónde va y cuánto le dedica.
 * @param {{ person: {id: string, name?: string, careerTargetLevelId?: string|null},
 *           journey: {currentIsland?: string|null, visitedCities?: string[], plannedRoute?: string[]}|null,
 *           stats: {pct?: number}|null,
 *           playtime: unknown }} entry
 * @param {Date} now
 */
export function trackingRow({ person, journey, stats, playtime }, now) {
  const visited = journey?.visitedCities ?? [];
  // `plannedRoute` es el nombre del campo persistido (normalizeJourney): la ruta
  // que la persona se ha trazado.
  const route = journey?.plannedRoute ?? [];
  // «Empezado» es haber pisado algo o haberse trazado una ruta. Sin eso, los
  // ceros no son un dato: son la ausencia de dato, y conviene que se distingan.
  const started = visited.length > 0 || route.length > 0;
  return {
    personId: person.id,
    name: person.name ?? '',
    targetLevelId: person.careerTargetLevelId ?? null,
    started,
    currentIsland: started ? (journey?.currentIsland ?? null) : null,
    visitedCities: visited,
    visitedCount: visited.length,
    routeCount: route.length,
    pct: started ? (stats?.pct ?? 0) : null,
    activity: activityFrom(playtime, now),
  };
}

/**
 * Orden de atención: primero quien no ha empezado, luego quien lleva más tiempo
 * sin tocarlo. Es el orden de la conversación pendiente, no un ranking.
 * @param {Array<{started: boolean, activity: {idleDays: number|null}}>} rows
 */
export function sortByNeglect(rows) {
  // Sin empezar y sin rastro pesan lo mismo: lo máximo. Así van arriba los dos.
  const peso = (r) => (r.started === false || r.activity?.idleDays == null
    ? Number.POSITIVE_INFINITY
    : r.activity.idleDays);
  return (rows ?? []).toSorted((a, b) => peso(b) - peso(a));
}
