/**
 * Votar por complejidad × esfuerzo (RMR-TSK-0516). Dominio puro, sin Firebase.
 *
 * Es el cuadro del taller «Estimar en magnitud» (Tecnología TRIBBU, sep-2026):
 * dos ejes del 1 al 5 y una casilla que da la carta. Complejidad es cuánto hay
 * que pensar y cuánto no sabemos; esfuerzo es cuánto hay que hacer. Se votan
 * por separado porque se responden por separado: lo complejo lo absorbe alguien
 * con criterio, el esfuerzo alto no lo absorbe nadie.
 *
 * El cuadro es una ESCALERA: la casilla (c, e) vale la carta en la posición
 * c + e − 2 de la escala. Para Fibonacci reproduce el cuadro del taller tal
 * cual (1·2·3·5·8·13·21 por la diagonal) y las tres casillas grandes son
 * «partir»: la subtarea es demasiado grande para estimarla, y lo que toca es
 * partirla, no ponerle una cifra mayor. El 21 llega antes por la diagonal que
 * por los lados: lo que dispara el número es que suban las dos cosas a la vez.
 */
import { scaleById, deckOf, SPLIT_CARD } from './deck.js';

/** Niveles de cada eje, con la descripción del taller para elegir con criterio. */
export const COMPLEXITY_LEVELS = Object.freeze([
  Object.freeze({ level: 1, text: 'Sé exactamente cómo se hace.', example: 'cambiar una bombilla' }),
  Object.freeze({ level: 2, text: 'Lo he hecho antes, hay que prestar atención.', example: 'montar una estantería con instrucciones' }),
  Object.freeze({ level: 3, text: 'Hay que pensarlo y decidir cómo.', example: 'amueblar un salón vacío' }),
  Object.freeze({ level: 4, text: 'Hay partes que todavía no sé resolver.', example: 'encontrar de dónde viene una gotera' }),
  Object.freeze({ level: 5, text: 'No sé por dónde empezar.', example: 'abrir el motor del coche sin haberlo hecho nunca' }),
]);

export const EFFORT_LEVELS = Object.freeze([
  Object.freeze({ level: 1, text: 'Un gesto. Una sola cosa.', example: 'cambiar una bombilla' }),
  Object.freeze({ level: 2, text: 'Una pieza, de una sentada.', example: 'montar una estantería' }),
  Object.freeze({ level: 3, text: 'Varias piezas o lo mismo repetido varias veces.', example: 'montar la cocina entera' }),
  Object.freeze({ level: 4, text: 'Mucho volumen y mucho recorrido.', example: 'pintar la casa entera' }),
  Object.freeze({ level: 5, text: 'Volumen enorme, con logística propia.', example: 'una mudanza completa' }),
]);

/** ¿Es un nivel válido de un eje? Ninguno de los dos puede ser cero: lo más pequeño que existe es un 1. */
export function isAxisLevel(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Carta que dan los dos ejes en una escala: la posición c + e − 2 de sus
 * cartas, o SPLIT_CARD si se sale de la escalera (demasiado grande: se parte).
 *
 * @param {string} scaleId
 * @param {number} complexity 1..5
 * @param {number} effort 1..5
 * @returns {string|null} carta, SPLIT_CARD, o null si falta algún eje
 */
export function magnitudeCard(scaleId, complexity, effort) {
  if (!isAxisLevel(complexity) || !isAxisLevel(effort)) return null;
  const cards = scaleById(scaleId).cards;
  return cards[complexity + effort - 2] ?? SPLIT_CARD;
}

/**
 * ¿Puede ESTA sesión votar por ejes? Solo si su mazo contiene la escalera
 * entera de su escala y la carta «partir»: una sesión convocada con otro mazo
 * (las anteriores a RMR-TSK-0515) no puede aceptar un 21 que no tiene, y antes
 * que emitir una carta inválida se esconde la pestaña.
 *
 * @param {{ scale?: string, deck?: ReadonlyArray<string>|null }|null|undefined} session
 * @returns {boolean}
 */
export function axesAvailable(session) {
  const deck = deckOf(session);
  const cards = scaleById(session?.scale).cards;
  return cards.every((c) => deck.includes(c)) && deck.includes(SPLIT_CARD);
}
