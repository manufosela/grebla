/**
 * Gestor de documentos en Administración (RMR-PCS-0041).
 *
 * Desde RMR-TSK-0503 la subida pasa por la Cloud Function `publishDoc`: las
 * reglas de Storage ya no dejan escribir a ningún cliente, porque su forma de
 * comprobar el permiso —consultar Firestore desde la regla— no funciona en los
 * proyectos reales.
 *
 * Publicar un documento para toda la organización es gobierno, no uso: por eso
 * vive en Administración. Lo que se comprueba es el recorrido entero —subir,
 * verlo listado, retirarlo— y que lo que no es HTML se rechaza ANTES de subir
 * nada.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { test, expect, signInAs } from './fixtures.js';

const BUCKET = 'demo-grebla.appspot.com';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Documento E2E';

test.afterEach(async () => {
  const snap = await db().collection('docs').where('name', '>=', NOMBRE).get();
  await Promise.all(snap.docs.filter((d) => d.data().name.startsWith(NOMBRE)).map((d) => d.ref.delete()));
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

test('dos rutas distintas no acaban en la misma ficha', async ({ page }) => {
  // `docs/a-b.html` y `docs/a/b.html` daban el mismo id: el segundo pisaba la
  // ficha del primero y dejaba un fichero inalcanzable en Storage.
  await signInAs(page, 'superadmin');
  await page.goto('/admin/documentos');

  for (const [carpeta, fichero] of [['', 'a-b.html'], ['a', 'b.html']]) {
    await elegirFichero(page, { name: fichero, mimeType: 'text/html', buffer: Buffer.from('<p>x') });
    await page.locator('docs-manager input[type="text"]').first().fill(`${NOMBRE} ${carpeta || 'raiz'}`);
    await page.locator('docs-manager input[list="docs-folders"]').fill(carpeta);
    await page.locator('docs-manager button', { hasText: 'Publicar documento' }).click();
    await expect(page.locator('docs-manager .msg.ok')).toBeVisible({ timeout: 20_000 });
  }

  const snap = await db().collection('docs').where('name', '>=', NOMBRE).get();
  const rutas = snap.docs.map((d) => d.data().path).sort();
  expect(rutas).toEqual(['docs/a-b.html', 'docs/a/b.html']);
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

test('un cliente NO puede escribir en docs/ por su cuenta, aunque sea superadmin', async () => {
  // La única puerta de escritura es la Cloud Function. Se ataca la API de
  // Storage con el token de un superadmin real, que es lo que haría quien lo
  // intentara desde la consola del navegador. Si alguien vuelve a abrir la regla
  // «para simplificar», este test lo dice.
  const { token } = JSON.parse(readFileSync(new URL('./.auth/superadmin.json', import.meta.url), 'utf8'));
  const sesion = await (await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, returnSecureToken: true }) },
  )).json();
  expect(sesion.idToken, 'no se pudo firmar como superadmin').toBeTruthy();

  const res = await fetch(
    `http://127.0.0.1:9199/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent('docs/colado-a-mano.html')}`,
    { method: 'POST', headers: { authorization: `Bearer ${sesion.idToken}`, 'content-type': 'text/html' }, body: '<p>hola' },
  );

  expect(res.status, 'Storage dejó escribir a un cliente en docs/').toBe(403);
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
