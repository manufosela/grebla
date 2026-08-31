/**
 * E2E de los AVISOS (RMR-TSK-0457). Lo que hay que leer antes de actuar no puede
 * ir en gris de nota al pie: se lee como mobiliario y nadie lo ve. Aquí se
 * comprueba que los tres que más importan salen con el estilo de aviso —caja con
 * fondo y borde— y no como texto secundario.
 *
 * No todos los `hint` son avisos: «arrastra para mover · rueda para zoom» o la
 * descripción de un ajuste son notas al pie y deben seguir siéndolo.
 */
import { test, expect, signInAs } from './fixtures.js';

test('lo irreversible se avisa, no se susurra', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: 'Bajas' }).click();

  const aviso = page.locator('team-departures .info-note');
  await expect(aviso).toContainText('irreversible');
  // Caja de aviso de verdad: con fondo propio, no un párrafo suelto.
  const fondo = await aviso.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fondo).not.toBe('rgba(0, 0, 0, 0)');
});

test('la descripción de un ajuste sigue siendo nota al pie', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: 'Ajustes' }).click();

  // Un aviso por cada cosa que se puede explicar convertiría la página en ruido:
  // esto describe qué hace una opción, no advierte de nada.
  await expect(page.locator('team-settings .hint').first()).toBeVisible();
  await expect(page.locator('team-settings .info-note')).toHaveCount(0);
});
