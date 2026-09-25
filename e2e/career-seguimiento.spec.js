/**
 * Seguimiento del plan de desarrollo (RMR-TSK-0566).
 *
 * Por dónde va cada persona y cuánto le dedica no se veía en ninguna parte: lo
 * único que había era un botón «⏱ Tiempo» dentro del juego, que solo daba
 * minutos y obligaba a entrar a jugar para mirarlo.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** La herramienta la ve ingeniería; la gestiona quien lidera esa rama. */
async function conPolitica(fn) {
  const previa = (await db().doc('toolPolicies/career').get()).data() ?? null;
  await db().doc('toolPolicies/career').set({
    label: 'Plan de desarrollo',
    audience: { branches: ['engineering'] },
    managedBy: { branches: ['engineering-manager'] },
  });
  try { await fn(); } finally {
    if (previa) await db().doc('toolPolicies/career').set(previa);
    else await db().doc('toolPolicies/career').delete();
  }
}

/** Alguien que ya ha empezado su plan y le ha dedicado ratos. */
async function conViajeYTiempo(fn) {
  const persona = db().doc('people/e2e-person-eng');
  await persona.collection('career').doc('journey').set({
    currentIsland: 'frontend', visitedCities: ['a', 'b', 'c'], plannedRoute: ['a', 'b', 'c', 'd'],
  });
  await persona.collection('career').doc('playtime').set({
    totalMinutes: 240,
    byDay: { '2026-09-24': 30, '2026-09-23': 90 },
  });
  try { await fn(); } finally {
    await persona.collection('career').doc('journey').delete();
    await persona.collection('career').doc('playtime').delete();
  }
}

test('quien gestiona ve la lista del equipo y, al pinchar, por dónde va esa persona', async ({ page }) => {
  await conPolitica(() => conViajeYTiempo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/career-map/admin');

    const lista = page.locator('career-tracking .side');
    await expect(lista).toBeVisible();
    const persona = lista.getByRole('button', { name: /Ingeniero E2E/ });
    await expect(persona).toBeVisible();

    await persona.click();
    const detalle = page.locator('career-tracking .main');
    await expect(detalle.getByRole('heading', { name: 'Ingeniero E2E' })).toBeVisible();
    // Por dónde va: la isla y lo andado, no solo minutos.
    await expect(detalle).toContainText('Isla Frontend');
    await expect(detalle).toContainText('3 paradas visitadas');
    // Y su dedicación, con la media por día ACTIVO (120 min en 2 días).
    await expect(detalle).toContainText('Días activos');
    await expect(detalle).toContainText('1 h');
  }));
});

test('la vista de conjunto compara al equipo de un vistazo', async ({ page }) => {
  await conPolitica(() => conViajeYTiempo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/career-map/admin');
    await expect(page.locator('career-tracking .side')).toBeVisible();

    await page.getByRole('tab', { name: 'Conjunto' }).click();
    const tabla = page.locator('career-tracking table');
    await expect(tabla).toBeVisible();
    await expect(tabla).toContainText('Ingeniero E2E');
    // Quien no ha empezado sale marcado, que es a quien hay que mirar primero.
    await expect(tabla).toContainText('sin empezar');
    // Y sin ceros donde no hubo medida: un «0 min» se lee como un dato.
    await expect(tabla).not.toContainText('0 min');
  }));
});

test('quien no gestiona no entra, aunque escriba la URL', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/career-map/admin');

    await expect(page.locator('#ct-denied')).toBeVisible();
    await expect(page.locator('career-tracking')).toHaveCount(0);
  });
});

test('la pestaña de seguimiento solo se desvela a quien gestiona', async ({ page }) => {
  await conPolitica(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/career-map');
    await expect(page.locator('#cm-nav-admin')).toBeHidden();
  });
});

test('el seguimiento tiene su tarjeta en el panel de administración', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin');
  const tarjeta = page.locator('[data-admin-id="career"]');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toHaveAttribute('href', /\/tools\/career-map\/admin/);
});
