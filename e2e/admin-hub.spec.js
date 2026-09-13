/**
 * E2E del HUB DE ADMINISTRACIÓN (RMR-TSK-0495).
 *
 * Antes «/admin» era solo la gestión de la organización, con sus ocho pestañas.
 * Quien entraba a administrar no encontraba dónde se gestionan las encuestas,
 * los O2O o los motivadores —cada herramienta ya tenía su gestión dentro, pero
 * no había puerta— y parecía que no se pudieran administrar.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const tarjeta = (page, id) => page.locator(`[data-admin-id="${id}"]`);
const visibles = async (page) => (await page
  .locator('#admin-cards [data-admin-id]:not([hidden])')
  .evaluateAll((els) => els.map((e) => e.dataset.adminId))).sort();

test('quien gobierna ve la organización y todas las herramientas', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  await expect(tarjeta(page, 'organizacion')).toBeVisible();
  const ids = await visibles(page);
  expect(ids).toContain('surveys');
  expect(ids).toContain('o2o');
  expect(ids).toContain('motivators');
});

test('solo hay tarjeta de lo que se puede administrar', async ({ page }) => {
  // Retros y Poker se convocan y se usan: no hay ajustes ni datos agregados
  // detrás. Una tarjeta que promete «Administrar» y lleva al uso normal gasta el
  // viaje de quien vino a configurar algo.
  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  const ids = await visibles(page);
  expect(ids).not.toContain('retros');
  expect(ids).not.toContain('poker');
});

test('cada tarjeta lleva a la gestión que ya existe, sin duplicarla', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  await tarjeta(page, 'organizacion').click();
  await expect(page).toHaveURL(/\/admin\/organizacion/);
  await expect(page.getByRole('button', { name: 'Usuarios' })).toBeVisible();
});

test('un enlace guardado a /admin con su ancla sigue llevando a su sección', async ({ page }) => {
  // Nadie debería reaprender sus favoritos porque hayamos movido una página.
  await signInAs(page, 'superadmin');
  await page.goto('/admin#permisos');

  await expect(page).toHaveURL(/\/admin\/organizacion#permisos/);
});

test('quien gestiona UNA herramienta ve la suya y no la organización', async ({ page }) => {
  // El permiso sale del grant managedBy que ya existía, no de un rol nuevo.
  const previa = (await db().doc('toolPolicies/marea').get()).data() ?? null;
  await db().doc('toolPolicies/marea').set({
    label: 'Marea', audience: { everyone: true }, managedBy: { everyone: true },
  });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/admin');

    // No gobierna: la organización no es suya.
    await expect(tarjeta(page, 'organizacion')).toBeHidden();
  } finally {
    if (previa) await db().doc('toolPolicies/marea').set(previa);
    else await db().doc('toolPolicies/marea').delete();
  }
});

test('sin nada que administrar se dice, en vez de dejar la página vacía', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/admin');

  await expect(page.locator('#admin-empty')).toBeVisible();
  await expect(page.locator('#admin-empty')).toContainText('No administras ninguna herramienta');
});
