/**
 * Marca de ALCANCE en el inicio (RMR-TSK-0587).
 *
 * Quien gestiona no tenía forma de saber si lo que está viendo lo ven también
 * los ingenieros. La duda es razonable —cada persona ve su propio inicio— y se
 * resuelve diciéndolo en la tarjeta, no obligando a recordarlo.
 *
 * La marca es por ROL, no por política: «Equipo» y «O2O de mi equipo» solo se
 * ofrecen a quien lidera. Lo que depende de la política de cada herramienta se
 * gestiona en Permisos y no se marca aquí, o la marca dejaría de significar algo
 * por aparecer en todas partes.
 */
import { test, expect, signInAs } from './fixtures.js';

const tarjeta = (page, href) => page.locator(`#tenant-tools .tool-card[href="${href}"]`);

test('las tarjetas que solo ve quien lidera van marcadas', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible({ timeout: 20_000 });

  await expect(tarjeta(page, '/tools/team').locator('.only')).toHaveText('solo quien lidera');
  await expect(tarjeta(page, '/tools/o2o').locator('.only')).toHaveText('solo quien lidera');
});

test('lo que ve todo el mundo NO se marca: si se marcara todo, no diría nada', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible({ timeout: 20_000 });

  await expect(tarjeta(page, '/kudos').locator('.only')).toHaveCount(0);
  await expect(tarjeta(page, '/organigrama').locator('.only')).toHaveCount(0);
});

test('la marca de «lo tuyo» vuelve a verse', async ({ page }) => {
  // Al agrupar el inicio, el título de la tarjeta pasó de h2 a h3 y el punto de
  // acento de «lo tuyo» se quedó apuntando al selector viejo: la marca existía
  // y no se pintaba.
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible({ timeout: 20_000 });

  const propia = page.locator('#tenant-tools .tool-card[data-own]').first();
  const punto = await propia.locator('h3').evaluate((el) => getComputedStyle(el, '::after').content);
  expect(punto).not.toBe('none');
});
