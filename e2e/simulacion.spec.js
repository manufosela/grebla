/**
 * E2E del aviso de SIMULACIÓN (RMR-BUG-0113).
 *
 * La vista elegida en el conmutador dura toda la pestaña. Quien la olvidaba se
 * quedaba viendo la aplicación como otro rol —sin el enlace de Administración,
 * sin poder gestionar nada— y no había forma de saber por qué: la única pista
 * era cuál de los cuatro botones estaba resaltado, y el halo de superadmin
 * desaparecía, que es una señal por ausencia. No ver algo no dice el motivo.
 */
import { test, expect, signInAs } from './fixtures.js';

const aviso = (page) => page.locator('#sim-banner');
const vista = (page, nombre) => page.getByRole('button', { name: nombre, exact: true });
const listo = (page) => page.locator('#tenant-tools:not([hidden])').waitFor();

test('siendo tú no hay aviso: solo estorbaría', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await listo(page);
  await expect(aviso(page)).toBeHidden();
});

test('al simular otro rol se dice, con su nombre', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await listo(page);

  await vista(page, 'Manager').click();

  await expect(aviso(page)).toBeVisible();
  await expect(aviso(page)).toContainText('Manager');
  await expect(aviso(page)).toContainText('No es tu vista');
});

test('el aviso sigue ahí al recargar, que es cuando se olvida', async ({ page }) => {
  // El caso real: eliges Manager, sigues a lo tuyo, y al día siguiente te
  // extraña no ver la administración.
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await listo(page);
  await vista(page, 'Ingeniero').click();

  await page.goto('/');
  await listo(page);

  await expect(aviso(page)).toBeVisible();
  await expect(aviso(page)).toContainText('Ingeniero');
  await expect(page.locator('#admin-link')).toBeHidden();
});

test('se sale de un clic, y vuelve la administración', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await listo(page);
  await vista(page, 'Manager').click();
  await expect(page.locator('#admin-link')).toBeHidden();

  await page.getByRole('button', { name: 'Volver a mi vista' }).click();

  await listo(page);
  await expect(aviso(page)).toBeHidden();
  await expect(page.locator('#admin-link')).toBeVisible();
});

test('el aviso también acompaña fuera del hub', async ({ page }) => {
  // Simular no es cosa de la portada: si te vas a una herramienta con la vista
  // puesta, sigues sin ser tú y hay que decirlo igual.
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await listo(page);
  await vista(page, 'Empleado').click();

  await page.goto('/organigrama');

  await expect(aviso(page)).toBeVisible();
  await expect(aviso(page)).toContainText('Empleado');
});
