/**
 * Utilidades compartidas de los E2E (RMR-TSK-0299). `signInAs` canjea el custom
 * token de un rol (lo dejó el global-setup) por una sesión real del SDK, usando
 * la puerta window.__e2eSignIn que la app expone SOLO en modo emulador. Así los
 * tests entran como cualquier rol sin pasar por el login de Google.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test as base, expect } from '@playwright/test';

const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '.auth');

/** @param {import('@playwright/test').Page} page @param {'superadmin'|'head'|'engineer'} role */
export async function signInAs(page, role) {
  const { token, uid } = JSON.parse(readFileSync(join(AUTH_DIR, `${role}.json`), 'utf8'));
  // /login carga el SDK, así que ahí existe la puerta de test.
  await page.goto('/login');
  await page.waitForFunction(() => typeof (window).__e2eSignIn === 'function');
  await page.evaluate((t) => (window).__e2eSignIn(t), token);
  // Señal REAL de sesión: esperar a que el SDK tenga fijado ESE uid antes de
  // navegar a la ruta protegida (si no, el test correría contra un auth a medias).
  await page.waitForFunction((expected) => (window).__e2eUid?.() === expected, uid);
}

/**
 * Marca a una persona en «Para quién» del O2O abierto (RMR-TSK-0664) y espera a
 * que se guarde: sin marcar, no sale al registrar.
 * @param {import('@playwright/test').Page} page @param {string} name
 */
export async function markForWhom(page, name) {
  await page.locator('o2o-app').getByRole('tab', { name: 'Para quién' }).click();
  const box = page.locator('o2o-for-whom').getByRole('checkbox', { name });
  await box.check();
  await expect(box).toBeChecked();
  await expect(page.locator('o2o-app busy-overlay')).toHaveCount(0);
}

/**
 * Cuelga a una persona de `bossUid` en el directorio (RMR-TSK-0665): crea la
 * ficha de esa cuenta (inactiva, para no salir en ninguna lista) y espera a que
 * el trigger calcule la rama. Devuelve la limpieza de las dos fichas.
 * @param {FirebaseFirestore.Firestore} db @param {string} personId
 * @param {Record<string, unknown>} data @param {string} bossUid
 * @returns {Promise<() => Promise<void>>}
 */
export async function hangFrom(db, personId, data, bossUid) {
  const bossId = `e2e-ficha-${bossUid}`;
  const bossRef = db.doc(`people/${bossId}`);
  // Puede venir ya del global-setup; entonces no es de este test y no se borra.
  const created = !(await bossRef.get()).exists;
  // Dar cuenta a una ficha con gente a cargo la hace líder (RMR-TSK-0660): si
  // no lo era, se le quita al acabar, o los tests siguientes la verían líder.
  const leaderRef = db.doc(`leaders/${bossUid}`);
  const wasLeader = (await leaderRef.get()).exists;
  // Su superior no existe: así el espejo /leaders respeta el reportsTo de la cuenta.
  if (created) await bossRef.set({ name: `Ficha de ${bossUid}`, uid: bossUid, active: false, reportsToPersonId: 'e2e-sin-ficha' });
  await db.doc(`people/${personId}`).set({ ...data, reportsToPersonId: bossId });
  await expect.poll(async () => (await db.doc(`people/${personId}`).get()).data()?.directoryManagerUids ?? [],
    { timeout: 20_000 }).toEqual([bossUid]);
  return async () => {
    await db.doc(`people/${personId}`).delete();
    if (created) await bossRef.delete();
    if (!wasLeader) await leaderRef.delete();
  };
}

/** Texto que solo aparece en la pantalla de login: si sale, es que te expulsaron. */
export const LOGIN_MARKER = 'Usa tu cuenta de Google';

export const test = base;
export { expect };
