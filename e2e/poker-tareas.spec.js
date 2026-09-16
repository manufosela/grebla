/**
 * El organizador manda (RMR-TSK-0522): decide si vota, deja la lista de tareas
 * al convocar, cierra cada acuerdo con «Nueva votación» (el valor queda en la
 * tarea y se pasa a la siguiente), añade tareas en vivo y termina la sesión,
 * que se queda en la lista de tareas con su valor. Que solo él pueda revelar lo
 * fijan las reglas (scripts/validate-poker-rules.mjs).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión con tareas E2E';
const MAZO = ['1', '2', '3', '5', '8', '13', 'partir'];

async function sesion(extra = {}) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci', deck: MAZO,
    tasks: [], currentTaskId: null, revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
    ...extra,
  });
}

async function conVotos(ref, valores) {
  let i = 0;
  for (const value of valores) {
    const uid = `e2e-tarea-${i}`;
    await ref.collection('players').doc(uid).set({ name: `Votante ${i}`, votedRound: 1 });
    await ref.collection('votes').doc(uid).set({ value, round: 1 });
    i += 1;
  }
}

test.afterEach(async () => {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  for (const d of snap.docs) {
    for (const sub of ['players', 'votes']) {
      const hijos = await d.ref.collection(sub).get();
      await Promise.all(hijos.docs.map((h) => h.ref.delete()));
    }
    await d.ref.delete();
  }
});

const mesa = (page) => page.locator('poker-table');

test('al convocar, el organizador dice si vota y deja las tareas; la primera es la actual', async ({ page }) => {
  await signInAs(page, 'head');
  await page.goto('/poker');
  await page.getByRole('tab', { name: 'Convocar' }).click();
  await page.getByPlaceholder(/Nombre de la sesión/).fill(NOMBRE);
  await page.getByRole('checkbox', { name: 'Yo también voto' }).uncheck();
  await page.getByRole('textbox', { name: /Tareas a estimar/ }).fill('BB-1231 - Nuevo onboarding\n\nBB-1240 - Exportar informe\n');
  await page.getByRole('button', { name: 'Crear sesión' }).click();

  await expect.poll(async () => {
    const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data() ?? null;
  }, { timeout: 15_000 }).toMatchObject({ ownerVotes: false });
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  const s = snap.docs[0].data();
  expect(s.tasks.map((t) => t.title)).toEqual(['BB-1231 - Nuevo onboarding', 'BB-1240 - Exportar informe']);
  expect(s.currentTaskId).toBe(s.tasks[0].id);

  // La mesa se abre sola: la tarea actual es el título, y él entra como observador.
  await expect(mesa(page).getByText('Estimando:')).toContainText('BB-1231 - Nuevo onboarding');
  await expect(mesa(page).getByText('Estás como observador')).toBeVisible();
  const yo = await snap.docs[0].ref.collection('players').doc('e2e-head').get();
  expect(yo.data().spectator).toBe(true);
});

test('con acuerdo, «Nueva votación» guarda el valor en la tarea y pasa a la siguiente', async ({ page }) => {
  const tasks = [{ id: 'a', title: 'Tarea A', value: null }, { id: 'b', title: 'Tarea B', value: null }];
  const ref = await sesion({ tasks, currentTaskId: 'a', revealed: true });
  await conVotos(ref, ['5', '5']);
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(mesa(page).getByText('Todas las cartas dicen 5')).toBeVisible();
  await mesa(page).getByRole('button', { name: /Nueva votación/ }).click();

  await expect.poll(async () => (await ref.get()).data(), { timeout: 15_000 })
    .toMatchObject({ currentTaskId: 'b', revealed: false, round: 2 });
  expect((await ref.get()).data().tasks).toEqual([{ id: 'a', title: 'Tarea A', value: '5' }, tasks[1]]);
  await expect(mesa(page).getByText('Estimando:')).toContainText('Tarea B');
});

test('sin tareas pendientes el organizador añade otra o termina, y la sesión queda en su lista', async ({ page }) => {
  const ref = await sesion({ tasks: [{ id: 'a', title: 'Tarea A', value: '8' }], currentTaskId: null });
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(mesa(page).getByText('No queda ninguna tarea por estimar.')).toBeVisible();
  await mesa(page).getByPlaceholder('Añadir otra tarea…').fill('Tarea C');
  await mesa(page).getByRole('button', { name: 'Añadir tarea' }).click();
  await expect.poll(async () => (await ref.get()).data().tasks.length, { timeout: 15_000 }).toBe(2);
  await expect(mesa(page).getByText('Estimando:')).toContainText('Tarea C');

  // Se acaba aquí: se guarda lo estimado y ya no se vota.
  await ref.update({ currentTaskId: null });
  await mesa(page).getByRole('button', { name: 'Terminar sesión' }).click();
  await expect.poll(async () => (await ref.get()).data().status, { timeout: 15_000 }).toBe('finished');
  const resultados = mesa(page).locator('.results li');
  await expect(resultados).toHaveCount(2);
  await expect(resultados.first()).toContainText('8');
  await expect(resultados.first()).toContainText('Tarea A');
  await expect(mesa(page).getByRole('button', { name: /Mostrar votos|Nueva votación/ })).toHaveCount(0);
});
