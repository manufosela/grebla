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

test('el documento se VE dentro del visor, no solo el marco', async ({ page }) => {
  // El test anterior comprobaba el atributo `sandbox` del iframe y pasaba en
  // verde mientras en producción no se veía nada: el bucket no tenía CORS y la
  // descarga ni llegaba. Comprobar el marco no es comprobar el documento.
  await subir(DOCS[0].path, '<!doctype html><title>E2E</title><h1 id="marca">CONTENIDO VISIBLE</h1>');
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');
  await page.locator('[data-doc-id="e2e-grebla"]').click();

  const dentro = page.frameLocator('docs-reader iframe');
  await expect(dentro.locator('#marca')).toHaveText('CONTENIDO VISIBLE', { timeout: 15_000 });
});

test('el documento se ve desde OTRO origen: sus scripts no alcanzan el nuestro', async ({ page }) => {
  // Lo sirve la Cloud Function serveDoc con su propio origen (RMR-BUG-0124).
  // Un documento con un script no puede leer la sesión ni los datos de personas
  // de quien lo abre porque no está en nuestro origen. Quien publica es de
  // confianza, pero «de confianza» no es un control.
  await subir(DOCS[0].path, '<!doctype html><title>E2E</title><p id="marca">contenido');
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');

  await page.locator('[data-doc-id="e2e-grebla"]').click();
  const dentro = page.frameLocator('docs-reader iframe');
  await expect(dentro.locator('#marca')).toBeVisible({ timeout: 15_000 });

  const origenApp = await page.evaluate(() => location.origin);
  const marco = page.frames().find((f) => f.parentFrame() !== null);
  const origenDoc = await marco.evaluate(() => location.origin);
  expect(origenDoc).not.toBe(origenApp);
  expect(origenDoc).not.toBe('null');
  // El documento no navega esta pestaña ni la lee: sin allow-top-navigation y sin acceso al padre.
  const sandbox = await page.locator('docs-reader iframe').getAttribute('sandbox');
  expect(sandbox).not.toContain('allow-top-navigation');
  const padre = await marco.evaluate(() => { try { return String(window.parent.document.title); } catch { return 'cruzado'; } });
  expect(padre).toBe('cruzado');
});

test('la presentación se puede maximizar desde el visor', async ({ page }) => {
  await subir(DOCS[0].path, '<!doctype html><title>E2E</title><p>contenido');
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');
  await page.locator('[data-doc-id="e2e-grebla"]').click();

  const maximizar = page.locator('docs-reader').getByRole('button', { name: /Maximizar/ });
  await expect(maximizar).toBeVisible();
  await expect(page.locator('docs-reader iframe')).toHaveAttribute('allow', 'fullscreen');
  // Pulsarlo no rompe nada aunque el navegador no conceda la pantalla completa.
  await maximizar.click();
  await expect(page.locator('docs-reader .error')).toHaveCount(0);
});

test('abrir un documento no deja una URL de descarga permanente ni funciona con un token inventado', async ({ page }) => {
  // Con getDownloadURL el enlace llevaría un token reenviable para siempre. El
  // token de visionado es de un documento y caduca; y uno inventado es un 404.
  await subir(DOCS[0].path, '<!doctype html><title>E2E</title><p id="marca">contenido');
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');
  await page.locator('[data-doc-id="e2e-grebla"]').click();
  const marco = page.locator('docs-reader iframe');
  await expect(marco).toBeVisible({ timeout: 15_000 });

  const src = await marco.getAttribute('src');
  expect(src).not.toContain('firebasestorage');
  expect(src).not.toContain('token=');
  const inventado = src.replace(/[a-f0-9]{48}/, 'e'.repeat(48));
  const res = await page.request.get(inventado);
  expect(res.status()).toBe(404);
});

test('la vista del orador (tecla S) conecta con la presentación', async ({ page, context }) => {
  // reveal.js abre un about:blank, le escribe la vista del orador y esa vista
  // solo acepta mensajes cuyo origen coincide con el suyo, y solo si el origen
  // de su opener es el mismo. En un iframe aislado (blob URL, origen opaco) no
  // hay manera: a los 5 s salía «Error connecting to main window». El documento
  // de abajo imita ese apretón de manos.
  const deck = `<!doctype html><title>E2E</title><p id="deck">deck</p><script>
    addEventListener('keydown', (e) => {
      if (e.key !== 's') return;
      const w = window.open('about:blank', 'notas', 'width=600,height=400');
      w.document.write('<!doctype html><body data-state="esperando"><script>' +
        'let opener; try { opener = window.opener.location.origin; } catch { opener = "?"; }' +
        'if (opener !== location.origin) document.body.dataset.state = "origen distinto";' +
        'addEventListener("message", (ev) => { if (ev.origin === location.origin) document.body.dataset.state = "conectado"; });' +
        '<' + '/script>');
      setInterval(() => w.postMessage('connect', '*'), 200);
    });
  </script>`;
  await subir(DOCS[0].path, deck);
  await signInAs(page, 'engineer');
  await page.goto('/documentacion');
  await page.locator('[data-doc-id="e2e-grebla"]').click();

  const dentro = page.frameLocator('docs-reader iframe');
  await expect(dentro.locator('#deck')).toBeVisible({ timeout: 15_000 });
  await dentro.locator('#deck').click();
  const popupAbierto = context.waitForEvent('page');
  await dentro.locator('body').press('s');
  const notas = await popupAbierto;

  await expect(notas.locator('body')).toHaveAttribute('data-state', 'conectado', { timeout: 10_000 });
  // El popup vive en el origen del documento, no en el de GREBLA.
  const origenApp = await page.evaluate(() => location.origin);
  expect(await notas.evaluate(() => location.origin)).not.toBe(origenApp);
});
