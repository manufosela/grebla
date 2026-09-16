/**
 * Scrum Poker en pestañas (RMR-TSK-0514): convocar es gestión y estimar es
 * juego. Antes iban apilados en la misma pantalla —el formulario de nueva
 * sesión encima de la lista— y quien entraba a votar se topaba primero con lo
 * que no era suyo. Ahora quien convoca ve dos pestañas, y quien solo estima no
 * ve pestaña alguna: una pestaña sola no es una pestaña.
 */
import { test, expect, signInAs } from './fixtures.js';

const pestanas = (page) => page.getByRole('tab');
const pestana = (page, nombre) => page.getByRole('tab', { name: nombre, exact: true });
const crear = (page) => page.getByRole('button', { name: 'Crear sesión' });
const nombreSesion = (page) => page.getByPlaceholder(/Nombre de la sesión/);

test('quien convoca ve Sesiones y Convocar, y cada pestaña enseña lo suyo', async ({ page }) => {
  await signInAs(page, 'head');
  await page.goto('/poker');

  await expect(pestanas(page)).toHaveCount(2);
  await expect(pestana(page, 'Sesiones')).toHaveAttribute('aria-selected', 'true');
  // En Sesiones no está el formulario de convocatoria.
  await expect(crear(page)).toHaveCount(0);
  await expect(nombreSesion(page)).toHaveCount(0);

  await pestana(page, 'Convocar').click();
  await expect(pestana(page, 'Convocar')).toHaveAttribute('aria-selected', 'true');
  // Lo que se ve acompaña a lo que se declara: la pestaña activa es la teñida.
  await expect(pestana(page, 'Convocar')).toHaveClass(/\bon\b/);
  await expect(pestana(page, 'Sesiones')).not.toHaveClass(/\bon\b/);
  await expect(crear(page)).toBeVisible();
  await expect(nombreSesion(page)).toBeVisible();
  // Y en Convocar no está la lista: ni tabla ni el vacío de «aún no has creado».
  await expect(page.getByText(/Aún no has creado ninguna sesión/)).toHaveCount(0);
});

test('quien solo estima no ve pestañas ni formulario', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/poker');

  await expect(page.getByText(/sesiones de poker|Sesiones de tu equipo/)).toBeVisible();
  await expect(pestanas(page)).toHaveCount(0);
  await expect(crear(page)).toHaveCount(0);
});
