/**
 * Tiempo de juego del Mapa de Carrera (MC-23), funciones PURAS (sin DOM ni
 * Firestore): acumulación del cronómetro de sesión activa, clave de día local,
 * resumen legible (hoy / últimos 7 días / total) y poda del histórico por día.
 *
 * El documento persistido vive en /people/{personId}/career/playtime:
 *   { totalMinutes: number, byDay: { 'YYYY-MM-DD': number } }
 * Los minutos se escriben con increment() (ver la persistencia Firestore);
 * aquí solo se decide QUÉ acumular, cómo resumirlo y qué días podar.
 *
 * @typedef {{ totalMinutes: number, byDay: Record<string, number> }} Playtime
 * @typedef {{ today: number, last7Days: number, total: number }} PlaytimeSummary
 *   Resumen en MINUTOS (números; formatPlayMinutes los hace legibles).
 */

/**
 * Constantes del cronómetro de juego (MC-23):
 *  - idleMs: sin interacción (input/tecla/puntero) durante este tiempo, el
 *    cronómetro se PAUSA aunque la pestaña siga visible.
 *  - tickMs: cadencia del muestreo del tracker (acumula en memoria).
 *  - flushMs: cadencia del volcado a persistencia. La PÉRDIDA MÁXIMA si el
 *    navegador mata la pestaña sin avisar es ~flushMs (60 s), documentada.
 *  - minFlushMs: por debajo de esto no se escribe (evita escrituras de ruido).
 *  - activityThrottleMs: el listener de actividad solo re-sella el reloj si
 *    pasó al menos esto (pointermove dispara a ráfagas).
 *  - maxDays / pruneThreshold: byDay guarda los últimos maxDays días; la poda
 *    se dispara al superar pruneThreshold claves (histéresis: no borra a diario).
 */
export const PLAYTIME = Object.freeze({
  idleMs: 120_000,
  tickMs: 5_000,
  flushMs: 60_000,
  minFlushMs: 1_000,
  activityThrottleMs: 1_000,
  maxDays: 30,
  pruneThreshold: 35,
});

/**
 * Acumula un delta de muestreo en el buffer del cronómetro. Los deltas fuera
 * de rango se DESCARTAN (devuelven el buffer intacto): un dt ≤ 0 es un reloj
 * raro y un dt mayor que `maxMs` (por defecto 2 ticks) delata un timer
 * suspendido (pestaña dormida, portátil en reposo) — ese tiempo NO fue juego.
 * Falla en alto con entradas no numéricas: sin fallbacks silenciosos.
 *
 * @param {number} bufferMs Milisegundos acumulados sin volcar (≥ 0).
 * @param {number} dtMs Delta del muestreo (ms).
 * @param {{ maxMs?: number }} [opts] Techo del delta aceptable.
 * @returns {number} El buffer actualizado (ms).
 */
export function accumulate(bufferMs, dtMs, opts = {}) {
  if (!Number.isFinite(bufferMs) || bufferMs < 0) {
    throw new Error(`Buffer inválido para accumulate: "${bufferMs}"`);
  }
  if (!Number.isFinite(dtMs)) {
    throw new Error(`Delta inválido para accumulate: "${dtMs}"`);
  }
  const maxMs = opts.maxMs ?? PLAYTIME.tickMs * 2;
  if (!Number.isFinite(maxMs) || maxMs <= 0) {
    throw new Error(`Techo de delta inválido para accumulate: "${maxMs}"`);
  }
  if (dtMs <= 0 || dtMs > maxMs) return bufferMs;
  return bufferMs + dtMs;
}

/**
 * ¿Cuenta este muestreo como juego activo? Solo con la pestaña VISIBLE y con
 * interacción (input/tecla/puntero) dentro de la ventana de inactividad.
 *
 * @param {boolean} visible document.visibilityState === 'visible'.
 * @param {number} lastActivityTs Sello (ms) de la última interacción.
 * @param {number} nowTs Reloj actual (ms).
 * @param {number} [idleMs] Ventana de inactividad (por defecto PLAYTIME.idleMs).
 * @returns {boolean}
 */
export function isActiveSample(visible, lastActivityTs, nowTs, idleMs = PLAYTIME.idleMs) {
  return (
    visible === true &&
    Number.isFinite(lastActivityTs) &&
    Number.isFinite(nowTs) &&
    nowTs - lastActivityTs <= idleMs
  );
}

/**
 * Clave de día LOCAL 'YYYY-MM-DD' (el día del que está jugando, no UTC: una
 * sesión de las 23:30 cuenta al día en que el jugador la vivió).
 *
 * @param {Date} date
 * @returns {string}
 */
export function dayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida para dayKey: "${date}"`);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Milisegundos → minutos con 2 decimales (la unidad persistida): 60 s = 1.
 * @param {number} ms
 * @returns {number}
 */
export function minutesFromMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error(`Milisegundos inválidos para minutesFromMs: "${ms}"`);
  }
  return Math.round((ms / 60_000) * 100) / 100;
}

/**
 * Normaliza un documento de playtime persistido (o null) al modelo actual:
 * números no finitos o negativos caen a 0 y las claves de byDay que no son
 * 'YYYY-MM-DD' se descartan (datos corruptos no tumban el resumen).
 *
 * @param {Record<string, unknown>|null|undefined} doc
 * @returns {Playtime}
 */
export function normalizePlaytime(doc) {
  const sane = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  /** @type {Record<string, number>} */
  const byDay = {};
  const rawByDay = doc?.byDay;
  if (rawByDay && typeof rawByDay === 'object') {
    for (const [key, value] of Object.entries(rawByDay)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      byDay[key] = sane(value);
    }
  }
  return { totalMinutes: sane(doc?.totalMinutes), byDay };
}

/**
 * Resumen del tiempo de juego en MINUTOS: hoy, últimos 7 días (hoy incluido)
 * y total histórico. Los días se resuelven en hora LOCAL con aritmética de
 * calendario (setDate), a prueba de cambios de hora.
 *
 * @param {Playtime|null|undefined} doc Documento (normalizado o crudo).
 * @param {Date} [now] Reloj de referencia (por defecto, ahora).
 * @returns {PlaytimeSummary}
 */
export function playtimeSummary(doc, now = new Date()) {
  const { totalMinutes, byDay } = normalizePlaytime(doc);
  let last7Days = 0;
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    last7Days += byDay[dayKey(day)] ?? 0;
  }
  return {
    today: byDay[dayKey(now)] ?? 0,
    last7Days,
    total: totalMinutes,
  };
}

/**
 * Claves de byDay a PODAR: cuando el histórico supera `threshold` claves se
 * devuelven las más antiguas dejando solo las `maxDays` más recientes (las
 * claves 'YYYY-MM-DD' ordenan cronológicamente por texto). Con histéresis:
 * por debajo del umbral no se poda nada (una escritura de poda cada ~5 días,
 * no una diaria).
 *
 * @param {Record<string, number>} byDay
 * @param {{ maxDays?: number, threshold?: number }} [opts]
 * @returns {string[]} Claves a borrar (vacío si no toca podar).
 */
export function staleDayKeys(byDay, opts = {}) {
  const maxDays = opts.maxDays ?? PLAYTIME.maxDays;
  const threshold = opts.threshold ?? PLAYTIME.pruneThreshold;
  if (!Number.isInteger(maxDays) || maxDays <= 0 || !Number.isInteger(threshold) || threshold < maxDays) {
    throw new Error(`Parámetros de poda inválidos: maxDays="${maxDays}", threshold="${threshold}"`);
  }
  const keys = Object.keys(byDay ?? {}).toSorted();
  if (keys.length <= threshold) return [];
  return keys.slice(0, keys.length - maxDays);
}

/**
 * Minutos → etiqueta compacta legible (estilo formatHours de DORA): minutos
 * hasta 1 hora, «H h M min» a partir de ahí (sin «0 min» residual). Devuelve
 * null para valores no medibles — el llamador decide el texto de «sin datos».
 *
 * @param {number|null|undefined} minutes
 * @returns {string|null}
 */
export function formatPlayMinutes(minutes) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  const whole = Math.round(minutes);
  if (whole < 1) return minutes > 0 ? '<1 min' : '0 min';
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
