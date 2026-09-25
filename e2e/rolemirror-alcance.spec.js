/**
 * E2E del ALCANCE del Role Mirror (RMR-BUG-0107). La lista de personas pedía
 * solo `leaderUid`, así que incluía únicamente a quien te reporta de forma
 * DIRECTA: un superadmin no veía a toda la organización y un Head no llegaba a
 * la gente que cuelga de sus managers. Parecía hacer falta gobierno de instancia
 * para consultar a alguien de tu propia rama, y el modelo ya lo resolvía.
 *
 * Desde RMR-TSK-0562 esa lista vive en la ADMINISTRACIÓN de la herramienta: la
 * puerta es el perfil propio. El alcance que se comprueba aquí es el mismo.
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
    name: 'Persona de la rama RM', uid: null, ownerLeaderUid: 'e2e-rm-mgr', active: true, orgBranch: 'engineering',
  });
  try { await fn(); } finally {
    await db().doc('people/e2e-rm-persona').delete();
    await db().doc('leaders/e2e-rm-mgr').delete();
  }
}

/**
 * Gestionar la herramienta sin gobernar la instancia: es lo que le hace falta al
 * Head para entrar en la administración, y lo que aquí se prueba es su ALCANCE,
 * no su permiso.
 */
async function conPoliticaGestionada(fn) {
  const previa = (await db().doc('toolPolicies/rolemirror').get()).data() ?? null;
  await db().doc('toolPolicies/rolemirror').set({
    label: 'Role Mirror', audience: { branches: ['engineering'] }, managedBy: { everyone: true },
  });
  try { await fn(); } finally {
    if (previa) await db().doc('toolPolicies/rolemirror').set(previa);
    else await db().doc('toolPolicies/rolemirror').delete();
  }
}

/** Nombres de la lista de personas de la administración. */
async function personasOfrecidas(page) {
  await page.goto('/tools/role-mirror/admin');
  const lista = page.locator('rm-admin .side');
  await expect(lista).toBeVisible();
  await expect.poll(async () => lista.locator('.person .name').count(), { timeout: 15_000 }).toBeGreaterThan(0);
  return lista.locator('.person .name').allInnerTexts();
}

test('el superadmin ve a toda la organización, como en el resto de herramientas', async ({ page }) => {
  await signInAs(page, 'superadmin');
  const personas = await personasOfrecidas(page);

  // Gente de ramas distintas, ninguna colgando del superadmin.
  expect(personas).toEqual(expect.arrayContaining(['Ingeniero E2E', 'Persona del manager', 'Persona de fuera']));
});

test('un head llega a su rama entera, sin ser superadmin', async ({ page }) => {
  await conRamaPropia(() => conPoliticaGestionada(async () => {
    await signInAs(page, 'head');
    const personas = await personasOfrecidas(page);

    // Cuelga de un manager que reporta al head: es su rama, aunque no le
    // reporte a él directamente.
    expect(personas).toContain('Persona de la rama RM');
    // Y lo de fuera de su rama sigue fuera: ampliar el alcance no es abrirlo.
    expect(personas).not.toContain('Persona de fuera');
  }));
});
