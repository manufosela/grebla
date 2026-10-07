/**
 * Editor de managers de O2O en Administración › Personas (RMR-TSK-0656): el
 * superadmin añade y quita managers de O2O a cada persona. Solo se ofrecen
 * quienes tienen cuenta y están por debajo en la pirámide (más senior).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const IC = 'people/e2e-mgro2o-ic';
const JEFA = 'people/e2e-mgro2o-jefa';
const PAR = 'people/e2e-mgro2o-par';
const fila = (page, nombre) => page.locator('superadmin-panel tbody tr')
  .filter({ has: page.locator('td:nth-child(1)').filter({ hasText: nombre }) });

test.beforeEach(async () => {
  await db().doc(IC).set({ name: 'Ic Editor O2O', notion: { level: 'IC' }, o2oManagerUids: [], active: true });
  await db().doc(JEFA).set({ name: 'Jefa Editor O2O', uid: 'e2e-mgro2o-jefa-uid', notion: { level: 'Manager' }, active: true });
  await db().doc(PAR).set({ name: 'Par Editor O2O', uid: 'e2e-mgro2o-par-uid', notion: { level: 'IC' }, active: true });
});
test.afterEach(async () => {
  for (const ruta of [IC, JEFA, PAR]) await db().doc(ruta).delete();
});

test('el superadmin añade y quita un manager de O2O; un par no se ofrece', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin#users');

  const anadir = fila(page, 'Ic Editor O2O').getByLabel('Añadir manager de O2O a Ic Editor O2O');
  await expect(anadir.locator('option', { hasText: 'Jefa Editor O2O' })).toHaveCount(1);
  await expect(anadir.locator('option', { hasText: 'Par Editor O2O' })).toHaveCount(0);

  await anadir.selectOption({ label: 'Jefa Editor O2O' });
  await expect.poll(async () => (await db().doc(IC).get()).data().o2oManagerUids, { timeout: 15_000 })
    .toEqual(['e2e-mgro2o-jefa-uid']);

  await fila(page, 'Ic Editor O2O').getByRole('button', { name: 'Quitar a Jefa Editor O2O como manager de O2O de Ic Editor O2O' }).click();
  await expect.poll(async () => (await db().doc(IC).get()).data().o2oManagerUids, { timeout: 15_000 }).toEqual([]);
});
