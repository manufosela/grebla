/**
 * La persona lee SUS performance reviews en «Mi espacio» (RMR-TSK-0544).
 * Lo que se fija: ve la suya, no el contexto privado del manager ni la de otra
 * persona, y no hay forma de editarla desde aquí.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const MIA = 'managerNotes/e2e-person-eng/entries';
const AJENA = 'managerNotes/e2e-person-mgr/entries';

test.beforeEach(async () => {
  await db().doc(`${MIA}/r-julio`).set({ type: 'perf-review', date: '2026-07-30', title: 'Review de julio', content: 'Semestre muy solido.' });
  await db().doc(`${MIA}/c-privado`).set({ type: 'contexto', date: '2026-07-01', title: 'Contexto', content: 'NOTA PRIVADA DEL MANAGER' });
  await db().doc(`${AJENA}/r-otra`).set({ type: 'perf-review', date: '2026-07-30', title: 'Review ajena', content: 'ESTO ES DE OTRA PERSONA' });
});

test.afterEach(async () => {
  for (const path of [`${MIA}/r-julio`, `${MIA}/c-privado`, `${AJENA}/r-otra`]) await db().doc(path).delete();
});

test('la persona ve su performance review de julio, solo lectura', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/mi-espacio#review');

  const reviews = page.locator('engineer-space my-perf-reviews');
  await expect(reviews.getByText('Review de julio')).toBeVisible({ timeout: 20_000 });
  await expect(reviews).toContainText('Semestre muy solido.');
  await expect(reviews).not.toContainText('NOTA PRIVADA DEL MANAGER');
  await expect(reviews).not.toContainText('ESTO ES DE OTRA PERSONA');
  await expect(reviews.getByRole('button')).toHaveCount(0);
});
