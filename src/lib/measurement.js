/**
 * Cadencia de mediciones de Role Mirror.
 *
 * Una "medición" es una sesión del cuestionario (un punto del histórico). Al
 * editar, mientras la medición esté DENTRO de la ventana se sobrescribe (afinas
 * el mismo momento); pasada la ventana, el siguiente guardado crea un NUEVO
 * punto del histórico para reflejar la evolución. Ventana por defecto: 90 días
 * (trimestral) — el perfil de rol no cambia en días/semanas.
 */
export const MEASUREMENT_WINDOW_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/**
 * Normaliza distintos formatos de timestamp (Firestore Timestamp, ms, ISO) a ms.
 * @param {*} ts
 * @returns {number|null}
 */
export function tsToMs(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * ¿La sesión tiene contenido real (al menos una respuesta)? Sirve para ignorar
 * las mediciones vacías (p. ej. heredadas de versiones que creaban una sesión
 * por cada entrada).
 * @param {*} session
 * @returns {boolean}
 */
export function hasContent(session) {
  return !!session && !!session.answers && Object.keys(session.answers).length > 0;
}

/**
 * De una lista de sesiones (ordenada de más reciente a más antigua), devuelve la
 * medición activa: la más reciente CON contenido. null si ninguna tiene.
 * @param {Array<object>} sessions
 * @returns {object|null}
 */
export function pickActiveMeasurement(sessions) {
  if (!Array.isArray(sessions)) return null;
  return sessions.find(hasContent) ?? null;
}

/**
 * ¿La medición ha superado la ventana y procede crear un nuevo punto del histórico?
 * @param {number|null} measuredAtMs  Fecha de creación de la medición, en ms.
 * @param {number} nowMs
 * @param {number} [windowDays]
 * @returns {boolean}
 */
export function isMeasurementStale(measuredAtMs, nowMs, windowDays = MEASUREMENT_WINDOW_DAYS) {
  if (measuredAtMs == null) return false; // medición recién creada / sin fecha aún
  return nowMs - measuredAtMs > windowDays * MS_PER_DAY;
}
