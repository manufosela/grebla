/**
 * Una sola puerta de entrada (RMR-TSK-0459).
 *
 * Antes un ingeniero era desviado a `/mi-espacio`, una pantalla con su propia
 * cabecera y sus propias pestañas, mientras el resto entraba al hub de cards.
 * Parecían dos aplicaciones. Ahora todos entran al hub y lo personal es una
 * card más.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test('un ingeniero se queda en el hub, no se le desvía', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Mi espacio' })).toBeVisible();
});

test('la card «Mi espacio» se ve aunque las políticas no den ninguna herramienta', async ({ page }) => {
  // Es lo suyo: la política gobierna la herramienta de equipo, no el derecho a
  // mirar sus propios datos. Sin esto, alguien de una rama sin permisos entraría
  // a un hub vacío.
  const restringida = { label: 'DORA', audience: { branches: ['no-existe'] }, managedBy: {} };
  await db().doc('toolPolicies/dora').set(restringida);
  await signInAs(page, 'engineer');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mi espacio' })).toBeVisible();
  await expect(page.locator('[data-tool-id="dora"]')).toBeHidden();
  await db().doc('toolPolicies/dora').delete();
});

test('Mi espacio tiene su «Volver» al hub, como cualquier herramienta', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/mi-espacio');
  await expect(page.getByRole('link', { name: '← Volver' })).toBeVisible();
});

test('en Mi espacio solo está lo personal, sin duplicar las cards del hub', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/mi-espacio');
  await expect(page.getByRole('tab', { name: 'Mi ficha' })).toBeVisible();
  for (const duplicada of ['Marea', 'Retros', 'Kudos', 'Motivadores']) {
    await expect(page.getByRole('tab', { name: duplicada })).toHaveCount(0);
  }
});

test('la administración es una card del hub, la primera y solo para quien gobierna', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  const admin = page.locator('[data-admin-only]');
  await expect(admin).toBeVisible();
  await expect(admin).toContainText('Administración');
  // La primera de la rejilla: es la puerta de quien gobierna.
  const primera = page.locator('#tenant-tools a.tool-card:not([hidden])').first();
  await expect(primera).toHaveAttribute('data-admin-only', 'true');
});

test('un ingeniero no ve la card de administración por ninguna parte', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/');
  await expect(page.locator('[data-admin-only]')).toBeHidden();
});

test('entrar al panel por su card deja la vista en «Admin»', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  // La card de administración solo se ofrece en la vista de admin: desde
  // «Manager», «Ingeniero» o «Empleado» el hub se pinta como lo vería ese rol,
  // y se sale por el conmutador de la cabecera (RMR-BUG-0104).
  await page.locator('[data-admin-only]').click();
  await expect(page).toHaveURL(/\/admin/);

  // Queda anotada la vista: al volver al hub el conmutador marca «Admin». Antes
  // no se anotaba ninguna y, deducida de la ruta, marcaba «Manager».
  expect(await page.evaluate(() => sessionStorage.getItem('grebla-view'))).toBe('admin');
});

test('el panel tiene su «Volver» al hub', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: '← Volver' })).toBeVisible();
});

test('los permisos por persona se gestionan desde su propia sección del panel', async ({ page }) => {
  await db().doc('toolPolicies/dora').set({ label: 'DORA', audience: { branches: ['engineering'] }, managedBy: {} });
  // Si el test muere a medias, esta política se queda puesta y desordena el hub
  // de los demás specs: por eso se retira pase lo que pase.
  try {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  await page.getByRole('button', { name: 'Permisos' }).click();
  await page.getByRole('tab', { name: 'Por persona' }).click();
  await expect(page.getByRole('heading', { name: 'Permisos por persona' })).toBeVisible();

  // Se elige a alguien y se ve qué le toca por su rol antes de decidir.
  await page.getByLabel('Persona').selectOption({ label: 'Persona del manager' });
  const fila = page.locator('person-permissions tr', { hasText: 'DORA' });
  const ve = fila.getByLabel('Ve o usa');
  // La etiqueta de «heredar» dice qué pasa si no tocas nada.
  await expect(ve).toContainText('Heredar (no)');
  // Y la misma matriz que la ficha: también se decide quién la GESTIONA.
  await expect(fila.getByLabel('Gestiona')).toBeVisible();

  // Dársela sin tocar su rol: queda como excepción en su ficha.
  await ve.selectOption('yes');
  await expect.poll(async () => {
    const snap = await db().collection('people').where('name', '==', 'Persona del manager').get();
    return snap.docs[0]?.data()?.toolOverrides?.dora?.use ?? null;
  }, { timeout: 15_000 }).toBe(true);

  // Y «heredar» la retira, en vez de dejar un «no» escrito que nadie entiende.
  await ve.selectOption('inherit');
  await expect.poll(async () => {
    const snap = await db().collection('people').where('name', '==', 'Persona del manager').get();
    return snap.docs[0]?.data()?.toolOverrides?.dora ?? null;
  }, { timeout: 15_000 }).toBeNull();

  } finally {
    await db().doc('toolPolicies/dora').delete();
  }
});
