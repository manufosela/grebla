import { describe, it, expect } from 'vitest';
import { createMemoryMotivatorsPersistence } from '../infrastructure/memory/index.js';
import {
  createRound, getActiveRound, saveSession, getMyHistory, getAggregates, setRoundActive, listRounds, updateRound, deleteRound,
} from './usecases.js';
import { deckCardIds } from '../domain/decks.js';

const GAME = 'moving_motivators';
const NOW = new Date('2026-07-13T12:00:00Z');
const identity = (usuarioId, equipoId) => ({
  usuarioId, usuarioKind: 'person', uid: `uid-${usuarioId}`, liderId: equipoId, equipoId,
});

/** Orden completo válido: las 10 cartas del mazo en el orden dado (o el del mazo). */
const ordenFrom = (ids) => ids.map((motivadorId, i) => ({ motivadorId, posicion: i + 1 }));

describe('usecases motivadores (memoria)', () => {
  it('crea una ronda y la recupera como activa', async () => {
    const p = createMemoryMotivatorsPersistence();
    const id = await createRound(p, {
      game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z', createdBy: 'admin',
    }, NOW);
    expect(id).toBeTruthy();
    expect((await listRounds(p, GAME))).toHaveLength(1);
    const active = await getActiveRound(p, GAME, NOW);
    expect(active?.id).toBe(id);
  });

  it('createRound rechaza ventana incoherente', async () => {
    const p = createMemoryMotivatorsPersistence();
    await expect(createRound(p, { game: GAME, name: 'x', startAt: '2026-07-15T00:00:00Z', endAt: '2026-07-12T00:00:00Z' }, NOW))
      .rejects.toThrow();
  });

  it('updateRound cambia nombre y fechas; valida la ventana', async () => {
    const p = createMemoryMotivatorsPersistence();
    const id = await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    await updateRound(p, id, { name: 'Julio (corregido)', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-20T00:00:00Z' });
    const round = await p.rounds.get(id);
    expect(round.name).toBe('Julio (corregido)');
    expect(round.endAt).toBe('2026-07-20T00:00:00.000Z');
    await expect(updateRound(p, id, { name: 'x', startAt: '2026-07-20T00:00:00Z', endAt: '2026-07-12T00:00:00Z' })).rejects.toThrow();
  });

  it('guarda la sesión con la ronda abierta y la devuelve en el histórico', async () => {
    const p = createMemoryMotivatorsPersistence();
    const roundId = await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    const round = await getActiveRound(p, GAME, NOW);
    const orden = ordenFrom(deckCardIds(GAME));

    const sid = await saveSession(p, { round, identity: identity('p1', 'L1'), orden }, NOW);
    expect(sid).toBe(`${roundId}__p1`);

    const history = await getMyHistory(p, 'uid-p1', GAME);
    expect(history).toHaveLength(1);
    expect(history[0].orden).toHaveLength(10);
    expect(history[0].equipoId).toBe('L1');
  });

  it('re-finalizar sobrescribe la sesión (id determinista)', async () => {
    const p = createMemoryMotivatorsPersistence();
    await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    const round = await getActiveRound(p, GAME, NOW);
    const ids = deckCardIds(GAME);
    await saveSession(p, { round, identity: identity('p1', 'L1'), orden: ordenFrom(ids) }, NOW);
    await saveSession(p, { round, identity: identity('p1', 'L1'), orden: ordenFrom(ids.toReversed()) }, NOW);
    const history = await getMyHistory(p, 'uid-p1', GAME);
    expect(history).toHaveLength(1); // una sola, sobrescrita
    expect(history[0].orden[0].motivadorId).toBe(ids.at(-1));
  });

  it('no guarda si la ronda está cerrada', async () => {
    const p = createMemoryMotivatorsPersistence();
    const roundId = await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    await setRoundActive(p, roundId, false);
    const round = await p.rounds.get(roundId);
    await expect(saveSession(p, { round, identity: identity('p1', 'L1'), orden: ordenFrom(deckCardIds(GAME)) }, NOW))
      .rejects.toThrow(/no está abierta/);
  });

  it('no guarda con un orden incompleto/no válido', async () => {
    const p = createMemoryMotivatorsPersistence();
    await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    const round = await getActiveRound(p, GAME, NOW);
    await expect(saveSession(p, { round, identity: identity('p1', 'L1'), orden: [{ motivadorId: 'curiosity', posicion: 1 }] }, NOW))
      .rejects.toThrow(/Orden no válido/);
  });

  it('deleteRound borra la ronda y todas sus sesiones', async () => {
    const p = createMemoryMotivatorsPersistence();
    const rid = await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    const round = await getActiveRound(p, GAME, NOW);
    const ids = deckCardIds(GAME);
    await saveSession(p, { round, identity: identity('p1', 'L1'), orden: ordenFrom(ids) }, NOW);
    await saveSession(p, { round, identity: identity('p2', 'L1'), orden: ordenFrom(ids) }, NOW);
    expect(await p.sessions.listByRound(rid)).toHaveLength(2);

    await deleteRound(p, rid);
    expect(await listRounds(p, GAME)).toHaveLength(0);
    expect(await p.sessions.listByRound(rid)).toHaveLength(0);
    expect(await getMyHistory(p, 'uid-p1', GAME)).toHaveLength(0);
  });

  it('los agregados reflejan las sesiones guardadas', async () => {
    const p = createMemoryMotivatorsPersistence();
    await createRound(p, { game: GAME, name: 'Julio', startAt: '2026-07-12T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }, NOW);
    const round = await getActiveRound(p, GAME, NOW);
    const ids = deckCardIds(GAME);
    // Tres jugadores ponen 'curiosity' primero. Son TRES y no dos porque el
    // umbral de anonimato (RMR-BUG-0051) retiene los cortes con menos de 3
    // respuestas, y el adaptador en memoria aplica el mismo criterio que
    // producción: si aquí se vieran datos que allí se ocultan, engañaría.
    await saveSession(p, { round, identity: identity('p1', 'L1'), orden: ordenFrom(ids) }, NOW);
    await saveSession(p, { round, identity: identity('p2', 'L1'), orden: ordenFrom(ids) }, NOW);
    await saveSession(p, { round, identity: identity('p3', 'L1'), orden: ordenFrom(ids) }, NOW);

    const agg = await getAggregates(p, GAME);
    expect(agg.respondents).toBe(3);
    expect(agg.global.byMotivator.curiosity.averagePosition).toBe(1);
    expect(agg.global.ranking[0].motivadorId).toBe('curiosity');
    expect(agg.byLeader.L1.respondents).toBe(3);
  });
});
