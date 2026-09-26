/**
 * Orden de las tarjetas (RMR-TSK-0571).
 *
 * El inicio y el panel crecen a base de tarjetas y el orden era el del código:
 * quien decide qué es importante ahora no tenía forma de decirlo sin tocar un
 * fichero.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/**
 * Deja el orden como estaba al terminar. Borrar sin más dejaría sin
 * configuración a cualquier test posterior que contara con ella.
 */
async function restaurandoOrden(fn) {
  const previa = (await db().doc('config/cardLayout').get()).data() ?? null;
  try { return await fn(); } finally {
    if (previa) await db().doc('config/cardLayout').set(previa);
    else await db().doc('config/cardLayout').delete();
  }
}

async function conOrden(layout, fn) {
  return restaurandoOrden(async () => {
    await db().doc('config/cardLayout').set(layout);
    await fn();
  });
}

/** Nombres de las tarjetas del panel, en el orden en que se ven. */
async function tarjetasDelPanel(page) {
  await page.goto('/admin');
  const cards = page.locator('#admin-cards [data-admin-id]:not([hidden])');
  await expect.poll(async () => cards.count(), { timeout: 15_000 }).toBeGreaterThan(1);
  return (await cards.all()).reduce(async (acc, el) => [...(await acc), await el.getAttribute('data-admin-id')], Promise.resolve([]));
}

test('el panel respeta el orden guardado', async ({ page }) => {
  await conOrden({ admin: ['o2o', 'organizacion'] }, async () => {
    await signInAs(page, 'superadmin');
    const ids = await tarjetasDelPanel(page);

    // Las colocadas van primero y en su orden; el resto detrás.
    expect(ids.slice(0, 2)).toEqual(['o2o', 'organizacion']);
    expect(ids.length).toBeGreaterThan(2);
  });
});

test('una tarjeta que no está en el orden guardado NO desaparece', async ({ page }) => {
  // Es lo que impide que añadir una herramienta la deje invisible hasta que
  // alguien se acuerde de reordenar.
  await conOrden({ admin: ['o2o'] }, async () => {
    await signInAs(page, 'superadmin');
    const ids = await tarjetasDelPanel(page);

    expect(ids[0]).toBe('o2o');
    expect(ids).toContain('organizacion');
  });
});

test('una clave guardada que ya no existe no rompe nada', async ({ page }) => {
  await conOrden({ admin: ['fantasma', 'o2o'] }, async () => {
    await signInAs(page, 'superadmin');
    const ids = await tarjetasDelPanel(page);

    expect(ids[0]).toBe('o2o');
    expect(ids).not.toContain('fantasma');
  });
});

test('el inicio respeta el orden guardado DENTRO de cada grupo', async ({ page }) => {
  // El orden coloca las tarjetas de un grupo entre ellas; no mueve tarjetas de
  // grupo, que es lo que haría que «Kudos» apareciera en «Lo tuyo».
  await conOrden({ home: ['/kudos', '/marea'] }, async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/');
    // Esperar a que el hub esté montado: mientras carga, las tarjetas están en
    // el DOM en el orden del código y se leería ese.
    await expect(page.locator('#tenant-tools')).toBeVisible();
    const cards = page.locator('.tool-group[data-group="estamos"] .tool-card[href]');
    await expect.poll(async () => cards.count(), { timeout: 15_000 }).toBeGreaterThan(1);
    const hrefs = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('href')));

    expect(hrefs.slice(0, 2)).toEqual(['/kudos', '/marea']);
  });
});

test('el superadmin ordena desde su pantalla y lo guardado es lo que se ve', async ({ page }) => {
  await restaurandoOrden(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/tarjetas');

    const panel = page.locator('card-layout-editor section').nth(1);
    await expect(panel).toBeVisible();
    const antes = await panel.locator('.label').allInnerTexts();

    // Subir la segunda: las dos primeras se intercambian.
    await panel.locator('li').nth(1).getByRole('button', { name: /^Subir/ }).click();
    const despues = await panel.locator('.label').allInnerTexts();
    expect(despues.slice(0, 2)).toEqual([antes[1], antes[0]]);

    await page.getByRole('button', { name: 'Guardar orden' }).click();
    await expect(page.locator('card-layout-editor')).toContainText('Guardado');

    // Y lo guardado es lo que se estaba viendo, no un orden a medias.
    const guardado = (await db().doc('config/cardLayout').get()).data();
    expect(guardado.admin.length).toBe(despues.length);
    expect(guardado.home.length).toBeGreaterThan(0);
  });
});

test('quien no gobierna no ordena las tarjetas de nadie', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/admin/tarjetas');

  await expect(page.locator('#cl-denied')).toBeVisible();
  await expect(page.locator('card-layout-editor')).toHaveCount(0);
});
