/**
 * Kudos — dominio puro (RMR-PCS-0032 · F1, ADR de anonimato).
 *
 * Un kudo agradece a UNA persona con hasta dos mensajes cortos: público (el
 * muro semanal) y privado (solo el destinatario). Nunca lleva autor: el
 * anonimato lo garantizan la CF submitKudo y las reglas (ver ADR). El muro
 * NO es una competición: sin contadores ni ranking — personas en orden neutro
 * (alfabético) con sus mensajes públicos, agrupadas por semana ISO.
 *
 * Compartido por el cliente (validación previa + agrupado del muro) y la CF
 * (validación autoritativa): sin dependencias de Firebase.
 */

/** Longitud máxima de cada mensaje: conciso, no una carta. */
export const KUDO_MAX_LEN = 280;

const DAY_MS = 86_400_000;

/**
 * Clave de semana ISO-8601 (`YYYY-Www`, lunes a domingo) en UTC. El año es el
 * ISO del jueves de esa semana — los bordes de año caen donde deben (p. ej. el
 * 1 de enero puede pertenecer a la W52/W53 del año anterior).
 * @param {Date} date
 * @returns {string} p. ej. "2026-W32"
 */
export function isoWeekKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('isoWeekKey requiere una fecha válida');
  }
  // Jueves de la semana ISO de `date` (getUTCDay: domingo=0 → 7).
  const thursday = new Date(date);
  thursday.setUTCHours(0, 0, 0, 0);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const firstDay = Date.UTC(year, 0, 1);
  const week = Math.ceil(((thursday.getTime() - firstDay) / DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Normaliza un texto de kudo: recorta espacios y convierte vacío en null.
 * @param {unknown} value @param {string} field
 * @returns {string|null}
 */
function normalizeText(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError(`El texto «${field}» debe ser una cadena`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > KUDO_MAX_LEN) {
    throw new Error(`El mensaje «${field}» supera los ${KUDO_MAX_LEN} caracteres: sé conciso, no es una carta`);
  }
  return text;
}

/**
 * Valida y normaliza la entrada de un kudo. Autoritativa en la CF; el cliente
 * la reutiliza para avisar antes de enviar.
 * @param {{ recipientPersonId?: unknown, publicText?: unknown, privateText?: unknown }} input
 * @returns {{ recipientPersonId: string, publicText: string|null, privateText: string|null }}
 */
export function validateKudoInput(input) {
  const { recipientPersonId } = input ?? {};
  if (typeof recipientPersonId !== 'string' || !recipientPersonId.trim()) {
    throw new Error('El kudo necesita un destinatario');
  }
  const publicText = normalizeText(input.publicText, 'público');
  const privateText = normalizeText(input.privateText, 'privado');
  if (!publicText && !privateText) {
    throw new Error('Escribe al menos un mensaje (público o privado)');
  }
  return { recipientPersonId: recipientPersonId.trim(), publicText, privateText };
}

/**
 * Agrupa los kudos del muro por semana y, dentro, por persona agradecida.
 * Semanas más recientes primero; personas en orden alfabético (orden NEUTRO:
 * nunca por cantidad — no es una competición) con sus mensajes públicos.
 * @param {{ recipientPersonId: string, recipientName: string, weekKey: string, publicText: string|null }[]} kudos
 * @returns {Map<string, { recipientPersonId: string, recipientName: string, messages: string[] }[]>}
 */
export function groupWallByWeek(kudos) {
  const byWeek = new Map();
  for (const kudo of kudos) {
    const week = byWeek.get(kudo.weekKey) ?? new Map();
    const person = week.get(kudo.recipientPersonId) ?? {
      recipientPersonId: kudo.recipientPersonId,
      recipientName: kudo.recipientName,
      messages: [],
    };
    if (kudo.publicText) person.messages.push(kudo.publicText);
    week.set(kudo.recipientPersonId, person);
    byWeek.set(kudo.weekKey, week);
  }
  // Las claves YYYY-Www ordenan bien lexicográficamente; compare explícito
  // (localeCompare) para dejarlo dicho (S2871).
  const weeks = [...byWeek.keys()].toSorted((a, b) => a.localeCompare(b)).toReversed();
  return new Map(
    weeks.map((weekKey) => [
      weekKey,
      [...byWeek.get(weekKey).values()].toSorted((a, b) =>
        a.recipientName.localeCompare(b.recipientName, 'es'),
      ),
    ]),
  );
}
