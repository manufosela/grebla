/**
 * Pantalla completa del mapa de carrera (RMR-TSK-0529, RMR-BUG-0125).
 *
 * La pantalla completa REAL la concede el navegador y en headless no se puede
 * fiar; lo que se fija aquí es SOBRE QUÉ se pide. Los overlays del juego
 * (archipiélago, ficha, bitácora, carpools…) son hermanos del escenario con
 * position: fixed, y en pantalla completa solo se ve el subárbol del elemento
 * que la tiene: pedirla sobre el escenario dejaba el mar invisible al embarcar.
 */
import { test, expect, signInAs } from './fixtures.js';

test('Maximizar pide la pantalla completa sobre el juego entero, no sobre el escenario', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tools/career-map');

  const app = page.locator('career-app');
  await app.getByRole('button', { name: 'Isla 3D' }).click();
  // La guía de la isla sale la primera vez; si no está, no hay nada que cerrar.
  await app.getByRole('button', { name: '¡A jugar!' }).click({ timeout: 5_000 }).catch(() => {});
  const maximizar = app.getByRole('button', { name: /Pantalla completa/ });
  await expect(maximizar).toBeVisible({ timeout: 20_000 });

  await app.evaluate((el) => {
    el.dataset.fsTarget = '';
    el.requestFullscreen = () => { el.dataset.fsTarget = 'juego'; return Promise.resolve(); };
    const stage = el.shadowRoot.querySelector('.stage3d');
    stage.requestFullscreen = () => { el.dataset.fsTarget = 'escenario'; return Promise.resolve(); };
  });
  await maximizar.click();
  await expect(app).toHaveAttribute('data-fs-target', 'juego');
});
