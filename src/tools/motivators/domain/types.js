/**
 * Tipos del dominio Motivadores: dos juegos de cartas de auto-reflexión que
 * comparten motor (Moving Motivators tipo Champfrogs y Affective Motivators de
 * GREBLA). JSDoc puro, sin Firebase. El jugador ordena 10 cartas por posición
 * (1-10) dentro de una ronda; los resultados individuales son privados y los
 * agregados públicos (siempre de equipo, nunca para evaluar a una persona).
 *
 * @typedef {'moving_motivators'|'affective_motivators'} GameId
 *
 * @typedef {Object} MotivatorCard   Una carta del mazo.
 * @property {string} id             Slug estable (no cambia aunque cambie el texto).
 * @property {string} name           Nombre visible.
 * @property {string} description     Qué representa la carta (se consulta en cualquier momento).
 *
 * @typedef {Object} Deck            Mazo config-driven de un juego.
 * @property {GameId} game
 * @property {string} name           Nombre de marca del juego.
 * @property {string} tagline        Copy corto bajo el título.
 * @property {'teal'|'coral'} accent  Acento visual (branding por juego).
 * @property {MotivatorCard[]} cards  Exactamente 10 cartas.
 *
 * @typedef {Object} Round           Ronda periódica: ventana temporal para agrupar y comparar.
 * @property {string} id
 * @property {GameId} game
 * @property {string} name
 * @property {string} startAt        ISO inicio de la ventana.
 * @property {string} endAt          ISO fin de la ventana.
 * @property {boolean} active
 * @property {string} [createdBy]    uid del superadmin que la creó.
 * @property {string} [createdAt]    ISO de creación.
 *
 * @typedef {'person'|'leader'} PlayerKind
 *
 * @typedef {Object} PlayerIdentity  Identidad del jugador (ingeniero o líder).
 * @property {string} usuarioId      personId (ingeniero) o uid (líder).
 * @property {PlayerKind} usuarioKind
 * @property {string} uid            uid de la cuenta que juega (dueño de la sesión).
 * @property {string|null} liderId   Líder de referencia (ownerLeaderUid o su propio uid).
 * @property {string|null} equipoId  Equipo = líder (mismo valor que liderId en este modelo).
 *
 * @typedef {Object} Placement       Colocación de una carta en el orden final.
 * @property {string} motivadorId
 * @property {number} posicion       1..10.
 *
 * @typedef {Object} Session         Sesión guardada al finalizar (privada del jugador).
 * @property {string} game
 * @property {string} roundId
 * @property {string} usuarioId
 * @property {PlayerKind} usuarioKind
 * @property {string} uid
 * @property {string|null} liderId
 * @property {string|null} equipoId
 * @property {string} fecha          ISO del guardado.
 * @property {Placement[]} orden     10 colocaciones (posición 1..10 sin huecos ni repeticiones).
 *
 * @typedef {Object} MotivatorStat   Estadística agregada de un motivador.
 * @property {string} motivadorId
 * @property {number|null} averagePosition   Posición media (1 = más importante).
 * @property {number|null} medianPosition
 * @property {number} top3Count       Veces colocado en posiciones 1-3.
 * @property {number|null} top3Pct     % de respondientes que lo pusieron en top-3.
 * @property {number[]} distribution   Conteo por posición, índice 0 = posición 1 … índice 9 = posición 10.
 * @property {number} respondents      Nº de sesiones que incluyeron este motivador.
 *
 * @typedef {Object} AggregateBlock  Un corte agregado (global, de una ronda o de un equipo).
 * @property {number} respondents
 * @property {Record<string, MotivatorStat>} byMotivator
 * @property {MotivatorStat[]} ranking   Motivadores ordenados por posición media ascendente.
 *
 * @typedef {Object} Aggregates      Documento público de agregados de un juego.
 * @property {GameId} game
 * @property {number} respondents
 * @property {AggregateBlock} global
 * @property {Record<string, AggregateBlock>} byRound     roundId → corte.
 * @property {Record<string, AggregateBlock>} byLeader    equipoId → corte.
 * @property {Record<string, Array<{ roundId: string, averagePosition: number|null }>>} evolution
 *   motivadorId → serie de posición media por ronda (ordenada temporalmente).
 * @property {string} [updatedAt]    ISO del último recálculo (lo escribe la Cloud Function).
 */

export const GAMES = /** @type {GameId[]} */ (['moving_motivators', 'affective_motivators']);

/** Tamaño del mazo (posiciones 1..DECK_SIZE). */
export const DECK_SIZE = 10;
