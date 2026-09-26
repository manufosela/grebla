/**
 * GRUPOS del inicio (RMR-TSK-0575, ADR «El inicio se agrupa por propósito»).
 *
 * Sustituye al E2E de las capas. Lo que se defiende aquí es lo mismo que
 * defendían las pestañas: que la agrupación diga la VERDAD sobre quien mira. Los
 * grupos se derivan de las tarjetas que han quedado visibles, así que un
 * encabezado nunca aparece sin nada debajo; y al SIMULAR un rol, los grupos son
 * los de ese rol — si no, el superadmin creería estar viendo lo que ve un
 * empleado y estaría viendo otra cosa.
 */
import { test, expect, signInAs } from './fixtures.js';

const grupos = (page) => page.locator('#tenant-tools .tool-group:not([hidden])');
const grupo = (page, id) => page.locator(`#tenant-tools .tool-group[data-group="${id}"]`);
const tarjetas = (page) => page.locator('#tenant-tools .tool-card:not([hidden])');

/** Ningún grupo visible puede estar vacío: eso anunciaría algo que no está. */
async function ningunGrupoVacio(page) {
  return page.evaluate(() => [...document.querySelectorAll('#tenant-tools .tool-group:not([hidden])')]
    .filter((g) => g.querySelectorAll('.tool-card:not([hidden])').length === 0)
    .map((g) => g.dataset.group));
}

test('el inicio se lee por grupos, sin pestañas que adivinar', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible();

  // Las pestañas de capa ya no existen: un solo eje de agrupación.
  await expect(page.locator('#hub-layers')).toHaveCount(0);
  await expect(grupos(page)).not.toHaveCount(0);
  await expect(grupo(page, 'tuyo')).toBeVisible();
  await expect(grupo(page, 'tuyo')).toContainText('Lo tuyo');
});

test('un grupo sin tarjetas visibles no se pinta', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible();
  await expect.poll(async () => tarjetas(page).count(), { timeout: 15_000 }).toBeGreaterThan(0);

  expect(await ningunGrupoVacio(page)).toEqual([]);
});

test('el grupo de cola está vacío: toda herramienta tiene su sitio', async ({ page }) => {
  // Existe para que olvidar el grupo no esconda una herramienta, no como destino.
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible();

  await expect(grupo(page, 'otras')).toHaveCount(0);
});

test('al simular un empleado, los grupos son los de un empleado', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible();
  const comoSuperadmin = await grupos(page).count();

  await page.getByRole('button', { name: 'Empleado' }).click();
  // «Tu equipo» es de quien lidera: simulando un empleado no se ve.
  await expect(grupo(page, 'equipo')).toBeHidden();

  // Nunca más grupos que como superadmin, y ninguno vacío: la simulación no
  // puede enseñar un encabezado que ese perfil no tendría.
  expect(await grupos(page).count()).toBeLessThanOrEqual(comoSuperadmin);
  expect(await ningunGrupoVacio(page)).toEqual([]);
});

test('o hay grupos, o se dice que no hay nada: nunca un hueco', async ({ page }) => {
  // Al agrupar desapareció la tarjeta «Más herramientas», que era lo único que
  // llenaba el contenedor cuando el filtro no dejaba nada. Sin este invariante,
  // quien no tenga herramientas se queda mirando un vacío sin saber si falta
  // algo o falla algo.
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible();

  const conGrupos = await grupos(page).count();
  const avisoVisible = await page.locator('#tools-empty:not([hidden])').count();
  expect(conGrupos > 0 || avisoVisible === 1).toBe(true);   // nunca ninguna de las dos
  expect(conGrupos > 0 && avisoVisible === 1).toBe(false);  // nunca las dos a la vez

  // Y simulando un perfil sin nada asignado, sigue cumpliéndose.
  await page.getByRole('button', { name: 'Empleado' }).click();
  await expect(page.locator('#tenant-tools')).toBeVisible();
  const grupos2 = await grupos(page).count();
  const aviso2 = await page.locator('#tools-empty:not([hidden])').count();
  expect(grupos2 > 0 || aviso2 === 1).toBe(true);
  expect(grupos2 > 0 && aviso2 === 1).toBe(false);
});

test('quien no tiene acceso no ve ni grupos ni la barra', async ({ page }) => {
  await signInAs(page, 'stranger');
  await page.goto('/');

  await expect(page.locator('#tenant-tools')).toBeHidden();
  await expect(page.locator('#hub-bar')).toBeHidden();
});
