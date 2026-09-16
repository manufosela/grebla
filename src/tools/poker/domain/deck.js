/**
 * Mazo de Scrum Poker (RMR-TSK-0317). Dominio puro (sin Firebase): define las
 * cartas y las utilidades para distinguir las numéricas (que entran en el
 * resumen) de las especiales (`?` no sé, `☕` pausa), que se cuentan pero no
 * promedian.
 *
 * Escala Fibonacci «de planning poker»: 0,1,2,3,5,8,13,20,40,100. El salto
 * creciente obliga a decidir el orden de magnitud en vez de discutir un ±1 que
 * no cambia nada.
 */

/**
 * Mazo de las sesiones convocadas ANTES de guardar el mazo en la sesión
 * (RMR-TSK-0481). Se conserva tal cual para no invalidar sus votos: las
 * sesiones nuevas usan los mazos fijos de POKER_SCALES.
 */
export const POKER_DECK = ['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];

/**
 * Cartas que se votan pero NO se promedian: «no sé» y «pausa» no son una
 * cantidad. Van al final de cualquier escala.
 */
export const SPECIAL_CARDS = Object.freeze(['?', '☕']);

/**
 * Escalas disponibles al convocar (RMR-TSK-0481). No todos los equipos estiman
 * en números: quien estima por tallas compara tamaños sin fingir precisión, y
 * ahí una media entre S y XL no significa nada — por eso el resumen solo
 * promedia lo numérico, y eso vale para las dos escalas por igual.
 *
 * Los mazos son FIJOS (RMR-TSK-0515): todo el equipo estima con las mismas
 * cartas. Fibonacci va del 1 al 21 —sin 0, porque si algo existe cuesta algo, y
 * sin 40 ni 100, porque eso no se estima: se parte—. Es la escalera del taller
 * «Estimar en magnitud».
 */
export const POKER_SCALES = Object.freeze([
  Object.freeze({
    id: 'fibonacci',
    label: 'Fibonacci',
    hint: 'El salto creciente obliga a decidir el orden de magnitud.',
    cards: Object.freeze(['1', '2', '3', '5', '8', '13', '21']),
  }),
  Object.freeze({
    id: 'tallas',
    label: 'Tallas de camiseta',
    hint: 'Comparar tamaños sin fingir precisión.',
    cards: Object.freeze(['XS', 'S', 'M', 'L', 'XL']),
  }),
]);

/** Escala por su id, o la primera (Fibonacci) si no se reconoce. */
export function scaleById(id) {
  return POKER_SCALES.find((s) => s.id === id) ?? POKER_SCALES[0];
}

/**
 * Mazo de UNA sesión: el que se guardó al convocarla y, si no lo lleva, el
 * Fibonacci de siempre.
 *
 * La reserva no es cortesía: las sesiones creadas antes de esto no tienen mazo
 * guardado y están en curso. Cambiarles las cartas a mitad de una estimación
 * invalidaría los votos ya emitidos.
 *
 * @param {{ deck?: ReadonlyArray<string>|null }|null|undefined} session
 * @returns {ReadonlyArray<string>}
 */
export function deckOf(session) {
  const guardado = session?.deck;
  if (!Array.isArray(guardado) || guardado.length === 0) return POKER_DECK;
  return guardado;
}

/**
 * Mazo completo de una escala: sus cartas más las especiales. Se guarda en la
 * sesión al convocarla, para que las cartas no cambien a mitad de estimación
 * aunque la escala cambie después.
 *
 * @param {string} scaleId
 * @returns {string[]}
 */
export function buildDeck(scaleId) {
  return [...scaleById(scaleId).cards, ...SPECIAL_CARDS];
}

/**
 * ¿Vale esta carta EN ESTA SESIÓN? Sustituye a mirar la constante global: una
 * sesión de tallas no puede aceptar un 13 solo porque exista en el otro mazo.
 * @param {{ deck?: ReadonlyArray<string>|null }|null|undefined} session
 * @param {string} card
 * @returns {boolean}
 */
export function isValidCardFor(session, card) {
  return deckOf(session).includes(card);
}

/** ¿Es una carta con valor numérico (entra en min/max/media)? */
export function isNumericCard(card) {
  return /^\d+$/.test(String(card ?? ''));
}

/** Valor numérico de una carta, o null si es especial (`?`/`☕`) o inválida. */
export function cardNumber(card) {
  return isNumericCard(card) ? Number(card) : null;
}

/** ¿Pertenece la carta al mazo? Valida el voto antes de escribirlo. */
export function isValidCard(card) {
  return POKER_DECK.includes(card);
}
