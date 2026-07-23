/**
 * E2E de JERARQUÍA (RMR-TSK-0300). El acto central de montar una rama: el
 * superadmin asigna, desde el panel, a qué Head reporta un manager. Se verifica
 * el efecto real en Firestore (reportsTo), no solo que el <select> cambie.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test('el superadmin asigna un Head a un manager desde el panel', async ({ page }) => {
  const db = admin();

  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  // El líder «Sin Head E2E» arranca sin Head; el superadmin se lo asigna por la
  // columna «Reporta a» de la fila de ese manager.
  const select = page.getByLabel('Head al que reporta Sin Head E2E');
  await expect(select).toBeVisible();
  await select.selectOption({ label: 'Head E2E' });

  // El efecto se persiste: el manager pasa a reportar al Head.
  await expect.poll(async () => {
    const d = (await db.doc('leaders/e2e-unassigned').get()).data();
    return d?.reportsTo ?? null;
  }, { timeout: 10_000 }).toBe('e2e-head');
});
