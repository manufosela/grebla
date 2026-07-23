/**
 * E2E del ALCANCE DE RAMA (RMR-TSK-0300): el Head ve a la gente y las retros de
 * su rama —y NADA de fuera— en las tres tools que heredan el alcance. Es lo que
 * se enseña en la demo, así que conviene que salte aquí antes que en vivo.
 *
 * La rama la deja sembrada el global-setup: MANAGER reporta al Head y tiene a
 * «Persona del manager»; OUTSIDER (ajeno) tiene a «Persona de fuera».
 */
import { test, expect, signInAs } from './fixtures.js';

test.describe('el Head ve su rama y no lo de fuera', () => {
  test('Equipo: ve a la persona de su rama, no a la ajena', async ({ page }) => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await expect(page.getByText('Persona del manager')).toBeVisible();
    await expect(page.getByText('Persona de fuera')).toHaveCount(0);
  });

  test('Carrera: la persona de su rama está en el mapa', async ({ page }) => {
    await signInAs(page, 'head');
    await page.goto('/tools/career-map');
    // En Carrera la persona vive en el selector (una <option>), que existe en el
    // DOM sin estar «visible»: se comprueba presencia, no visibilidad.
    await expect(page.getByText('Persona del manager').first()).toBeAttached();
    await expect(page.getByText('Persona de fuera')).toHaveCount(0);
  });

  test('Retros: ve la retro de su rama, no la ajena', async ({ page }) => {
    await signInAs(page, 'head');
    await page.goto('/retros');
    await expect(page.getByText('Retro de la rama')).toBeVisible();
    await expect(page.getByText('Retro ajena')).toHaveCount(0);
  });
});
