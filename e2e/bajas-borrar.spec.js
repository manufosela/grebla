/**
 * Borrar definitivamente una baja (RMR-BUG-0140): si el servidor la borra, la
 * lista no puede seguir enseñándola, ni al momento ni al recargar. El navegador
 * guarda una copia local de Firestore, y esa copia no manda sobre el servidor.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const RUTA = 'people/e2e-baja-duplicada';
const NOMBRE = 'Duplicado Baja E2E';

test('una baja borrada desaparece de la lista y no vuelve al recargar', async ({ page }) => {
  await db().doc(RUTA).set({ name: NOMBRE, ownerLeaderUid: 'e2e-superadmin', active: false, deactivatedAt: '2026-10-01T00:00:00.000Z' });
  try {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/team/admin');
    await page.getByRole('tab', { name: 'Bajas' }).click();
    const fila = page.locator('team-departures').getByText(NOMBRE);
    await expect(fila).toBeVisible();

    await page.locator('team-departures tr').filter({ hasText: NOMBRE })
      .getByRole('button', { name: /Borrar definitivamente/ }).click();
    await page.locator('team-departures .del-dialog input').fill(NOMBRE);
    await page.locator('team-departures .del-dialog').getByRole('button', { name: 'Borrar definitivamente' }).click();
    // La primera llamada a la Cloud Function en el emulador arranca en frío.
    await expect.poll(async () => (await db().doc(RUTA).get()).exists, { timeout: 60_000 }).toBe(false);
    await expect(fila).toHaveCount(0);

    await page.reload();
    await page.getByRole('tab', { name: 'Bajas' }).click();
    await expect(page.locator('team-departures .info-note')).toBeVisible();
    await expect(page.locator('team-departures').getByText(NOMBRE)).toHaveCount(0);
  } finally {
    await db().doc(RUTA).delete();
  }
});
