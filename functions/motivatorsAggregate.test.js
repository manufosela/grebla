/**
 * Test de EQUIVALENCIA (RMR-TSK-0297): el cálculo de agregados de motivadores
 * vive en dos copias físicas —el dominio del cliente y este módulo de la Cloud
 * Function— porque functions/ se despliega solo y no puede importar de ../src.
 * La copia es inevitable; la DIVERGENCIA no. Aquí se ejecutan AMBAS sobre las
 * mismas sesiones y se exige el mismo resultado, así que si alguien arregla o
 * cambia una sin replicarlo en la otra (lo que pasó en RMR-BUG-0051), este test
 * falla en vez de dejar el agujero abierto en silencio.
 */
import { describe, it, expect } from 'vitest';
import {
  motComputeAggregates, MOTIVATOR_DECK_IDS, MOTIVATOR_DECK_SIZE,
} from './motivatorsAggregate.js';
import { computeAggregates } from '../src/tools/motivators/domain/aggregate.js';
import { deckCardIds } from '../src/tools/motivators/domain/decks.js';
import { DECK_SIZE } from '../src/tools/motivators/domain/types.js';

const GAME = 'moving_motivators';
const CARDS = deckCardIds(GAME);

/** Una sesión con un orden determinista (las cartas rotadas por `offset`). */
const session = (roundId, equipoId, offset) => ({
  game: GAME,
  roundId,
  equipoId,
  usuarioId: `${roundId}-${equipoId}-${offset}`,
  orden: CARDS.map((_, i) => ({
    motivadorId: CARDS[(i + offset) % CARDS.length],
    posicion: i + 1,
  })),
});

/**
 * Corre las dos implementaciones con los MISMOS argumentos y devuelve ambos
 * resultados. El dominio recibe las opciones como objeto; la copia de functions,
 * como posicionales — esa es la única diferencia de firma.
 */
const bothWays = (sessions, { orderedRoundIds = [], minCount, departmentByLeader = {} } = {}) => {
  const domain = computeAggregates(sessions, CARDS, {
    game: GAME, orderedRoundIds, size: DECK_SIZE, minCount, departmentByLeader,
  });
  const fn = motComputeAggregates(
    sessions, CARDS, GAME, orderedRoundIds, MOTIVATOR_DECK_SIZE, minCount, departmentByLeader,
  );
  return { domain, fn };
};

describe('las dos copias de la agregación no divergen', () => {
  it('el universo de cartas y el tamaño de mazo coinciden entre ambas fuentes', () => {
    // Si un mazo cambia en un lado y no en el otro, los rankings se desalinean.
    expect(MOTIVATOR_DECK_IDS[GAME]).toEqual(CARDS);
    expect(MOTIVATOR_DECK_SIZE).toBe(DECK_SIZE);
  });

  it('dan el MISMO resultado en un escenario rico (global, rondas, equipos, evolución)', () => {
    const sessions = [
      session('r1', 'L1', 0), session('r1', 'L1', 1), session('r1', 'L1', 2),
      session('r2', 'L1', 3), session('r2', 'L2', 4), session('r2', 'L2', 5),
      session('r2', 'L2', 6),
    ];
    const { domain, fn } = bothWays(sessions, { orderedRoundIds: ['r1', 'r2'] });
    expect(fn).toEqual(domain);
  });

  it('retienen los MISMOS cortes bajo el umbral (equipo y ronda pequeños)', () => {
    // L1 llega al umbral (3), SOLO no (1); r2 tampoco. Ambas deben ocultar lo mismo.
    const sessions = [
      session('r1', 'L1', 0), session('r1', 'L1', 1), session('r1', 'L1', 2),
      session('r2', 'SOLO', 3),
    ];
    const { domain, fn } = bothWays(sessions);
    expect(fn).toEqual(domain);
    expect(fn.byLeader.SOLO).toBeUndefined();
    expect(fn.byRound.r2).toBeUndefined();
  });

  it('retienen el global igual cuando el total no llega al umbral', () => {
    const sessions = [session('r1', 'L1', 0), session('r1', 'L1', 1)]; // solo 2
    const { domain, fn } = bothWays(sessions);
    expect(fn).toEqual(domain);
    expect(fn.global.ranking.every((s) => s.averagePosition === null)).toBe(true);
  });

  it('agrupan por departamento de forma idéntica, con su umbral', () => {
    const departmentByLeader = { L1: 'head1', L2: 'head1', L3: 'head2' };
    const sessions = [
      session('r1', 'L1', 0), session('r1', 'L2', 1), session('r1', 'L2', 2), // head1: 3
      session('r1', 'L3', 3), // head2: 1 → retenido
    ];
    const { domain, fn } = bothWays(sessions, { departmentByLeader });
    expect(fn).toEqual(domain);
    expect(fn.byDepartment.head1.respondents).toBe(3);
    expect(fn.byDepartment.head2).toBeUndefined();
  });

  it('respetan un umbral a medida idéntico', () => {
    const sessions = [session('r1', 'L1', 0), session('r1', 'L2', 1)];
    const { domain, fn } = bothWays(sessions, { minCount: 1 });
    expect(fn).toEqual(domain);
    expect(fn.byLeader.L1).toBeDefined();
  });
});
