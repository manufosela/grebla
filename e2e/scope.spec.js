/**
 * E2E del toggle de ámbito (RMR-TSK-0309): un usuario que gobierna la instancia
 * (admin) Y ADEMÁS lidera un equipo ve por defecto SU equipo —no toda la
 * organización— y puede alternar. Es el valor central del ADR de acceso en dos
 * ejes: el gobierno deja de tapar la faceta funcional.
 *
 * El admin-manager (ROLES.adminmgr) está en /admins y en /leaders, con su propia
 * persona; NO debe ver por defecto la gente de otros managers.
 */
import { test, expect, signInAs } from './fixtures.js';

test('el admin que además lidera ve su equipo por defecto y puede alternar', async ({ page }) => {
  await signInAs(page, 'adminmgr');
  await page.goto('/tools/team');

  // Por defecto (ámbito «mi equipo»): ve SU persona...
  await expect(page.getByText('Persona del admin-manager')).toBeVisible();
  // ...y NO la de otro manager (eso sería «toda la organización»).
  await expect(page.getByText('Persona del manager')).toHaveCount(0);

  // El control de ámbito existe (solo aparece para quien puede elegir).
  await expect(page.getByRole('button', { name: 'Toda la organización' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mi equipo' })).toBeVisible();

  // Y el nombre de la herramienta dice a quién estás viendo (RMR-TSK-0585).
  await expect(page.locator('#team-title')).toHaveText('Mi equipo');
});

test('quien ve a toda la organización NO lee «Mi equipo» encima', async ({ page }) => {
  // Era el rótulo más caro de la herramienta: un superadmin abría «Tu equipo» y
  // le salía la organización entera, así que el nombre mentía sin avisar.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(page.locator('team-app .tab').first()).toBeVisible({ timeout: 20_000 });

  await expect(page.locator('#team-title')).toHaveText('Toda la organización');
  // Sin control de ámbito: un admin puro no elige, ve todo.
  await expect(page.locator('team-app .scope')).toHaveCount(0);
});

test('al cambiar de ámbito, el nombre cambia con él', async ({ page }) => {
  await signInAs(page, 'adminmgr');
  await page.goto('/tools/team');
  await expect(page.locator('#team-title')).toHaveText('Mi equipo');

  await page.getByRole('button', { name: 'Toda la organización' }).click();

  // El cambio recarga (el alcance se decide al construir el container), así que
  // el rótulo se vuelve a calcular desde cero: no es una etiqueta pegada a mano.
  await expect(page.locator('#team-title')).toHaveText('Toda la organización');
  await expect(page.getByText('Persona del manager')).toBeVisible();
});

test('ninguna sección se llama de forma genérica', async ({ page }) => {
  // «Personas» no decía cuáles, y «Ajustes» no decía de qué (RMR-TSK-0585).
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(page.locator('team-app .tab').first()).toBeVisible({ timeout: 20_000 });

  const secciones = await page.locator('team-app .tab').allInnerTexts();
  expect(secciones).toContain('Personas activas');
  expect(secciones).not.toContain('Personas');
  expect(secciones).not.toContain('Ajustes');
});
