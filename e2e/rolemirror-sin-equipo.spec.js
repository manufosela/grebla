/**
 * E2E de Role Mirror SIN equipo (RMR-BUG-0110).
 *
 * La herramienta es de heteroevaluación: el manager define el perfil de su
 * gente. Pero su audiencia es toda la rama de ingeniería, así que cualquier
 * ingeniero puede entrar — y se encontraba un desplegable vacío y nada más, que
 * parece una app rota. Su Role Mirror propio está en Mi espacio.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return { db: getFirestore(), auth: getAuth() };
}

const SIN_EQUIPO = 'e2e-sin-equipo';

/**
 * Un ingeniero recién llegado, con su propia cuenta. No se usa el de las
 * fixtures porque otros specs le cuelgan gente al reasignar la jerarquía —y la
 * Cloud Function del espejo deriva `ownerLeaderUid`—, así que dejaría de estar
 * «sin equipo» según qué haya corrido antes.
 */
async function comoIngenieroSinEquipo(page) {
  const { db, auth } = admin();
  try { await auth.createUser({ uid: SIN_EQUIPO, email: 'sinequipo@e2e.test' }); }
  catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  await db.doc(`people/${SIN_EQUIPO}-persona`).set({
    name: 'Ingeniera Sin Equipo', uid: SIN_EQUIPO, ownerLeaderUid: 'e2e-manager',
    active: true, orgBranch: 'engineering',
  });
  const token = await auth.createCustomToken(SIN_EQUIPO);
  await page.goto('/login');
  await page.waitForFunction(() => typeof (window).__e2eSignIn === 'function');
  await page.evaluate((t) => (window).__e2eSignIn(t), token);
  await page.waitForFunction((u) => (window).__e2eUid?.() === u, SIN_EQUIPO, { timeout: 15_000 });
}

async function limpiarIngeniero() {
  const { db, auth } = admin();
  await db.doc(`people/${SIN_EQUIPO}-persona`).delete();
  await auth.deleteUser(SIN_EQUIPO).catch(() => {});
}

test('quien no tiene equipo ve una explicación, no un desplegable vacío', async ({ page }) => {
  await comoIngenieroSinEquipo(page);
  try {
    await page.goto('/tools/role-mirror');

    const aviso = page.locator('#rm-empty');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('no tienes ninguna asignada');
    // Y se le lleva a donde sí hay algo para él.
    await expect(aviso.getByRole('link', { name: /Mi Role Mirror/ })).toBeVisible();

    // Nada de elegir a nadie ni cuestionario suelto.
    await expect(page.locator('#rm-person-picker')).toBeHidden();
    await expect(page.locator('role-questionnaire')).toBeHidden();
  } finally {
    await limpiarIngeniero();
  }
});

test('quien sí tiene equipo mantiene su selector de siempre', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/role-mirror');

  await expect(page.locator('#rm-person-picker')).toBeVisible();
  await expect(page.locator('#rm-empty')).toBeHidden();
  // Con personas de verdad dentro.
  await expect.poll(async () => page.locator('#rm-person option').count(), { timeout: 15_000 })
    .toBeGreaterThan(1);
});
