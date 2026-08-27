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
