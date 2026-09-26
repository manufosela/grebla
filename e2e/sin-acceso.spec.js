/**
 * Entrar sin sitio en la instancia (RMR-TSK-0519).
 *
 * En una instancia sin dominio de correo declarado (la demo), quien inicia
 * sesión sin ficha ni rol no ve herramientas y se le dice claro que la
 * instancia no le reconoce, en vez de enseñarle la portada muda de quien no ha
 * entrado. Las reglas que le cierran los datos se prueban en
 * scripts/validate-access-rules.mjs.
 */
import { test, expect, signInAs } from './fixtures.js';

test('quien entra sin ficha ni rol ve el aviso y ninguna herramienta', async ({ page }) => {
  await signInAs(page, 'stranger');
  await page.goto('/');

  await expect(page.getByText('Has entrado, pero esta instancia no te reconoce.')).toBeVisible();
  await expect(page.getByText('Inicia sesión arriba a la derecha')).toBeHidden();
  // El hub entero queda oculto: ni una tarjeta a la vista.
  await expect(page.locator('#tenant-tools')).toBeHidden();
  await expect(page.locator('#hub-bar')).toBeHidden();
});

test('sin sesión se sigue viendo la portada de siempre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Inicia sesión arriba a la derecha')).toBeVisible();
  await expect(page.getByText('Has entrado, pero esta instancia no te reconoce.')).toBeHidden();
});
