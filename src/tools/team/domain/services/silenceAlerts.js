/**
 * Avisos de silencio (R7) — personas sin registros recientes según la cadencia
 * configurada. La app NO impone frecuencia; solo señala silencios. En el MVP el
 * aviso se entiende también como posible sesgo de observabilidad/relación (R8).
 *
 * Función pura: `now` se pasa como parámetro (testeable, sin reloj interno).
 *
 * @typedef {Object} ActivityEntry
 * @property {string} personId
 * @property {string|null} lastActivityDate  ISO date de la última conversación/registro, o null si nunca.
 */
const MS_PER_DAY = 86_400_000;

/**
 * @param {ActivityEntry[]} activities
 * @param {number} cadenceDays
 * @param {Date|string|number} now
 * @returns {Array<{ personId: string, daysSince: number, lastActivityDate: string|null }>}
 */
export function silenceAlerts(activities, cadenceDays, now) {
  const list = Array.isArray(activities) ? activities : [];
  const nowMs = new Date(now).getTime();

  const result = [];
  for (const a of list) {
    if (!a || a.personId == null) continue;
    if (!a.lastActivityDate) {
      result.push({ personId: a.personId, daysSince: Infinity, lastActivityDate: null });
      continue;
    }
    const daysSince = Math.floor((nowMs - new Date(a.lastActivityDate).getTime()) / MS_PER_DAY);
    if (daysSince > cadenceDays) {
      result.push({ personId: a.personId, daysSince, lastActivityDate: a.lastActivityDate });
    }
  }
  // Orden por tiempo en silencio (mayor primero). No es ranking de personas (R3):
  // es una cola de atención operativa, no una comparación de su desempeño.
  return result.sort((x, y) => y.daysSince - x.daysSince);
}
