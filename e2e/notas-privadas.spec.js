/**
 * O2O › Privado (RMR-TSK-0636): el manager guarda la performance review de su
 * persona —contenido y fecha, sin enlace— y la ve en su ficha. Que la persona
 * no la lea lo prueban las reglas (rules-notas-privadas.spec.js).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSONA = 'e2e-person-privado';

test.beforeEach(async () => {
  await db().doc(`people/${PERSONA}`).set({ name: 'Bea Privado E2E', ownerLeaderUid: 'e2e-head', active: true });
});

test.afterEach(async () => {
  for (const d of (await db().collection(`managerNotes/${PERSONA}/entries`).get()).docs) await d.ref.delete();
  await db().doc(`people/${PERSONA}`).delete();
});

test('el manager añade la performance review de su persona y la ve en su pestaña (RMR-TSK-0694)', async ({ page }) => {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: 'Abrir ficha de Bea Privado E2E' }).click().catch(async () => {
    await page.getByText('Bea Privado E2E').first().click();
  });
  const ficha = page.locator('team-person-detail');
  await ficha.getByRole('tab', { name: 'Performance Review' }).click();
  await expect(ficha.getByRole('tab', { name: 'Notas' })).toHaveCount(0);

  const notas = ficha.locator('manager-notes');
  await expect(notas.getByText('Aún no hay performance reviews.')).toBeVisible();
  await notas.getByLabel('Fecha en que se hizo').fill('2026-06-30');
  await notas.getByLabel('Contenido').fill('Semestre muy sólido; siguiente paso, liderar el diseño.');
  await notas.getByRole('button', { name: 'Añadir performance review' }).click();

  // Sin título se guarda con el del tipo, y se lista con su fecha.
  await expect(notas.locator('summary')).toHaveText(/^Performance review · Performance review · 2026-06-30$/);
  const guardadas = (await db().collection(`managerNotes/${PERSONA}/entries`).get()).docs.map((d) => d.data());
  expect(guardadas).toEqual([expect.objectContaining({ type: 'perf-review', date: '2026-06-30', createdBy: expect.any(String) })]);
});
