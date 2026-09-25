/**
 * La PUERTA de Role Mirror es lo tuyo (RMR-TSK-0563).
 *
 * Al entrar en la herramienta salía un desplegable para elegir a alguien del
 * equipo: quien gestiona no veía su propio perfil —lo tenía escondido en «Mi
 * espacio»— y cualquier ingeniero aterrizaba en una pantalla que no era para él.
 * Gobernar añade una puerta; no cambia lo que la herramienta es.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** La política: la ve toda ingeniería, la gestiona quien lidera esa rama. */
async function conPolitica(fn) {
  const previa = (await db().doc('toolPolicies/rolemirror').get()).data() ?? null;
  await db().doc('toolPolicies/rolemirror').set({
    label: 'Role Mirror',
    audience: { branches: ['engineering'] },
    managedBy: { branches: ['engineering-manager'] },
  });
  try { await fn(); } finally {
    if (previa) await db().doc('toolPolicies/rolemirror').set(previa);
    else await db().doc('toolPolicies/rolemirror').delete();
  }
}

test('al entrar se ve TU perfil, no un selector de personas del equipo', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/role-mirror');

    await expect(page.getByRole('heading', { name: 'Mi Role Mirror' })).toBeVisible();
    // Lo que se ha ido: el desplegable de personas del equipo.
    await expect(page.locator('#rm-person')).toHaveCount(0);
    await expect(page.locator('role-questionnaire')).toBeVisible();
  });
});

test('quien no gestiona no ve siquiera la pestaña de administración', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/role-mirror');
    await expect(page.locator('#rm-nav-admin')).toBeHidden();
  });
});

test('quien gobierna ve LO SUYO al entrar, y además la puerta de administrar', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/role-mirror');

    await expect(page.getByRole('heading', { name: 'Mi Role Mirror' })).toBeVisible();
    await expect(page.locator('#rm-nav-admin')).toBeVisible();
  });
});
