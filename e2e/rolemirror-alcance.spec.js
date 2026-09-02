/**
 * E2E del ALCANCE del Role Mirror (RMR-BUG-0107). El selector de persona pedía
 * solo `leaderUid`, así que listaba únicamente a quien te reporta de forma
 * DIRECTA: un superadmin no veía a toda la organización y un Head no llegaba a
 * la gente que cuelga de sus managers. Parecía hacer falta gobierno de instancia
 * para consultar a alguien de tu propia rama, y el modelo ya lo resolvía.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/**
 * Rama PROPIA colgada del head: un manager suyo y una persona de ese manager.
 * No se usa la cadena de las fixtures porque el espejo de líderes lo recalcula
 * una Cloud Function desde el organigrama, y cualquier spec que toque quién
 * reporta a quién la cambia por debajo.
 */
async function conRamaPropia(fn) {
  await db().doc('leaders/e2e-rm-mgr').set({ displayName: 'Manager RM', email: 'rm-mgr@e2e.test', reportsTo: 'e2e-head' });
  await db().doc('people/e2e-rm-persona').set({
    name: 'Persona de la rama RM', uid: null, ownerLeaderUid: 'e2e-rm-mgr', active: true,
  });
  try { await fn(); } finally {
    await db().doc('people/e2e-rm-persona').delete();
    await db().doc('leaders/e2e-rm-mgr').delete();
  }
}

/** Nombres del desplegable de persona. */
async function personasOfrecidas(page) {
  await page.goto('/tools/role-mirror');
  const select = page.locator('#rm-person');
  await expect(select).toBeVisible();
  await expect.poll(async () => (await select.locator('option').count()) > 1, { timeout: 15_000 }).toBe(true);
  return (await select.locator('option').allInnerTexts()).slice(1);
}

test('el superadmin ve a toda la organización, como en el resto de herramientas', async ({ page }) => {
  await signInAs(page, 'superadmin');
  const personas = await personasOfrecidas(page);

  // Gente de ramas distintas, ninguna colgando del superadmin.
  expect(personas).toEqual(expect.arrayContaining(['Ingeniero E2E', 'Persona del manager', 'Persona de fuera']));
});

test('un head llega a su rama entera, sin ser superadmin', async ({ page }) => {
  await conRamaPropia(async () => {
    await signInAs(page, 'head');
    const personas = await personasOfrecidas(page);

    // Cuelga de un manager que reporta al head: es su rama, aunque no le
    // reporte a él directamente.
    expect(personas).toContain('Persona de la rama RM');
    // Y lo de fuera de su rama sigue fuera: ampliar el alcance no es abrirlo.
    expect(personas).not.toContain('Persona de fuera');
  });
});
