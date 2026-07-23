/**
 * E2E de MOTIVADORES (RMR-TSK-0301): verifica de punta a punta el umbral de
 * anonimato (RMR-BUG-0051) y el corte por departamento (RMR-TSK-0296) — la
 * lógica que vive en la Cloud Function onMotivatorSessionWritten.
 *
 * Jugar una partida es drag&drop de 10 cartas, frágil de automatizar y ajeno al
 * valor real, que está en el AGREGADO. Así que se siembran sesiones con el Admin
 * SDK (lo que dispara la Cloud Function igual que una partida) y se verifica el
 * documento /motivatorAggregates/{game} resultante.
 *
 * Necesita el emulador de Functions (npm run e2e lo incluye).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect } from './fixtures.js';
import { deckCardIds } from '../src/tools/motivators/domain/decks.js';

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Siembra una sesión (dispara la Cloud Function). equipoId = leaderUid. */
async function seedSession(db, game, roundId, equipoId, i) {
  const cards = deckCardIds(game);
  const usuarioId = `${equipoId}-u${i}`;
  await db.doc(`motivatorSessions/${roundId}__${usuarioId}`).set({
    game, roundId, usuarioId, usuarioKind: 'leader', uid: usuarioId,
    liderId: equipoId, equipoId, fecha: new Date().toISOString(),
    orden: cards.map((_, k) => ({ motivadorId: cards[(k + i) % cards.length], posicion: k + 1 })),
  });
}

const aggOf = (db, game) => db.doc(`motivatorAggregates/${game}`).get().then((s) => s.data());

/**
 * Deja el juego en estado limpio ANTES de sembrar: borra el doc de agregado y
 * las sesiones sembradas. El agregado se guarda por `game`, así que sin este
 * reset un reintento (retries en CI) o una corrida previa dejaría respondientes
 * viejos y el test miraría datos que no sembró. La primera sesión lo recrea.
 */
async function resetGame(db, game, sessionIds) {
  await db.doc(`motivatorAggregates/${game}`).delete();
  await Promise.all(sessionIds.map((id) => db.doc(`motivatorSessions/${id}`).delete()));
}

test.describe('Motivadores: umbral de anonimato (RMR-BUG-0051)', () => {
  const GAME = 'moving_motivators';
  const ROUND = 'e2e-mot-threshold';
  const SESSIONS = [1, 2, 3].map((i) => `${ROUND}__e2e-team-u${i}`);

  test.beforeAll(async () => { await resetGame(admin(), GAME, SESSIONS); });
  test.afterAll(async () => { await resetGame(admin(), GAME, SESSIONS); });

  test('el global se retiene con 2 y se publica al llegar a 3', async () => {
    const db = admin();

    // Dos sesiones: por debajo del umbral, el ranking global no se publica.
    await seedSession(db, GAME, ROUND, 'e2e-team', 1);
    await seedSession(db, GAME, ROUND, 'e2e-team', 2);
    await expect.poll(async () => (await aggOf(db, GAME))?.respondents ?? 0, { timeout: 20_000 }).toBe(2);
    let agg = await aggOf(db, GAME);
    expect(agg.global.ranking.every((s) => s.averagePosition === null)).toBe(true);

    // La tercera cruza el umbral: ahora el global se publica.
    await seedSession(db, GAME, ROUND, 'e2e-team', 3);
    await expect.poll(async () => (await aggOf(db, GAME))?.respondents ?? 0, { timeout: 20_000 }).toBe(3);
    agg = await aggOf(db, GAME);
    expect(agg.global.ranking.some((s) => typeof s.averagePosition === 'number')).toBe(true);
  });
});

test.describe('Motivadores: corte por departamento (RMR-TSK-0296)', () => {
  const GAME = 'affective_motivators';
  const ROUND = 'e2e-mot-dept';
  // Dos Heads con el MISMO nombre visible: sus ramas no deben fundirse.
  const HEAD_A = 'e2e-dept-headA';
  const HEAD_B = 'e2e-dept-headB';
  const HEAD_SMALL = 'e2e-dept-headSmall';

  const DEPT_SESSIONS = [
    ...[1, 2, 3].map((i) => `${ROUND}__${HEAD_A}-u${i}`),
    ...[1, 2, 3].map((i) => `${ROUND}__${HEAD_B}-u${i}`),
    ...[1, 2].map((i) => `${ROUND}__${HEAD_SMALL}-u${i}`),
  ];

  test.beforeAll(async () => {
    const db = admin();
    await resetGame(db, GAME, DEPT_SESSIONS); // arrancar limpio (idempotente ante retries)
    for (const uid of [HEAD_A, HEAD_B, HEAD_SMALL]) {
      await db.doc(`supermanagers/${uid}`).set({ displayName: 'Depto Homónimo', email: `${uid}@e2e.test` });
      await db.doc(`leaders/${uid}`).set({ displayName: 'Depto Homónimo', email: `${uid}@e2e.test`, reportsTo: null });
    }
    // Cada Head juega con su propio equipo (equipoId = su uid). A y B llegan a 3;
    // el pequeño se queda en 2 (no debe publicarse su departamento).
    for (let i = 1; i <= 3; i += 1) await seedSession(db, GAME, ROUND, HEAD_A, i);
    for (let i = 1; i <= 3; i += 1) await seedSession(db, GAME, ROUND, HEAD_B, i);
    for (let i = 1; i <= 2; i += 1) await seedSession(db, GAME, ROUND, HEAD_SMALL, i);
  });

  test.afterAll(async () => {
    const db = admin();
    await resetGame(db, GAME, DEPT_SESSIONS);
    for (const head of [HEAD_A, HEAD_B, HEAD_SMALL]) {
      await db.doc(`supermanagers/${head}`).delete();
      await db.doc(`leaders/${head}`).delete();
    }
  });

  test('cada Head es su departamento; homónimos no se funden; el pequeño no se publica', async () => {
    const db = admin();

    await expect.poll(async () => {
      const d = await aggOf(db, GAME);
      return Object.keys(d?.byDepartment ?? {}).length;
    }, { timeout: 25_000 }).toBe(2);

    const agg = await aggOf(db, GAME);
    // Se agrupa por UID del Head, no por nombre: A y B son claves distintas.
    expect(agg.byDepartment[HEAD_A]).toBeDefined();
    expect(agg.byDepartment[HEAD_B]).toBeDefined();
    // El nombre (homónimo) viaja aparte, solo para mostrar.
    expect(agg.departmentNames[HEAD_A]).toBe('Depto Homónimo');
    expect(agg.departmentNames[HEAD_B]).toBe('Depto Homónimo');
    // El departamento con solo 2 sesiones no aparece.
    expect(agg.byDepartment[HEAD_SMALL]).toBeUndefined();
  });
});
