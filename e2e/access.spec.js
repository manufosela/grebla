/**
 * Smoke de ACCESO POR ROL (RMR-TSK-0299, primera tanda). Comprueba que el salto
 * de login por custom token funciona y que cada rol entra a su zona sin ser
 * devuelto a la pantalla de login. No valida cada detalle de UI: es la red que
 * cae si el arranque de sesión de test se rompe.
 */
import { test, expect, signInAs, LOGIN_MARKER } from './fixtures.js';

test.describe('acceso por rol (sin login de Google)', () => {
  test('el superadmin entra al panel de administración', async ({ page }) => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin');
    await expect(page.locator('body')).not.toContainText(LOGIN_MARKER);
    // El panel lista a los managers de la organización.
    await expect(page.getByText(/Managers/i).first()).toBeVisible();
  });

  test('el Head entra a la herramienta de Equipo y ve su rama', async ({ page }) => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await expect(page.locator('body')).not.toContainText(LOGIN_MARKER);
    // La persona del manager que le reporta está en su rama.
    await expect(page.getByText('Persona del manager')).toBeVisible();
  });

  test('el ingeniero entra a su espacio', async ({ page }) => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio');
    await expect(page.locator('body')).not.toContainText(LOGIN_MARKER);
    // Su identidad encabeza el espacio (hay más apariciones del nombre, así que
    // se ancla a la cabecera concreta).
    await expect(page.locator('#engineer-identity').getByText('Ingeniero E2E')).toBeVisible();
  });
});
