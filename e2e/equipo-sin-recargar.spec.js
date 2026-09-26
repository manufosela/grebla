/**
 * Volver a una sección de Equipo no la recarga (RMR-TSK-0584).
 *
 * Cada cambio de pestaña DESTRUÍA el componente, y al volver se creaba otro que
 * pedía todo a Firestore desde cero: tardaba lo mismo la quinta vez que la
 * primera.
 *
 * Se comprueba sobre el propio nodo y no sobre las peticiones de red: contra el
 * emulador, Firestore habla por un canal persistente y no se ven lecturas
 * sueltas, así que contarlas mediría el transporte y no el comportamiento. Si el
 * MISMO nodo sigue ahí al volver, no ha habido recarga — eso es la causa, no el
 * síntoma.
 */
import { test, expect, signInAs } from './fixtures.js';

const seccion = (page, nombre) => page.locator('team-app .tab', { hasText: nombre });

/** Marca el nodo de una sección para reconocerlo si sobrevive. */
async function marcar(page, etiqueta) {
  await page.locator(`team-app ${etiqueta}`).evaluate((el) => { el.dataset.marca = 'viva'; });
}

test('volver a una sección ya vista conserva lo que ya había cargado', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(seccion(page, 'Personas')).toBeVisible({ timeout: 20_000 });

  await seccion(page, 'Personas').click();
  await expect(page.locator('team-app team-people')).toHaveCount(1);
  await marcar(page, 'team-people');

  // Nos vamos a otra sección y volvemos.
  await seccion(page, 'Bajas').click();
  await expect(page.locator('team-app team-departures')).toHaveCount(1);
  await seccion(page, 'Personas').click();

  // El mismo nodo: no se destruyó, así que no vuelve a pedir nada.
  await expect(page.locator('team-app team-people')).toHaveAttribute('data-marca', 'viva');
});

test('la sección que no se abre nunca, nunca se carga', async ({ page }) => {
  // El precio de conservar lo cargado no puede ser cargarlo todo al entrar.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(seccion(page, 'Ajustes')).toBeVisible({ timeout: 20_000 });

  await expect(page.locator('team-app team-settings')).toHaveCount(0);
  await seccion(page, 'Ajustes').click();
  await expect(page.locator('team-app team-settings')).toHaveCount(1);
});

test('solo se ve una sección a la vez, aunque haya varias montadas', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(seccion(page, 'Personas')).toBeVisible({ timeout: 20_000 });

  await seccion(page, 'Personas').click();
  await seccion(page, 'Bajas').click();

  await expect(page.locator('team-app team-departures')).toBeVisible();
  await expect(page.locator('team-app team-people')).toBeHidden();
});
