/**
 * O2O es de tu equipo (RMR-TSK-0647): ser superadmin no hace que tu equipo sea
 * toda la organización. Quien gobierna y además lleva equipo ve a su gente, no
 * a las 137 personas de la instancia.
 */
import { test, expect, signInAs } from './fixtures.js';

test('un superadmin con equipo solo ve a su gente al registrar un O2O', async ({ page }) => {
  // adminmgr gobierna la instancia y lleva equipo: «Persona del admin-manager».
  await signInAs(page, 'adminmgr');
  await page.goto('/tools/o2o');
  await page.locator('o2o-app input[type="text"]').fill('Periodo mi equipo E2E');
  await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();
  await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();

  const options = page.locator('o2o-register select').first().locator('option');
  await expect(options.filter({ hasText: 'Persona del admin-manager' })).toHaveCount(1);
  // La gente de otros managers no es suya.
  await expect(options.filter({ hasText: 'Ingeniero E2E' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Persona de fuera' })).toHaveCount(0);
});
