/**
 * Lógica pura del tablero: el estado son `slots`, un array de longitud DECK_SIZE
 * donde `slots[i]` es el id de la carta en la posición `i+1` (o null si está
 * vacía). Las cartas no colocadas forman la bandeja. La finalización solo se
 * permite con las 10 posiciones ocupadas por cartas distintas.
 *
 * @typedef {import('./types.js').Placement} Placement
 * @typedef {import('./types.js').MotivatorCard} MotivatorCard
 */
import { DECK_SIZE } from './types.js';

/** Tablero vacío: DECK_SIZE posiciones sin carta. @param {number} [size] @returns {(string|null)[]} */
export function emptySlots(size = DECK_SIZE) {
  return Array.from({ length: size }, () => null);
}

/** Nº de posiciones ocupadas. @param {(string|null)[]} slots @returns {number} */
export function placedCount(slots) {
  return (slots ?? []).filter(Boolean).length;
}

/**
 * ¿Se puede finalizar? Todas las posiciones ocupadas y sin cartas repetidas.
 * @param {(string|null)[]} slots
 * @param {number} [size]
 * @returns {boolean}
 */
export function canFinalize(slots, size = DECK_SIZE) {
  const filled = (slots ?? []).filter(Boolean);
  return filled.length === size && new Set(filled).size === size;
}

/**
 * Coloca `motivadorId` en la posición `index` (0-based). La carta sale de su
 * posición anterior si la tenía; la carta que ocupara `index` vuelve a la bandeja.
 * Devuelve un nuevo array (inmutable).
 * @param {(string|null)[]} slots
 * @param {string} motivadorId
 * @param {number} index
 * @returns {(string|null)[]}
 */
export function placeCard(slots, motivadorId, index) {
  if (index < 0 || index >= slots.length) throw new Error(`Posición fuera de rango: ${index}`);
  const next = slots.map((id) => (id === motivadorId ? null : id));
  next[index] = motivadorId;
  return next;
}

/**
 * Quita una carta del tablero (vuelve a la bandeja). Devuelve un nuevo array.
 * @param {(string|null)[]} slots
 * @param {string} motivadorId
 * @returns {(string|null)[]}
 */
export function removeCard(slots, motivadorId) {
  return slots.map((id) => (id === motivadorId ? null : id));
}

/**
 * Cartas del mazo que aún no están en el tablero (bandeja), en el orden del mazo.
 * @param {MotivatorCard[]} cards
 * @param {(string|null)[]} slots
 * @returns {MotivatorCard[]}
 */
export function trayCards(cards, slots) {
  const placed = new Set((slots ?? []).filter(Boolean));
  return (cards ?? []).filter((c) => !placed.has(c.id));
}

/**
 * Convierte el tablero al orden persistible: [{ motivadorId, posicion }] con
 * posición 1..N. Lanza si el tablero no está completo (no debería llamarse antes).
 * @param {(string|null)[]} slots
 * @returns {Placement[]}
 */
export function slotsToOrden(slots) {
  if (!canFinalize(slots)) throw new Error('El tablero no está completo');
  return slots.map((motivadorId, i) => ({ motivadorId: /** @type {string} */ (motivadorId), posicion: i + 1 }));
}

/**
 * Sanea unos slots (p. ej. un borrador restaurado): fija el tamaño, descarta ids
 * que no estén en el mazo y elimina repeticiones (se queda con la primera). Nunca
 * lanza; ante entrada corrupta devuelve un tablero limpio.
 * @param {unknown} slots
 * @param {string[]} cardIds
 * @param {number} [size]
 * @returns {(string|null)[]}
 */
export function sanitizeSlots(slots, cardIds, size = DECK_SIZE) {
  const allowed = new Set(cardIds ?? []);
  const seen = new Set();
  const out = emptySlots(size);
  const arr = Array.isArray(slots) ? slots : [];
  for (let i = 0; i < size; i += 1) {
    const id = arr[i];
    if (typeof id === 'string' && allowed.has(id) && !seen.has(id)) {
      out[i] = id;
      seen.add(id);
    }
  }
  return out;
}

/**
 * Reconstruye el tablero desde un orden guardado (para releer una sesión previa).
 * @param {Placement[]} orden
 * @param {number} [size]
 * @returns {(string|null)[]}
 */
export function ordenToSlots(orden, size = DECK_SIZE) {
  const slots = emptySlots(size);
  for (const { motivadorId, posicion } of orden ?? []) {
    const index = posicion - 1;
    if (index >= 0 && index < size) slots[index] = motivadorId;
  }
  return slots;
}

/**
 * Valida un orden persistible contra un mazo: 10 posiciones 1..N sin huecos ni
 * repeticiones, y todas las cartas pertenecen al mazo.
 * @param {Placement[]} orden
 * @param {string[]} cardIds
 * @param {number} [size]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOrden(orden, cardIds, size = DECK_SIZE) {
  const errors = [];
  const list = orden ?? [];
  if (list.length !== size) errors.push(`El orden debe tener ${size} cartas (tiene ${list.length}).`);
  const positions = new Set(list.map((p) => p.posicion));
  const expected = new Set(Array.from({ length: size }, (_, i) => i + 1));
  if (positions.size !== list.length) errors.push('Hay posiciones repetidas.');
  for (const p of list) {
    if (!expected.has(p.posicion)) errors.push(`Posición fuera de 1..${size}: ${p.posicion}.`);
  }
  const ids = list.map((p) => p.motivadorId);
  if (new Set(ids).size !== ids.length) errors.push('Hay cartas repetidas.');
  const allowed = new Set(cardIds ?? []);
  for (const id of ids) {
    if (!allowed.has(id)) errors.push(`Carta ajena al mazo: ${id}.`);
  }
  return { ok: errors.length === 0, errors };
}
