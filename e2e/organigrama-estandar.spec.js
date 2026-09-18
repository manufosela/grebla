/**
 * Organigrama estándar (RMR-PCS-0042 · F1): la vista de quién reporta a quién
 * sobre /people, junto a la pirámide GREBLA. Cualquier empleado la ve, aunque
 * /people no sea legible para él: los datos llegan por la callable orgDirectory.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PEOPLE = {
  'e2e-org-ceo': { name: 'Paloma E2E', orgRole: 'ceo', orgBranch: 'generico', reportsToPersonId: null, active: true },
  'e2e-org-cto': { name: 'Mánu E2E', orgRole: 'cto', orgBranch: 'engineering', reportsToPersonId: 'e2e-org-ceo', active: true, notion: { role: 'CTO', department: 'Product', team: 'Core' } },
  'e2e-org-eng': { name: 'Ana E2E', orgRole: 'engineer', orgBranch: 'engineering', reportsToPersonId: 'e2e-org-cto', active: true, career: { level: 'L3' } },
  'e2e-org-lost': { name: 'Suelta E2E', orgRole: 'engineer', orgBranch: 'engineering', reportsToPersonId: 'e2e-org-baja', active: true },
  'e2e-org-baja': { name: 'Baja E2E', orgRole: 'engineer', reportsToPersonId: 'e2e-org-ceo', active: false },
};

test.beforeEach(async () => {
  for (const [id, data] of Object.entries(PEOPLE)) await db().doc(`people/${id}`).set(data);
});

test.afterEach(async () => {
  for (const id of Object.keys(PEOPLE)) await db().doc(`people/${id}`).delete();
});

test('la pestaña Estándar pinta a cada persona bajo quien le dirige, y nadie se pierde', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/organigrama');

  // La pirámide GREBLA sigue siendo la primera vista.
  await expect(page.locator('org-views').getByRole('tab', { name: 'Pirámide GREBLA' })).toHaveAttribute('aria-selected', 'true');
  await page.locator('org-views').getByRole('tab', { name: 'Estándar' }).click();

  const chart = page.locator('org-people-chart');
  const card = (id) => chart.locator(`[data-person-id="${id}"]`);
  await expect(card('e2e-org-ceo')).toContainText('Paloma E2E');
  await expect(card('e2e-org-cto')).toContainText('CTO'); // el puesto de Notion manda
  await expect(card('e2e-org-cto')).toContainText('Product · Core');
  await expect(card('e2e-org-eng')).toContainText('Ana E2E');
  // La baja no se pinta; quien reportaba a ella no entra en el árbol: va al
  // bloque de sin asignar, avisando (RMR-BUG-0126: los sueltos no ensanchan el árbol).
  await expect(card('e2e-org-baja')).toHaveCount(0);
  await expect(chart.locator('.loose').locator('[data-person-id="e2e-org-lost"]')).toContainText('Sin manager en el censo');
  await expect(chart.locator('zoom-port [data-person-id="e2e-org-lost"]')).toHaveCount(0);

  // Geometría: la CEO arriba, la CTO debajo, la ingeniera más abajo.
  const top = async (id) => (await card(id).boundingBox()).y;
  expect(await top('e2e-org-ceo')).toBeLessThan(await top('e2e-org-cto'));
  expect(await top('e2e-org-cto')).toBeLessThan(await top('e2e-org-eng'));

  // La callable no deja salir nada que no sea del organigrama.
  const html = await chart.evaluate((el) => el.shadowRoot.innerHTML);
  expect(html).not.toContain('L3');
  await expect(page).toHaveURL(/#estandar$/);
});

test('el visor del árbol se maximiza sobre sí mismo, con zoom y arrastre a mano', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/organigrama#estandar');
  const port = page.locator('org-people-chart zoom-port');
  await expect(port.getByRole('button', { name: 'Ver todo' })).toBeVisible();
  // La concesión real depende del navegador: se fija SOBRE QUÉ se pide.
  await port.evaluate((el) => { el.dataset.fs = ''; el.requestFullscreen = () => { el.dataset.fs = 'visor'; return Promise.resolve(); }; });
  await port.getByRole('button', { name: 'Pantalla completa' }).click();
  await expect(port).toHaveAttribute('data-fs', 'visor');
  // Acercar cambia la escala del lienzo.
  const escala = async () => port.evaluate((el) => el.shadowRoot.querySelector('.canvas').style.transform);
  const antes = await escala();
  await port.getByRole('button', { name: 'Acercar' }).click();
  expect(await escala()).not.toBe(antes);
});
