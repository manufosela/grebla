/**
 * Identidad de la instancia (RMR-TSK-0596).
 *
 * GREBLA se despliega una vez por organización, así que sus rótulos por defecto
 * son los generales del producto. `employeeDomain` y `usersCrownLabel` ya se
 * leían desde hacía meses y no tenían pantalla: se editaban a mano en la consola
 * de Firestore, que es como decir que no se editaban.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Deja /config/org como estaba: otros specs dependen de employeeDomain. */
async function conConfigIntacta(fn) {
  const ref = db().doc('config/org');
  const previa = (await ref.get()).data() ?? null;
  try { await fn(); } finally {
    if (previa) await ref.set(previa);
    else await ref.delete();
  }
}

const panel = (page) => page.locator('superadmin-panel');

test('el superadmin pone el nombre de su casa y se queda puesto', async ({ page }) => {
  await conConfigIntacta(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/organizacion#identidad');

    const identidad = panel(page).locator('org-identity');
    await expect(identidad).toBeVisible({ timeout: 20_000 });

    // Editable solo cuando se sabe qué hay guardado: guardar encima de lo que no
    // has visto es perder lo de otro.
    const nombre = identidad.getByLabel('Nombre de la organización');
    await expect(nombre).toBeVisible();
    await nombre.fill('CASA E2E');
    await identidad.getByRole('button', { name: 'Guardar' }).click();
    await expect(identidad.getByText('Guardado.')).toBeVisible();

    await page.reload();
    await expect(panel(page).locator('org-identity').getByLabel('Nombre de la organización'))
      .toHaveValue('CASA E2E', { timeout: 20_000 });
  });
});

test('el dominio se guarda saneado, y la caja enseña lo que de verdad quedó', async ({ page }) => {
  await conConfigIntacta(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/organizacion#identidad');

    const identidad = panel(page).locator('org-identity');
    await expect(identidad).toBeVisible({ timeout: 20_000 });
    await identidad.getByLabel('Dominio de email de empleados').fill('@Casa-E2E.COM');
    await identidad.getByRole('button', { name: 'Guardar' }).click();
    await expect(identidad.getByText('Guardado.')).toBeVisible();

    // Sin arroba y en minúsculas: si la caja siguiera mostrando lo tecleado,
    // parecería que se guardó otra cosa.
    await expect(identidad.getByLabel('Dominio de email de empleados')).toHaveValue('casa-e2e.com');
    const guardado = (await db().doc('config/org').get()).data();
    expect(guardado.employeeDomain).toBe('casa-e2e.com');
  });
});

test('cada campo dice qué pasa si lo dejas en blanco', async ({ page }) => {
  // Un campo vacío usa el texto del producto, y eso hay que saberlo ANTES de
  // guardar, no descubrirlo en la pantalla de al lado.
  await signInAs(page, 'superadmin');
  await page.goto('/admin/organizacion#identidad');

  const identidad = panel(page).locator('org-identity');
  await expect(identidad).toBeVisible({ timeout: 20_000 });
  await expect(identidad).toContainText('Vacío: «Toda la organización»');
  await expect(identidad).toContainText('Vacío: no se muestra');
});

test('lo que se escribe en Identidad se lee en Equipo', async ({ page }) => {
  // El círculo entero (RMR-TSK-0597): configurarlo no vale de nada si el rótulo
  // sigue diciendo lo del producto.
  await conConfigIntacta(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/organizacion#identidad');

    const identidad = panel(page).locator('org-identity');
    await expect(identidad).toBeVisible({ timeout: 20_000 });
    await identidad.getByLabel('Cuando se ve a todo el mundo, se llama').fill('Toda la tribbu');
    await identidad.getByRole('button', { name: 'Guardar' }).click();
    await expect(identidad.getByText('Guardado.')).toBeVisible();

    await page.goto('/tools/team');
    await expect(page.locator('#team-title')).toHaveText('Toda la tribbu', { timeout: 20_000 });
  });
});

test('sin nombre propio, Equipo sigue diciendo el del producto', async ({ page }) => {
  await conConfigIntacta(async () => {
    await db().doc('config/org').set({ everyoneLabel: '' }, { merge: true });
    await signInAs(page, 'superadmin');
    await page.goto('/tools/team');

    await expect(page.locator('#team-title')).toHaveText('Toda la organización', { timeout: 20_000 });
  });
});

test('sube su logo y se queda puesto, en la cabecera y en la vista previa (RMR-TSK-0598)', async ({ page }) => {
  await conConfigIntacta(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/organizacion#identidad');

    const identidad = panel(page).locator('org-identity');
    await expect(identidad).toBeVisible({ timeout: 20_000 });
    await expect(identidad.locator('.logo-empty')).toBeVisible();

    // Elegir el archivo ES la decisión: se guarda ahí, sin un «guardar» de más
    // que solo sirve para dejarlo a medias.
    await identidad.locator('input[type=file]').setInputFiles({
      name: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><rect width="60" height="20"/></svg>'),
    });

    await expect(identidad.locator('.logo-preview img')).toBeVisible();
    await expect.poll(async () => (await db().doc('config/org').get()).data()?.logo ?? null, { timeout: 15_000 })
      .toContain('data:image/svg+xml;base64,');

    // Y la cabecera, que es para lo que se sube.
    await page.reload();
    await expect(page.locator('#brand-logo')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.brand-word')).toBeHidden();
  });
});

test('un archivo que no vale se rechaza diciendo por qué, y no toca lo guardado', async ({ page }) => {
  await conConfigIntacta(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/organizacion#identidad');

    const identidad = panel(page).locator('org-identity');
    await expect(identidad).toBeVisible({ timeout: 20_000 });
    await identidad.locator('input[type=file]').setInputFiles({
      name: 'foto.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('no soy un logo'),
    });

    // Dice qué trae y qué vale, no un «archivo no válido» que obliga a adivinar.
    const error = identidad.locator('.logo-block .error');
    await expect(error).toContainText('SVG o PNG');
    await expect(error).toContainText('image/jpeg');
    await expect(identidad.locator('.logo-empty')).toBeVisible();
    expect((await db().doc('config/org').get()).data()?.logo ?? null).toBeNull();
  });
});

test('quien no gobierna no llega a la identidad', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/admin/organizacion#identidad');

  await expect(page.locator('org-identity')).toHaveCount(0);
});
