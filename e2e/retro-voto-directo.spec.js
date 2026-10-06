/**
 * Retros: con la zona revelada, una tarjeta se vota de un clic en su «me
 * gusta», sin abrirla (RMR-TSK-0641). Votar otra vez retira el voto.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

const RETRO = 'e2e-retro-voto';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test.beforeEach(async () => {
  await db().doc(`retros/${RETRO}`).set({
    name: 'Retro de votar', format: 'ssc', ownerLeaderUid: 'e2e-manager',
    memberUids: ['e2e-manager', 'e2e-engineer'], branchUids: [], joinToken: 'x', status: 'open',
    revealed: { start: true }, scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });
  await db().doc(`retros/${RETRO}/notes/n1`).set({
    columnId: 'start', text: 'Hacer pairing los jueves', authorUid: 'e2e-manager', authorName: 'Manager E2E',
    voters: [], groupId: null, createdAt: new Date(),
  });
});

test.afterEach(async () => {
  await db().doc(`retros/${RETRO}/notes/n1`).delete().catch(() => {});
  await db().doc(`retros/${RETRO}`).delete().catch(() => {});
});

test('se vota y se retira el voto desde la tarjeta, sin abrirla', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await page.getByRole('row', { name: /Retro de votar/ }).getByRole('button', { name: 'Abrir' }).click();

  const voters = async () => (await db().doc(`retros/${RETRO}/notes/n1`).get()).data().voters;
  await page.getByRole('button', { name: 'Me gusta', exact: true }).click();
  await expect.poll(voters).toEqual(['e2e-engineer']);
  // No se ha abierto ninguna tarjeta: votar no pasa por el popup.
  await expect(page.locator('app-modal[open]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitar me gusta' }).click();
  await expect.poll(voters).toEqual([]);
});
