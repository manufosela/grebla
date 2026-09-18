/**
 * Poker por gremios · F2 (RMR-PCS-0043): el asiento lleva los gremios de la
 * ficha; en una tarea con gremios solo votan los suyos, el organizador asigna
 * gremio a quien no lo tiene, y con varios válidos se elige uno.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión asiento gremio E2E';
const GREMIOS = { 'e2e-ga-qa': 'QA', 'e2e-ga-php': 'Backend PHP', 'e2e-ga-ios': 'iOS' };
const ING = 'people/e2e-person-eng';

async function sesion(guilds) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [{ id: 't1', title: 'BB-1 - Pago con Bizum', value: null, guilds }],
    currentTaskId: 't1', revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
  });
}

test.beforeEach(async () => {
  for (const [id, name] of Object.entries(GREMIOS)) await db().doc(`guilds/${id}`).set({ name });
});

test.afterEach(async () => {
  for (const id of Object.keys(GREMIOS)) await db().doc(`guilds/${id}`).delete();
  await db().doc(ING).update({ guilds: FieldValue.delete() });
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

test('quien no es del gremio mira; el organizador le asigna gremio y entonces vota, y el voto lleva el gremio', async ({ page, browser }) => {
  await db().doc(ING).update({ guilds: ['iOS'] });
  const ref = await sesion(['Backend PHP', 'QA']);

  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);
  await expect(mesa(page)).toContainText('Esta tarea es de otro gremio (Backend PHP, QA)');
  await expect(mesa(page).getByRole('button', { name: '5', exact: true })).toHaveCount(0);
  // El asiento guarda los gremios de la ficha.
  await expect.poll(async () => (await ref.collection('players').doc('e2e-engineer').get()).data()?.guilds).toEqual(['iOS']);

  const ctx = await browser.newContext();
  const org = await ctx.newPage();
  await signInAs(org, 'head');
  await org.goto(`/poker?s=${ref.id}`);
  await mesa(org).getByRole('combobox', { name: 'Gremio para Ingeniero E2E' }).selectOption('Backend PHP');
  await expect.poll(async () => (await ref.collection('players').doc('e2e-engineer').get()).data()?.guilds).toEqual(['iOS', 'Backend PHP']);

  // Ya es del gremio: le sale el mazo y su carta lleva el gremio.
  await mesa(page).getByRole('tab', { name: /carta/i }).click();
  await mesa(page).getByRole('button', { name: '5', exact: true }).click();
  await expect.poll(async () => (await ref.collection('votes').doc('e2e-engineer').get()).data()?.guild).toBe('Backend PHP');
  await expect(mesa(org).locator('.seat', { hasText: 'Ingeniero E2E' })).toContainText('Backend PHP');
  await ctx.close();
});

test('con dos gremios válidos para la tarea se elige con cuál se vota', async ({ page }) => {
  await db().doc(ING).update({ guilds: ['Backend PHP', 'QA'] });
  const ref = await sesion(['Backend PHP', 'QA']);

  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);
  const grupo = mesa(page).getByRole('radiogroup', { name: 'Votas como' });
  await expect(grupo).toBeVisible();
  await mesa(page).getByRole('tab', { name: /carta/i }).click();
  await mesa(page).getByRole('button', { name: '5', exact: true }).click();
  await expect(mesa(page)).toContainText('Elige con qué gremio votas.');
  await grupo.getByRole('radio', { name: 'QA' }).check();
  await mesa(page).getByRole('button', { name: '5', exact: true }).click();
  await expect.poll(async () => (await ref.collection('votes').doc('e2e-engineer').get()).data()?.guild).toBe('QA');
});
