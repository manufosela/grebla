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

/** Orden de presentación del mazo, de menor a mayor + las dos especiales. */
export const POKER_DECK = ['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];

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
