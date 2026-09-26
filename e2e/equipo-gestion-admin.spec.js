/**
 * La gestión de Equipo sale de la herramienta (RMR-TSK-0586).
 *
 * «Bajas» y «Ajustes» vivían entre las pestañas de uso: ensuciaban el día a día
 * con lo que casi nadie toca, y dejaban las bajas al alcance de cualquiera que
 * abriera la herramienta. Y los catálogos de áreas, gremios y labels eran los
 * MISMOS documentos que ya gestiona Organización — en producción no había ni una
 * entrada de ámbito personal.
 */
import { test, expect, signInAs } from './fixtures.js';

const pestanas = (page) => page.locator('team-app .tab');

test('la herramienta ya no ofrece bajas ni ajustes', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(pestanas(page).first()).toBeVisible({ timeout: 20_000 });

  const rotulos = await pestanas(page).allInnerTexts();
  expect(rotulos.join(' · ')).not.toContain('Bajas');
  expect(rotulos.join(' · ')).not.toContain('Ajustes');
});

test('un enlace guardado a las secciones mudadas sigue llevando a su sitio', async ({ page }) => {
  // Nadie deberia reaprender sus favoritos porque hayamos movido una pantalla.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team#departures');

  await expect(page).toHaveURL(/\/tools\/team\/admin/, { timeout: 20_000 });
});

test('quien gestiona ve las bajas y la configuración en la administración', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team/admin');

  await expect(page.locator('team-admin')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tab', { name: 'Bajas' })).toBeVisible();
  await page.getByRole('tab', { name: 'Configuración' }).click();
  await expect(page.locator('team-admin team-settings')).toBeVisible();

  // Los catálogos NO se repiten aquí: viven en Organización.
  await expect(page.locator('team-admin catalog-manager')).toHaveCount(0);
});

test('quien no gestiona equipos no entra', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/tools/team/admin');

  await expect(page.locator('#ta-denied')).toBeVisible();
  await expect(page.locator('team-admin')).toHaveCount(0);
});

test('la administración de Equipo tiene su tarjeta en el panel', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');
  const tarjeta = page.locator('[data-admin-id="team"]');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toHaveAttribute('href', /\/tools\/team\/admin/);
});
