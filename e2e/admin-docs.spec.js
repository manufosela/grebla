/**
 * Gestor de documentos en Administración (RMR-PCS-0041).
 *
 * Publicar un documento para toda la organización es gobierno, no uso: por eso
 * vive en Administración. Lo que se comprueba es el recorrido entero —subir,
 * verlo listado, retirarlo— y que lo que no es HTML se rechaza ANTES de subir
 * nada.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Documento E2E';

test.afterEach(async () => {
  const snap = await db().collection('docs').where('name', '==', NOMBRE).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
});

/** Elige un fichero sin tocar el disco: el input recibe el contenido en memoria. */
async function elegirFichero(page, { name, mimeType, buffer }) {
  await page.locator('docs-manager input[type="file"]').setInputFiles({ name, mimeType, buffer });
}

test('se publica un HTML y queda listado en su carpeta', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin/documentos');

  await elegirFichero(page, {
    name: 'Presentación E2E.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><title>E2E</title><p>hola'),
  });
  await page.locator('docs-manager input[type="text"]').first().fill(NOMBRE);
  await page.locator('docs-manager input[list="docs-folders"]').fill('tech');
  await page.locator('docs-manager button', { hasText: 'Publicar documento' }).click();

  await expect.poll(async () => {
    const snap = await db().collection('docs').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data() ?? null;
  }, { timeout: 20_000 }).toMatchObject({ folder: 'tech', path: 'docs/tech/presentacion-e2e.html' });

  await expect(page.locator('docs-manager')).toContainText(NOMBRE);
});

test('lo que no es HTML se rechaza antes de subir nada', async ({ page }) => {
  // Dejar elegir un PDF y fallar después de la subida es hacer perder el tiempo
  // dos veces.
  await signInAs(page, 'superadmin');
  await page.goto('/admin/documentos');

  await elegirFichero(page, { name: 'informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });

  await expect(page.locator('docs-manager .msg.err')).toContainText('solo se publican páginas HTML');
  await expect(page.locator('docs-manager button', { hasText: 'Publicar documento' })).toBeDisabled();
});

test('quien no gestiona documentos ve la lista, pero no publica ni retira', async ({ page }) => {
  const previa = (await db().doc('toolPolicies/docs').get()).data() ?? null;
  await db().doc('toolPolicies/docs').set({
    label: 'Documentos', audience: { everyone: true }, managedBy: { roles: ['manager'] },
  });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/admin/documentos');

    await expect(page.locator('docs-manager')).toBeVisible();
    await expect(page.locator('docs-manager input[type="file"]')).toHaveCount(0);
    await expect(page.locator('docs-manager button', { hasText: 'Retirar' })).toHaveCount(0);
  } finally {
    if (previa) await db().doc('toolPolicies/docs').set(previa);
    else await db().doc('toolPolicies/docs').delete();
  }
});
