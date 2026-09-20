/**
 * La mesa se ve SIEMPRE (RMR-BUG-0128), aunque todavía no se haya sentado
 * nadie: un sitio vacío y el aviso, en vez de un párrafo que sustituye a la
 * mesa entera. Se mira con el organizador que no vota (entra como observador,
 * así que no ocupa asiento).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión mesa vacía E2E';

async function sesion(tasks) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: false, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'], tasks, currentTaskId: tasks[0].id,
    revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
  });
}

test.afterEach(async () => {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  for (const d of snap.docs) {
    const players = await d.ref.collection('players').get();
    await Promise.all(players.docs.map((p) => p.ref.delete()));
    await d.ref.delete();
  }
});

const mesa = (page) => page.locator('poker-table');

test('tarea general: se ve la mesa con un sitio sin ocupar y el aviso', async ({ page }) => {
  const ref = await sesion([{ id: 't1', title: 'Pago con Bizum', value: null }]);
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);
  await expect(mesa(page).locator('.seats')).toBeVisible();
  await expect(mesa(page).locator('.seat.empty')).toHaveCount(1);
  await expect(mesa(page)).toContainText('Aún no se ha sentado nadie a la mesa.');
});

test('tarea por gremios: cada gremio tiene su grupo con su sitio vacío', async ({ page }) => {
  const ref = await sesion([{ id: 't1', title: 'Pago con Bizum', value: null, guilds: ['Backend PHP', 'QA'] }]);
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);
  for (const g of ['Backend PHP', 'QA']) {
    const grupo = mesa(page).locator(`.guild-group[data-guild="${g}"]`);
    await expect(grupo).toContainText('nadie en la mesa');
    await expect(grupo.locator('.seat.empty')).toHaveCount(1);
  }
});
