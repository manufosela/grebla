/**
 * Retros › Acciones (RMR-TSK-0644): las acciones de mis retros con su
 * responsable, para marcarlas hechas y descargarlas.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

const RETRO = 'e2e-retro-seguimiento';
const ACCION = 'e2e-accion-seguimiento';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test.beforeEach(async () => {
  await db().doc(`retros/${RETRO}`).set({
    name: 'Retro Sprint 30', format: 'ssc', ownerLeaderUid: 'e2e-engineer', memberUids: ['e2e-engineer'],
    branchUids: [], joinToken: 'x', status: 'closed', scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });
  await db().doc(`retroActions/${ACCION}`).set({
    text: 'Automatizar la release', owners: ['e2e-engineer'], ownerNames: ['Ingeniero E2E'], ownerLeaderUid: 'e2e-engineer',
    scope: { type: 'team', domainKey: null, label: null }, fromRetroId: RETRO, status: 'pending', doneAt: null, createdAt: new Date(),
  });
});

test.afterEach(async () => {
  await db().doc(`retroActions/${ACCION}`).delete().catch(() => {});
  await db().doc(`retros/${RETRO}`).delete().catch(() => {});
});

test('la pestaña Acciones lista la acción con su responsable y retro, y se marca hecha', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await page.getByRole('tab', { name: 'Acciones' }).click();

  const fila = page.getByRole('row', { name: /Automatizar la release/ });
  await expect(fila).toContainText('Ingeniero E2E');
  await expect(fila).toContainText('Retro Sprint 30');
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled();

  await fila.getByRole('button', { name: /Pendiente/ }).click();
  await expect.poll(async () => (await db().doc(`retroActions/${ACCION}`).get()).data().status).toBe('done');
  // Pasa a «Hechas»: en Pendientes ya no está.
  await expect(page.getByText('No hay acciones en esta vista.')).toBeVisible();
});
