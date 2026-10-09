/**
 * Retros: votar no mueve las tarjetas; quien facilita las ordena por votos con
 * un botón cuando quiere, y puede volver al orden de llegada (RMR-TSK-0659).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

const RETRO = 'e2e-retro-orden';
const NOTES = ['n1', 'n2'];

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test.beforeEach(async () => {
  await db().doc(`retros/${RETRO}`).set({
    name: 'Retro de ordenar', format: 'ssc', ownerLeaderUid: 'e2e-engineer',
    memberUids: ['e2e-manager', 'e2e-engineer'], branchUids: [], joinToken: 'x', status: 'open',
    revealed: { start: true }, scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });
  const note = (text, ms) => ({
    columnId: 'start', text, authorUid: 'e2e-engineer', authorName: 'Engineer E2E',
    voters: [], groupId: null, createdAt: new Date(ms),
  });
  await db().doc(`retros/${RETRO}/notes/n1`).set(note('Primera en llegar', 1_000));
  await db().doc(`retros/${RETRO}/notes/n2`).set(note('Segunda en llegar', 2_000));
});

test.afterEach(async () => {
  await Promise.all(NOTES.map((id) => db().doc(`retros/${RETRO}/notes/${id}`).delete().catch(() => {})));
  await db().doc(`retros/${RETRO}`).delete().catch(() => {});
});

test('votar no reordena; el botón ordena por votos y vuelve al orden de llegada', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await page.getByRole('row', { name: /Retro de ordenar/ }).getByRole('button', { name: 'Abrir' }).click();

  const order = () => page.locator('.card-text').allTextContents();
  await expect.poll(order).toEqual(['Primera en llegar', 'Segunda en llegar']);

  const voters = async () => (await db().doc(`retros/${RETRO}/notes/n2`).get()).data().voters;
  await page.getByRole('button', { name: 'Me gusta', exact: true }).nth(1).click();
  await expect.poll(voters).toEqual(['e2e-engineer']);
  await expect.poll(order).toEqual(['Primera en llegar', 'Segunda en llegar']);

  await page.getByRole('button', { name: /Ordenar por votos/ }).click();
  await expect.poll(order).toEqual(['Segunda en llegar', 'Primera en llegar']);

  await page.getByRole('button', { name: /Orden de llegada/ }).click();
  await expect.poll(order).toEqual(['Primera en llegar', 'Segunda en llegar']);
});
