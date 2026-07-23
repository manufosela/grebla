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

/** Texto que solo aparece en la pantalla de login: si sale, es que te expulsaron. */
export const LOGIN_MARKER = 'Usa tu cuenta de Google';

export const test = base;
export { expect };
