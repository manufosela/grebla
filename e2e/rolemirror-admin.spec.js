/**
 * La ADMINISTRACIÓN de Role Mirror (RMR-TSK-0562).
 *
 * Gestionar el perfil de alguien obligaba a saberse el camino: se elegía a la
 * persona en un desplegable de la pantalla de uso, y el panel con la comparativa
 * y el CSV vivía en una URL sin enlace desde ninguna parte. Ahora hay una sola
 * puerta, con la LISTA de ingeniería a la izquierda y, al pinchar, el perfil de
 * esa persona; el panel de siempre sigue ahí, en su pestaña.
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

test('quien gestiona ve la lista de ingeniería y, al pinchar, el perfil de esa persona', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/role-mirror/admin');

    const lista = page.locator('rm-admin .side');
    await expect(lista).toBeVisible();
    // Una LISTA, no el desplegable de antes.
    await expect(page.locator('#rm-person')).toHaveCount(0);
    const persona = lista.getByRole('button', { name: /Ingeniero E2E/ });
    await expect(persona).toBeVisible();

    await persona.click();
    const detalle = page.locator('rm-admin .main');
    await expect(detalle.getByRole('heading', { name: 'Ingeniero E2E' })).toBeVisible();
    await expect(detalle.locator('role-questionnaire')).toBeVisible();

    // El histórico en su pestaña: el cuestionario es largo y, debajo, quedaba a
    // un scroll que nadie recorre.
    await detalle.getByRole('tab', { name: /Histórico/ }).click();
    await expect(detalle.locator('role-questionnaire')).toBeHidden();
    await expect(detalle).toContainText('Sin mediciones todavía');
  });
});

test('quien no gestiona no pasa, aunque escriba la URL', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/role-mirror/admin');

    await expect(page.locator('#rm-admin-denied')).toBeVisible();
    await expect(page.locator('rm-admin')).toHaveCount(0);
  });
});

test('el panel de siempre sigue ahí: la lista nueva no se lo come', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/role-mirror/admin');

    // Comparativa, distribución de roles y CSV no se han ido a ninguna parte:
    // viven en su pestaña, no apilados debajo.
    await expect(page.locator('[data-panel="resumen"]')).toBeHidden();
    await page.getByRole('tab', { name: 'Resumen' }).click();
    const resumen = page.locator('[data-panel="resumen"]');
    await expect(resumen).toBeVisible();
    await expect(resumen.locator('admin-dashboard')).toContainText('Distribución de roles');
    // Y al volver, la lista sigue donde estaba.
    await page.getByRole('tab', { name: 'Personas' }).click();
    await expect(page.locator('rm-admin .side')).toBeVisible();
  });
});

test('la administración tiene su tarjeta en el panel: no hay que saberse la URL', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');
  const tarjeta = page.locator('[data-admin-id="rolemirror"]');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toHaveAttribute('href', /\/tools\/role-mirror\/admin/);
});
