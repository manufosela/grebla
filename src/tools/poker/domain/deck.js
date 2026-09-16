/**
 * Mazo de Scrum Poker (RMR-TSK-0317). Dominio puro (sin Firebase): define las
 * cartas y las utilidades para distinguir las numéricas de las que no son una
 * cantidad («partir», y «?»/«☕» en sesiones antiguas).
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
 * «Partir» (RMR-TSK-0516): la subtarea es demasiado grande para estimarla, y
 * lo que toca es partirla, no ponerle una cifra mayor. Es lo que dicen las
 * casillas en blanco del cuadro complejidad × esfuerzo, y se vota como carta
 * para que quien llega ahí pueda decirlo.
 */
export const SPLIT_CARD = 'partir';

/**
 * Cartas que se añaden a toda escala (RMR-TSK-0521): solo «partir». «?» y «☕»
 * se retiraron del mazo: quien no lo tiene claro pregunta antes de votar, y
 * la pausa se pide en voz alta. Las sesiones antiguas las conservan en su mazo
 * guardado, y por eso siguen reconociéndose como cartas que no dicen nada.
 */
export const SPECIAL_CARDS = Object.freeze([SPLIT_CARD]);

/** Cartas de sesiones antiguas que no dicen nada: coincidir en ellas no es acuerdo. */
export const UNDECIDED_CARDS = Object.freeze(['?', '☕']);

/** Cómo se pinta una carta en la mesa: «partir» va con tijeras para caber en la carta. */
export function cardLabel(card) {
  return card === SPLIT_CARD ? '✂' : card;
}

/**
 * Escalas disponibles al convocar (RMR-TSK-0481). No todos los equipos estiman
 * en números: quien estima por tallas compara tamaños sin fingir precisión, y
 * ahí una media entre S y XL no significa nada — por eso el resumen solo
 * promedia lo numérico, y eso vale para las dos escalas por igual.
 *
 * Los mazos son FIJOS (RMR-TSK-0515): todo el equipo estima con las mismas
 * cartas. Fibonacci va del 1 al 13 —sin 0, porque si algo existe cuesta algo—
 * y lo que en el taller «Estimar en magnitud» era el 21 aquí es «partir»
 * (RMR-TSK-0521): eso no se estima, se parte.
 */
export const POKER_SCALES = Object.freeze([
  Object.freeze({
    id: 'fibonacci',
    label: 'Fibonacci',
    hint: 'El salto creciente obliga a decidir el orden de magnitud.',
    cards: Object.freeze(['1', '2', '3', '5', '8', '13']),
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
