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
  const restringida = { label: 'Entrega', audience: { branches: ['no-existe'] }, managedBy: {} };
  await db().doc('toolPolicies/entrega').set(restringida);
  await signInAs(page, 'engineer');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mi espacio' })).toBeVisible();
  await expect(page.locator('[data-tool-id="entrega"]')).toBeHidden();
  await db().doc('toolPolicies/entrega').delete();
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

test('la administración es un enlace junto a las pestañas, y abre aparte', async ({ page }) => {
  // Ya no es una tarjeta del hub (ADR «Tres capas en el hub»): es gobierno, no
  // uso diario, y su página tiene ocho pestañas propias dentro.
  await signInAs(page, 'superadmin');
  await page.goto('/');
  const admin = page.locator('#admin-link');
  await expect(admin).toBeVisible();
  await expect(admin).toContainText('Administración');
  await expect(admin).toHaveAttribute('target', '_blank');
  // Y no queda ninguna tarjeta de gobierno suelta en la rejilla.
  await expect(page.locator('#tenant-tools [data-admin-only]')).toHaveCount(0);
});

test('un ingeniero no ve la administración por ninguna parte', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/');
  await expect(page.locator('#admin-link')).toBeHidden();
});

test('el panel tiene su «Volver» al hub', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin/organizacion');
  await expect(page.getByRole('link', { name: '← Volver' })).toBeVisible();
});

test('los permisos por persona se gestionan desde su propia sección del panel', async ({ page }) => {
  await db().doc('toolPolicies/entrega').set({ label: 'Entrega', audience: { branches: ['engineering'] }, managedBy: {} });
  // Si el test muere a medias, esta política se queda puesta y desordena el hub
  // de los demás specs: por eso se retira pase lo que pase.
  try {
  await signInAs(page, 'superadmin');
  await page.goto('/admin/organizacion');

  await page.getByRole('button', { name: 'Permisos' }).click();
  await page.getByRole('tab', { name: 'Por persona' }).click();
  await expect(page.getByRole('heading', { name: 'Permisos por persona' })).toBeVisible();

  // Se elige a alguien y se ve qué le toca por su rol antes de decidir.
  await page.getByLabel('Persona').selectOption({ label: 'Persona del manager' });
  const fila = page.locator('person-permissions tr', { hasText: 'Entrega' });
  const ve = fila.getByLabel('Ve o usa');
  // Solo Sí o No (RMR-TSK-0758): esta persona es de ingeniería, así que
  // Entrega le llega por su rama sin ninguna excepción.
  await expect(ve).toHaveValue('yes');
  // Y la misma matriz que la ficha: también se decide quién la GESTIONA.
  await expect(fila.getByLabel('Gestiona')).toBeVisible();

  // Quitársela sin tocar su rol: queda como excepción en su ficha.
  await ve.selectOption('no');
  await expect.poll(async () => {
    const snap = await db().collection('people').where('name', '==', 'Persona del manager').get();
    return snap.docs[0]?.data()?.toolOverrides?.entrega?.use ?? null;
  }, { timeout: 15_000 }).toBe(false);

  // Y volver a lo que da su rol la retira, en vez de dejar un «sí» escrito.
  await ve.selectOption('yes');
  await expect.poll(async () => {
    const snap = await db().collection('people').where('name', '==', 'Persona del manager').get();
    return snap.docs[0]?.data()?.toolOverrides?.entrega ?? null;
  }, { timeout: 15_000 }).toBeNull();

  } finally {
    await db().doc('toolPolicies/entrega').delete();
  }
});

test('Encuestas ya no está en el inicio ni en Administración: se fue al portal (HU-0014)', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  // El hub ha cargado (se ve alguna card), pero la de encuestas no está.
  await expect(page.locator('[data-tool-id="kudos"]:not([hidden])')).toBeVisible();
  await expect(page.locator('a[href="/tools/encuestas"]')).toHaveCount(0);

  await page.goto('/admin');
  await expect(page.locator('[data-admin-id="team"]')).toBeVisible();
  await expect(page.locator('[data-admin-id="surveys"]')).toHaveCount(0);
});
