/**
 * Externos con plan y objetivos (RMR-TSK-0764): sin expectativas de carrera,
 * pero su responsable les acuerda un plan y unos objetivos como a cualquiera.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-externa';
const NOMBRE = 'Persona externa E2E';

test('la ficha de una persona externa tiene Nivel, Plan y Objetivos', async ({ page }) => {
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, external: true });
  await db().doc(`${PERSON}/careerObjectives/o1`).set({
    title: 'Dar apoyo al TL', measure: 'Dos áreas con decisiones documentadas', dueDate: null, levelId: null, dimensionId: null,
    status: 'open', closingNote: '', closedAt: null, by: { uid: 'e2e-head', name: 'Head' }, at: '2026-10-18T09:00:00.000Z',
  });
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team#people');
    await page.getByRole('row', { name: new RegExp(NOMBRE) }).getByRole('button', { name: 'Editar' }).click();
    const ficha = page.locator('team-person-detail');
    await ficha.getByRole('tab', { name: 'Carrera', exact: true }).click();
    // Su responsable (dueño de la ficha, sin organigrama) escribe su plan.
    await ficha.getByRole('tab', { name: 'Plan' }).click();
    await ficha.getByRole('button', { name: 'Editar el plan' }).click();
    await ficha.getByLabel('Foco principal').fill('Apoyar al TL de backend');
    await ficha.getByRole('button', { name: 'Guardar el plan' }).click();
    await expect.poll(async () => (await db().doc(`${PERSON}/career/plan`).get()).data()?.focus ?? null, { timeout: 15_000 })
      .toBe('Apoyar al TL de backend');
    await ficha.getByRole('tab', { name: 'Objetivos' }).click();
    await expect(ficha.locator('.objective', { hasText: 'Dar apoyo al TL' })).toBeVisible();
    // Sin expectativas de carrera: solo sus objetivos.
    await expect(ficha.locator('career-levels li', { hasText: 'Qué se espera' })).toHaveCount(0);
  } finally {
    await db().doc(`${PERSON}/careerObjectives/o1`).delete();
    await db().doc(`${PERSON}/career/plan`).delete();
    await db().doc(PERSON).delete();
  }
});
