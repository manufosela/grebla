/**
 * E2E de la TABLA DE PERSONAS (RMR-BUG-0105). La casilla «Superadmin» estaba en
 * la penúltima de ocho columnas: la tabla desbordaba y había que bajar hasta el
 * final para encontrar la barra de scroll horizontal y arrastrarla. Un control
 * que existe pero no se encuentra es un control que no está.
 *
 * Se mide el desbordamiento real (scrollWidth vs clientWidth), no el aspecto.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/**
 * Una plantilla de verdad: nombres y correos largos, que es cuando la tabla se
 * ensancha. Con cinco personas de nombre corto no se nota, y el test pasaría
 * sin comprobar nada.
 */
async function conPlantillaLarga(fn) {
  const ids = [];
  for (let i = 0; i < 14; i += 1) {
    const id = `e2e-ancho-${i}`;
    ids.push(id);
    await db().doc(`people/${id}`).set({
      name: `Persona de Nombre Larguísimo Número ${i}`,
      pendingEmail: `nombre.apellido.apellido${i}@empresa-con-dominio-largo.com`,
      // La primera tiene cuenta: es la única fila con casilla de acceso, así que
      // el test no depende de qué personas hayan dejado otros specs.
      uid: i === 0 ? 'e2e-ancho-uid' : null,
      ownerLeaderUid: 'e2e-manager', active: true,
    });
  }
  try { await fn(); } finally {
    for (const id of ids) await db().doc(`people/${id}`).delete();
  }
}

test('la tabla de personas cabe en pantalla, sin scroll horizontal', async ({ page }) => {
  await conPlantillaLarga(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const tabla = page.locator('superadmin-panel').locator('.table-wrap').first();
    await expect(tabla).toBeVisible();
    const desborde = await tabla.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(desborde, 'la tabla se sale de su contenedor').toBeLessThanOrEqual(1);
  });
});

test('la casilla de superadmin se alcanza sin arrastrar la tabla a un lado', async ({ page }) => {
  await conPlantillaLarga(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    // Por su propia fila: buscar por nombre suelto también casa con los selects
    // de «Reporta a» de las demás filas.
    const fila = page.locator('superadmin-panel tbody tr')
      .filter({ has: page.locator('td:nth-child(1)').filter({ hasText: 'Larguísimo Número 0' }) });
    const casilla = fila.getByLabel('Superadmin');
    // Bajar por la lista es normal; arrastrarla a un lado para ver una columna,
    // no. Por eso se mide solo lo horizontal, con la fila ya a la vista.
    await casilla.scrollIntoViewIfNeeded();
    const tabla = page.locator('superadmin-panel').locator('.table-wrap').first();
    // Dentro del ancho visible de la tabla: si estuviera fuera habría que
    // encontrar la barra de scroll —al final de la lista— y arrastrarla.
    const dentro = await casilla.evaluate((el, wrap) => {
      const c = el.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      return c.right <= w.right + 1 && c.left >= w.left - 1;
    }, await tabla.elementHandle());
    expect(dentro, 'la casilla queda fuera del ancho visible').toBe(true);

    // Y con su tamaño de casilla: el panel da min-width de campo de texto a todo
    // <input>, y eso estiraba el cuadrito hasta empujar «Superadmin» fuera.
    const ancho = await casilla.evaluate((el) => el.getBoundingClientRect().width);
    expect(ancho, 'la casilla se ha estirado como un campo de texto').toBeLessThan(40);
    await expect(fila.getByText('Superadmin')).toBeVisible();
  });
});

test('la cabecera acompaña al bajar por la lista', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await signInAs(page, 'superadmin');
  await page.goto('/admin#users');

  const th = page.locator('superadmin-panel thead th').first();
  const antes = await th.boundingBox();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const despues = await th.boundingBox();
  // Sin cabecera pegada, al bajar dejas de saber qué columna es cada cosa.
  expect(despues.y).toBeGreaterThan(antes.y - 600);
});
