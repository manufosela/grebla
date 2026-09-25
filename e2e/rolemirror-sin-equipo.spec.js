/**
 * E2E de Role Mirror SIN equipo (RMR-BUG-0110 · RMR-TSK-0562).
 *
 * La puerta de la herramienta era la pantalla de heteroevaluación: un manager
 * definiendo el perfil de su gente. Pero su audiencia es toda la rama de
 * ingeniería, así que cualquier ingeniero entraba y se encontraba un desplegable
 * vacío y nada más, que parece una app rota; lo suyo estaba escondido en «Mi
 * espacio». Desde RMR-TSK-0562 la puerta es el perfil propio, así que tener o no
 * gente a cargo ya no decide lo que ves al entrar.
 *
 * Queda una pantalla que sí puede quedarse sin nada que enseñar: la de quien ha
 * entrado con cuenta pero todavía no tiene ficha. Eso se dice; no se le deja un
 * cuestionario que no guardaría en ningún sitio.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect } from './fixtures.js';

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
async function comoIngenieroSinEquipo(page, { conFicha = true } = {}) {
  const { db, auth } = admin();
  try { await auth.createUser({ uid: SIN_EQUIPO, email: 'sinequipo@e2e.test' }); }
  catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  if (conFicha) {
    await db.doc(`people/${SIN_EQUIPO}-persona`).set({
      name: 'Ingeniera Sin Equipo', uid: SIN_EQUIPO, ownerLeaderUid: 'e2e-manager',
      active: true, orgBranch: 'engineering',
    });
  }
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

test('quien no tiene equipo entra a lo suyo, no a la pantalla de otro', async ({ page }) => {
  await comoIngenieroSinEquipo(page);
  try {
    await page.goto('/tools/role-mirror');

    // Su propio perfil, sin depender de tener gente a cargo.
    await expect(page.locator('role-questionnaire')).toBeVisible();
    await expect(page.locator('#rm-self-empty')).toBeHidden();
    // Y sin la puerta de administración, que no gestiona la herramienta.
    await expect(page.locator('#rm-nav-admin')).toBeHidden();
  } finally {
    await limpiarIngeniero();
  }
});

test('sin ficha se explica, en vez de dejar un cuestionario que no guarda nada', async ({ page }) => {
  await comoIngenieroSinEquipo(page, { conFicha: false });
  try {
    await page.goto('/tools/role-mirror');

    const aviso = page.locator('#rm-self-empty');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Todavía no tienes ficha');
    await expect(page.locator('role-questionnaire')).toBeHidden();
  } finally {
    await limpiarIngeniero();
  }
});
