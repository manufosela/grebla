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

test('cuando la tabla no cabe, se puede desplazar hasta el final', async ({ page }) => {
  await conPlantillaLarga(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const caja = page.locator('superadmin-panel .table-wrap').first();
    await expect(caja).toBeVisible();
    // Lo que NO puede pasar es que el contenido se salga sin barra que arrastrar:
    // eso deja datos a medio leer y sin forma de verlos (RMR-BUG-0108).
    const estado = await caja.evaluate((el) => ({
      desborde: el.scrollWidth - el.clientWidth,
      eje: getComputedStyle(el).overflowX,
    }));
    if (estado.desborde > 1) {
      expect(['auto', 'scroll'], `desborda ${estado.desborde}px sin barra`).toContain(estado.eje);
      // Y la barra llega de verdad hasta el final del contenido.
      const alcanzado = await caja.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
        return el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      });
      expect(alcanzado, 'no se llega al extremo derecho').toBe(true);
    }
  });
});

test('el contenido de las celdas no se queda a medias', async ({ page }) => {
  await conPlantillaLarga(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    // Un select recortado enseña «Mobile En» en vez del rol entero: el ancho de
    // la columna manda sobre el dato, que es justo al revés de lo que debe ser.
    const cortados = await page.locator('superadmin-panel table.people select').evaluateAll(
      (nodos) => nodos.filter((n) => n.scrollWidth > n.clientWidth + 1).length,
    );
    expect(cortados, 'hay selects cuyo texto no cabe en su propia caja').toBe(0);
  });
});

test('la casilla de superadmin se alcanza y se puede marcar', async ({ page }) => {
  await conPlantillaLarga(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    // Puede quedar fuera del ancho visible —para eso está la barra—, pero tiene
    // que poder alcanzarse y usarse. Lo que no vale es que sea inaccesible.
    const fila = page.locator('superadmin-panel tbody tr')
      .filter({ has: page.locator('td:nth-child(1)').filter({ hasText: 'Larguísimo Número 0' }) });
    const casilla = fila.getByLabel('Superadmin');
    await casilla.scrollIntoViewIfNeeded();
    await expect(casilla).toBeVisible();

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

test('la tabla cabe a un ancho de portátil, sin depender de la barra', async ({ page }) => {
  await conPlantillaLarga(async () => {
    await page.setViewportSize({ width: 1120, height: 863 });
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    // Perseguir la barra fue un error: en Chrome es «overlay» y no se dibuja
    // hasta que ya estás arrastrando, así que se ve la tabla cortada y ninguna
    // barra (RMR-BUG-0108). La caja sigue estando por si acaso, pero lo que
    // arregla el problema es que no haga falta.
    const caja = page.locator('superadmin-panel .table-wrap').first();
    const desborde = await caja.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(desborde, 'la tabla no cabe en 1120px: habrá que arrastrarla').toBeLessThanOrEqual(2);
  });
});
