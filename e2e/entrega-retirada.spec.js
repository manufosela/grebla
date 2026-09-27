/**
 * DORA y LEAN se retiran; sus URLs llevan a Entrega (RMR-TSK-0603).
 *
 * Se midió antes de retirar, no se supuso:
 *  - `/dora` en producción: **0 repos** dados de alta. La pantalla estaba vacía.
 *  - `/leanTeams`: 13 equipos configurados, pero `/leanUnits` y `/lean` a 0. Sin
 *    métricas calculadas, tampoco enseñaba un solo número.
 *
 * Así que no se pierde ningún dato. Y los 13 equipos eran justo los que no
 * describen la realidad: «miramos por repos, no por equipos; 1 equipo somos».
 *
 * Redirigen en vez de dar 404 porque un enlace guardado sigue siendo un enlace.
 */
import { test, expect, signInAs } from './fixtures.js';

test('un enlace guardado a DORA lleva a Entrega', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/dora');
  await expect(page).toHaveURL(/\/tools\/entrega/, { timeout: 20_000 });
});

test('y uno a LEAN, también', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/lean');
  await expect(page).toHaveURL(/\/tools\/entrega/, { timeout: 20_000 });
});

test('el ancla de administración tampoco se queda colgada', async ({ page }) => {
  // Las tarjetas del panel apuntaban a `#repos` y `#teams`. Quien tenga ese
  // enlace guardado aterriza en Entrega, no en un 404 con ancla.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/dora#repos');
  await expect(page).toHaveURL(/\/tools\/entrega/, { timeout: 20_000 });
});

test('ya no se ofrecen en el inicio ni en el panel', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible({ timeout: 20_000 });

  await expect(page.locator('#tenant-tools .tool-card[href="/tools/dora"]')).toHaveCount(0);
  await expect(page.locator('#tenant-tools .tool-card[href="/tools/lean"]')).toHaveCount(0);
  // Y la que sí se ofrece sigue ahí, en su grupo.
  await expect(page.locator('#tenant-tools .tool-card[href="/tools/entrega"]')).toBeVisible();

  await page.goto('/admin');
  await expect(page.locator('[data-admin-id="dora"]')).toHaveCount(0);
  await expect(page.locator('[data-admin-id="lean"]')).toHaveCount(0);
});
