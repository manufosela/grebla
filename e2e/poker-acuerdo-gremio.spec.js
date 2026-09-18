/**
 * Poker por gremios · F3 (RMR-PCS-0043): el acuerdo se juzga gremio a gremio;
 * «Volver a votar» fija los que coinciden y solo repiten los demás; al cerrar,
 * la tarea guarda el valor de cada gremio.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión acuerdo por gremio E2E';
const GREMIOS = { 'e2e-ag-qa': 'QA', 'e2e-ag-php': 'Backend PHP' };
const ING = 'people/e2e-person-eng';
const HEAD = 'people/e2e-person-head-poker';

test.beforeEach(async () => {
  for (const [id, name] of Object.entries(GREMIOS)) await db().doc(`guilds/${id}`).set({ name });
  await db().doc(ING).update({ guilds: ['Backend PHP'] });
  await db().doc(HEAD).set({ name: 'Head E2E', uid: 'e2e-head', ownerLeaderUid: 'e2e-head', self: true, active: true, guilds: ['QA'] });
});

test.afterEach(async () => {
  for (const id of Object.keys(GREMIOS)) await db().doc(`guilds/${id}`).delete();
  await db().doc(ING).update({ guilds: FieldValue.delete() });
  await db().doc(HEAD).delete();
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
const votar = async (page, carta) => {
  await mesa(page).getByRole('tab', { name: /carta/i }).click();
  await mesa(page).getByRole('button', { name: carta, exact: true }).click();
};

test('acuerdo por gremio: QA coincide y se fija, backend repite, y la tarea cierra con el valor de cada gremio', async ({ page, browser }) => {
  const ref = await db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [{ id: 't1', title: 'BB-1 - Pago con Bizum', value: null, guilds: ['Backend PHP', 'QA'] }],
    currentTaskId: 't1', revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
  });
  // Un tercer asiento de backend, sembrado, que vota 3 (la ingeniera votará 5: sin acuerdo en backend).
  await ref.collection('players').doc('e2e-bea').set({ name: 'Bea', guilds: ['Backend PHP'], votedRound: 1 });
  await ref.collection('votes').doc('e2e-bea').set({ value: '3', round: 1, guild: 'Backend PHP' });

  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);
  await votar(page, '5');

  const ctx = await browser.newContext();
  const org = await ctx.newPage();
  await signInAs(org, 'head');
  await org.goto(`/poker?s=${ref.id}`);
  await votar(org, '8');
  await mesa(org).getByRole('button', { name: 'Mostrar votos' }).click();

  // Cartas agrupadas por gremio: QA en acuerdo, backend 3 – 5.
  await expect(mesa(org).locator('.guild-group[data-guild="QA"]')).toContainText('acuerdo 8');
  await expect(mesa(org).locator('.guild-group[data-guild="Backend PHP"]')).toContainText('3 – 5');
  await expect(mesa(org)).toContainText('Sin acuerdo en Backend PHP');
  await mesa(org).getByRole('button', { name: 'Volver a votar (solo Backend PHP)' }).click();
  await expect.poll(async () => (await ref.get()).data().lockedGuilds).toEqual({ QA: '8' });

  // QA ya no vota; backend repite y ahora coincide.
  await expect(mesa(org)).toContainText('Tu gremio ya tiene acuerdo (QA: 8)');
  await expect(mesa(org).locator('.guild-group.locked')).toContainText('QA');
  await ref.collection('players').doc('e2e-bea').set({ votedRound: 2 }, { merge: true });
  await ref.collection('votes').doc('e2e-bea').set({ value: '3', round: 2, guild: 'Backend PHP' });
  await votar(page, '3');
  await mesa(org).getByRole('button', { name: 'Mostrar votos' }).click();
  await expect(mesa(org)).toContainText('¡Acuerdo en todos los gremios!');
  await mesa(org).getByRole('button', { name: /Nueva votación/ }).click();

  await expect.poll(async () => {
    const d = (await ref.get()).data();
    return [d.tasks[0].value, d.tasks[0].values, d.lockedGuilds, d.agreements?.[0]?.values];
  }).toEqual(['8', { 'Backend PHP': '3', QA: '8' }, {}, { 'Backend PHP': '3', QA: '8' }]);
  await mesa(org).getByRole('tab', { name: 'Tareas' }).click();
  await expect(mesa(org).locator('.results')).toContainText('Backend PHP 3');
  await ctx.close();
});
