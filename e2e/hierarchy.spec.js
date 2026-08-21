/**
 * E2E de JERARQUÍA (RMR-TSK-0300). El acto central de montar una rama: el
 * superadmin asigna, desde el panel, a quién reporta una persona. Se verifica el
 * efecto real en Firestore (`reportsToPersonId`), no solo que el <select> cambie.
 * El `reportsTo` de /leaders ya no se toca a mano: es un espejo que deriva del
 * organigrama (RMR-PCS-0027), así que el acto de gestión vive en la persona.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test('el superadmin asigna el superior de una persona desde el panel', async ({ page }) => {
  const db = admin();

  await signInAs(page, 'superadmin');
  await page.goto('/admin');

  // «Persona del manager» arranca sin superior; se lo asignamos por la columna
  // «Reporta a» de su fila.
  const select = page.getByLabel('Superior de Persona del manager');
  await expect(select).toBeVisible();
  await select.selectOption({ label: 'Ingeniero E2E' });

  // El efecto se persiste en la ficha de la persona.
  await expect.poll(async () => {
    const d = (await db.doc('people/e2e-person-mgr').get()).data();
    return d?.reportsToPersonId ?? null;
  }, { timeout: 10_000 }).toBe('e2e-person-eng');
});
