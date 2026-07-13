/**
 * Casos de uso de Motivadores. La UI nunca toca el repo directamente: pasa por
 * aquí. Reglas de negocio: solo se guarda una sesión si la ronda está abierta y
 * el orden está completo y es válido para el mazo.
 *
 * @typedef {import('../domain/ports.js').MotivatorsPersistence} MotivatorsPersistence
 * @typedef {import('../domain/types.js').GameId} GameId
 * @typedef {import('../domain/types.js').Round} Round
 * @typedef {import('../domain/types.js').Session} Session
 * @typedef {import('../domain/types.js').PlayerIdentity} PlayerIdentity
 * @typedef {import('../domain/types.js').Placement} Placement
 */
import { GAMES } from '../domain/types.js';
import { deckCardIds } from '../domain/decks.js';
import { isRoundOpen, pickOpenRound } from '../domain/rounds.js';
import { validateOrden } from '../domain/placement.js';

/** @param {GameId} game */
function assertGame(game) {
  if (!GAMES.includes(game)) throw new Error(`Juego desconocido: ${game}`);
}

/** Todas las rondas de un juego. @param {MotivatorsPersistence} p @param {GameId} game @returns {Promise<Round[]>} */
export function listRounds(p, game) {
  assertGame(game);
  return p.rounds.listByGame(game);
}

/**
 * Ronda abierta actual de un juego (o null si ninguna).
 * @param {MotivatorsPersistence} p @param {GameId} game @param {Date} [now]
 * @returns {Promise<Round|null>}
 */
export async function getActiveRound(p, game, now = new Date()) {
  assertGame(game);
  return pickOpenRound(await p.rounds.listByGame(game), now);
}

/**
 * Crea una ronda (superadmin). Valida juego, nombre y ventana coherente.
 * @param {MotivatorsPersistence} p
 * @param {{ game: GameId, name: string, startAt: string, endAt: string, createdBy?: string }} input
 * @param {Date} [now]
 * @returns {Promise<string>}
 */
export async function createRound(p, input, now = new Date()) {
  assertGame(input.game);
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('El nombre de la ronda es obligatorio');
  const start = new Date(input.startAt).getTime();
  const end = new Date(input.endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) throw new Error('Fechas de la ronda no válidas');
  if (end <= start) throw new Error('La fecha de fin debe ser posterior a la de inicio');
  return p.rounds.add({
    game: input.game,
    name,
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
    active: true,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  });
}

/** Activa o cierra una ronda. @param {MotivatorsPersistence} p @param {string} id @param {boolean} active @returns {Promise<void>} */
export function setRoundActive(p, id, active) {
  return p.rounds.update(id, { active: Boolean(active) });
}

/**
 * Guarda (o sobrescribe) la sesión del jugador para una ronda. Falla si la ronda
 * no está abierta o el orden no es completo/válido. Devuelve el id de sesión.
 * @param {MotivatorsPersistence} p
 * @param {{ round: Round, identity: PlayerIdentity, orden: Placement[] }} input
 * @param {Date} [now]
 * @returns {Promise<string>}
 */
export async function saveSession(p, input, now = new Date()) {
  const { round, identity, orden } = input;
  if (!round) throw new Error('No hay ronda para guardar la sesión');
  assertGame(round.game);
  if (!isRoundOpen(round, now)) throw new Error('La ronda no está abierta');
  if (!identity?.usuarioId) throw new Error('Falta la identidad del jugador');

  const check = validateOrden(orden, deckCardIds(round.game));
  if (!check.ok) throw new Error(`Orden no válido: ${check.errors.join(' ')}`);

  /** @type {Session} */
  const session = {
    game: round.game,
    roundId: round.id,
    usuarioId: identity.usuarioId,
    usuarioKind: identity.usuarioKind,
    uid: identity.uid,
    liderId: identity.liderId ?? null,
    equipoId: identity.equipoId ?? null,
    fecha: now.toISOString(),
    orden,
  };
  const sessionId = `${round.id}__${identity.usuarioId}`;
  await p.sessions.save(sessionId, session);
  return sessionId;
}

/**
 * Histórico privado del jugador para un juego (todas sus sesiones). Se filtra por
 * `uid` (la cuenta dueña), que es lo que permiten leer las reglas de Firestore.
 * @param {MotivatorsPersistence} p @param {string} uid @param {GameId} game
 * @returns {Promise<Session[]>}
 */
export function getMyHistory(p, uid, game) {
  assertGame(game);
  return p.sessions.listByUser(uid, game);
}

/** Agregados públicos de un juego. @param {MotivatorsPersistence} p @param {GameId} game @returns {Promise<import('../domain/types.js').Aggregates|null>} */
export function getAggregates(p, game) {
  assertGame(game);
  return p.aggregates.get(game);
}
