/**
 * E2E de PERMISOS (RMR-TSK-0460). Hay dos puertas —Administración › Permisos y
 * la ficha de la persona— porque cada uno entra por donde está mirando. Lo que
 * se verifica aquí es que detrás de las dos hay la MISMA matriz: cuando eran dos
 * implementaciones divergieron, y la del panel perdió la columna «Gestiona».
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Abre Administración › Permisos › Por persona, y elige a alguien. */
async function abrirPermisosDelPanel(page, nombre) {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Permisos' }).click();
  await page.getByRole('tab', { name: 'Por persona' }).click();
  await page.getByLabel('Persona').selectOption({ label: nombre });
}

/** Abre la sub-pestaña «Permisos» de una persona en la herramienta Equipo. */
async function abrirPermisosDeLaFicha(page, nombre) {
  await page.goto('/tools/team');
  await page.getByText(nombre, { exact: true }).first().click();
  await page.getByRole('tab', { name: 'Permisos' }).click();
}

test('la ficha y el panel enseñan la misma matriz de permisos', async ({ page }) => {
  await db().doc('toolPolicies/marea').set({ label: 'Marea', audience: { everyone: true }, managedBy: {} });
  try {
    await signInAs(page, 'superadmin');

    await abrirPermisosDeLaFicha(page, 'Persona del manager');
    const enLaFicha = page.locator('person-permissions tr', { hasText: 'Marea' });
    await expect(enLaFicha.getByLabel('Ve o usa')).toContainText('Heredar (sí)');
    await expect(enLaFicha.getByLabel('Gestiona')).toBeVisible();

    // Se le quita desde la ficha…
    await enLaFicha.getByLabel('Ve o usa').selectOption('no');
    await expect.poll(async () => {
      const d = (await db().doc('people/e2e-person-mgr').get()).data();
      return d?.toolOverrides?.marea?.use ?? null;
    }, { timeout: 15_000 }).toBe(false);

    // …y en el panel se ve esa misma excepción, no otra cosa.
    await abrirPermisosDelPanel(page, 'Persona del manager');
    const enElPanel = page.locator('person-permissions tr', { hasText: 'Marea' });
    await expect(enElPanel.getByLabel('Ve o usa')).toHaveValue('no');
  } finally {
    await db().doc('toolPolicies/marea').delete();
    await db().doc('people/e2e-person-mgr').update({ toolOverrides: {} });
  }
});

test('«heredar» borra la excepción en vez de dejar escrito un «no»', async ({ page }) => {
  await db().doc('toolPolicies/marea').set({ label: 'Marea', audience: { everyone: true }, managedBy: {} });
  await db().doc('people/e2e-person-mgr').update({ toolOverrides: { marea: { use: false } } });
  try {
    await signInAs(page, 'superadmin');
    await abrirPermisosDeLaFicha(page, 'Persona del manager');
    await page.locator('person-permissions tr', { hasText: 'Marea' }).getByLabel('Ve o usa').selectOption('inherit');

    // La herramienta desaparece del mapa: si quedara un `false` escrito, la
    // puerta seguiría cerrada aunque su rol se la abriera más adelante.
    await expect.poll(async () => {
      const d = (await db().doc('people/e2e-person-mgr').get()).data();
      return d?.toolOverrides?.marea ?? null;
    }, { timeout: 15_000 }).toBeNull();
  } finally {
    await db().doc('toolPolicies/marea').delete();
    await db().doc('people/e2e-person-mgr').update({ toolOverrides: {} });
  }
});

test('Permisos vive junto a Usuarios y agrupa sus dos ámbitos', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  const secciones = page.getByRole('navigation', { name: 'Secciones de gestión' });
  // «Herramientas» ya no es una pestaña suelta: era la política por rol y rama,
  // y había que saberse que los permisos se tocaban en dos sitios lejanos.
  await expect(secciones.getByRole('button', { name: 'Herramientas' })).toHaveCount(0);
  const nombres = await secciones.getByRole('button').allInnerTexts();
  expect(nombres.at(-1)).toBe('Permisos');
  expect(nombres.at(-2)).toBe('Usuarios');

  await secciones.getByRole('button', { name: 'Permisos' }).click();
  const ambitos = page.getByRole('tablist', { name: 'Ámbito de los permisos' });
  await expect(ambitos.getByRole('tab', { name: 'Por rol y rama' })).toHaveAttribute('aria-selected', 'true');
  await ambitos.getByRole('tab', { name: 'Por persona' }).click();
  await expect(page.getByRole('heading', { name: 'Permisos por persona' })).toBeVisible();
});

test('un enlace guardado con #herramientas sigue aterrizando donde vive eso ahora', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin#herramientas');

  await expect(page.getByRole('button', { name: 'Permisos' })).toHaveClass(/active/);
  await expect(page.getByRole('tab', { name: 'Por rol y rama' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /quién las ve y quién las gestiona/ })).toBeVisible();
});
