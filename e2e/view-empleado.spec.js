/**
 * E2E de la vista «Empleado» (RMR-TSK-0451): un superadmin previsualiza el hub
 * como lo ve quien NO está en ningún equipo.
 *
 * Lo que se protege es que la previsualización no MIENTA: si enseñara de más,
 * daría por accesible algo que un empleado no ve; si enseñara de menos, haría
 * pensar que no llega a herramientas que sí son suyas.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

// Las políticas se siembran AQUÍ y se retiran al acabar: puestas en el seed
// global cambiaban el gate de otras herramientas y tumbaban sus tests.
test.beforeAll(async () => {
  await db().doc('toolPolicies/kudos').set({ label: 'Kudos', audience: { everyone: true }, managedBy: {} });
  await db().doc('toolPolicies/dora').set({ label: 'DORA', audience: { branches: ['engineering'] }, managedBy: {} });
});
test.afterAll(async () => {
  await Promise.all([db().doc('toolPolicies/kudos').delete(), db().doc('toolPolicies/dora').delete()]);
});

/** ids de las herramientas visibles ahora mismo en el hub. */
const visibles = async (page) => (await page
  .locator('#tenant-tools [data-tool-id]:not([hidden])')
  .evaluateAll((els) => els.map((e) => e.dataset.toolId))).sort();

test('el conmutador ofrece la vista «Empleado» al superadmin', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Empleado' })).toBeVisible();
});

test('en vista «Empleado» solo quedan las herramientas abiertas a todos', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Empleado' })).toBeVisible();
  const comoSuperadmin = await visibles(page);

  await page.getByRole('button', { name: 'Empleado' }).click();
  // Se espera a que DESAPAREZCA una restringida, no a que aparezca la abierta:
  // «kudos» ya estaba en la lista del superadmin, así que esperarla se cumple
  // al instante y se leería el hub antes de repintarse.
  await expect.poll(() => visibles(page), { timeout: 10_000 }).not.toContain('dora');
  const comoEmpleado = await visibles(page);

  expect(comoEmpleado).toContain('kudos');    // abierta a todos
  expect(comoEmpleado).not.toContain('team'); // gestión de equipo
  expect(comoEmpleado.length).toBeLessThan(comoSuperadmin.length);
});
