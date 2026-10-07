/**
 * Equipo › ficha › O2O › «O2O hechos» (RMR-TSK-0649): los O2O registrados en la
 * herramienta O2O se ven en la ficha de la persona, los mismos datos, con lo que
 * es solo del manager separado de lo que ve la persona.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSONA = 'e2e-person-o2o-ficha';
const NOMBRE = 'Bea O2O Ficha E2E';
const SESION = 'leaders/e2e-head/o2o/e2e-sesion-ficha';

test.beforeEach(async () => {
  await db().doc(`people/${PERSONA}`).set({ name: NOMBRE, ownerLeaderUid: 'e2e-head', o2oManagerUids: ['e2e-head'], active: true });
  await db().doc(SESION).set({
    personId: PERSONA, periodId: 'x', date: '2026-10-07', guideVersion: 2, answers: [], transcript: '',
    privateNotes: 'Preparar el roadmap juntos', summary: 'Buen arranque', sharedSummary: 'Gracias por el esfuerzo', sharedWithPerson: true,
    createdAt: new Date(),
  });
});

test.afterEach(async () => {
  await db().doc(SESION).delete();
  await db().doc(`people/${PERSONA}`).delete();
});

test('el O2O registrado se ve en la ficha, con lo privado y lo que ve la persona', async ({ page }) => {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: `Abrir ficha de ${NOMBRE}` }).click().catch(async () => {
    await page.getByText(NOMBRE).first().click();
  });
  const ficha = page.locator('team-person-detail');
  await ficha.getByRole('tab', { name: 'O2O', exact: true }).click();
  await expect(ficha.getByRole('tab', { name: 'O2O hechos' })).toHaveAttribute('aria-selected', 'true');

  const o2o = ficha.locator('person-o2o');
  await expect(o2o.getByText('2026-10-07')).toBeVisible();
  await expect(o2o.getByText('Preparar el roadmap juntos')).toBeVisible();
  await expect(o2o.getByText('Gracias por el esfuerzo')).toBeVisible();
  await expect(o2o.getByRole('link', { name: 'Registrar un O2O' })).toHaveAttribute('href', '/tools/o2o');
});
