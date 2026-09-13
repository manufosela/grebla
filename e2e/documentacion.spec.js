/**
 * Leer la documentación (RMR-PCS-0041).
 *
 * Lo que se defiende aquí es la razón de todo el montaje: el contenido es
 * interno. Se lee con sesión y pasando por las reglas de Storage, y NO se
 * genera una URL que alguien pueda reenviar a quien no tiene cuenta.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { test, expect, signInAs } from './fixtures.js';

const BUCKET = 'demo-grebla.appspot.com';

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla', storageBucket: BUCKET });
}

function db() {
  admin();
  return getFirestore();
}

/** Sube el contenido de un documento al emulador de Storage. */
async function subir(path, html) {
  admin();
  await getStorage().bucket(BUCKET).file(path).save(html, { contentType: 'text/html' });
}

const DOCS = [
  { id: 'e2e-grebla', name: 'GREBLA E2E', description: 'El marco', folder: '', path: 'docs/e2e-grebla.html' },
  { id: 'e2e-tech', name: 'Plan Tech E2E', description: 'La organización', folder: 'tech', path: 'docs/tech/e2e-tech.html' },
];

/**
 * La política se siembra AQUÍ y no en el arranque global: el gate de
 * herramientas solo filtra cuando existe alguna política, así que dejar una
 * suelta en /toolPolicies activaría el filtrado para TODAS las herramientas y
 * el resto de la suite se quedaría sin acceso a nada.
 */
test.beforeEach(async () => {
  await db().doc('toolPolicies/docs').set({ label: 'Documentación', audience: { everyone: true }, managedBy: {} });
  for (const doc of DOCS) await db().doc(`docs/${doc.id}`).set(doc);
});

test.afterEach(async () => {
  await db().doc('toolPolicies/docs').delete();
  for (const doc of DOCS) await db().doc(`docs/${doc.id}`).delete();
});

test('cualquiera con sesión llega a la documentación desde el hub', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/');

  const tarjeta = page.locator('.tool-card', { hasText: 'Documentación' });
  await expect(tarjeta).toBeVisible();
  await tarjeta.click();
  await expect(page).toHaveURL(/\/documentacion/);
});

test('la lista agrupa por carpeta y dice qué es cada documento', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');

  await expect(page.locator('[data-doc-id="e2e-grebla"]')).toContainText('El marco');
  await expect(page.locator('[data-doc-id="e2e-tech"]')).toContainText('La organización');
  // El de la carpeta va bajo su rótulo; el del primer nivel, no.
  const carpetas = await page.locator('docs-reader')
    .evaluate((el) => [...(el.shadowRoot?.querySelectorAll('.folder h2') ?? [])].map((h) => h.textContent.trim()));
  expect(carpetas).toEqual(['tech']);
});

test('sin sesión no se llega a la lista', async ({ page }) => {
  await page.goto('/documentacion');
  await expect(page.locator('body')).toContainText('Usa tu cuenta de Google');
});

test('el documento se ve en un visor AISLADO, sin acceso a nuestro origen', async ({ page }) => {
  // Un blob URL hereda el origen de la aplicación: sin sandbox, un documento con
  // un script podría leer la sesión y los datos de personas de quien lo abre.
  // Quien publica es de confianza, pero «de confianza» no es un control.
  await subir(DOCS[0].path, '<!doctype html><title>E2E</title><p>contenido');
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');

  await page.locator('[data-doc-id="e2e-grebla"]').click();
  const marco = page.locator('docs-reader iframe');
  await expect(marco).toBeVisible({ timeout: 15_000 });
  const sandbox = await marco.getAttribute('sandbox');

  expect(sandbox).toContain('allow-scripts');
  expect(sandbox).not.toContain('allow-same-origin');
});

test('abrir un documento no deja una URL que funcione sin sesión', async ({ page }) => {
  // Con getDownloadURL el enlace llevaría un token reenviable, y el documento
  // dejaría de ser interno en cuanto alguien copiara la URL.
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');

  const enlaces = await page.locator('docs-reader').evaluate(
    (el) => [...(el.shadowRoot?.querySelectorAll('a[href]') ?? [])].map((a) => a.getAttribute('href')),
  );
  expect(enlaces.filter((h) => h?.includes('firebasestorage') || h?.includes('token='))).toEqual([]);
});
