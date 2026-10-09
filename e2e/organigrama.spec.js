/**
 * Organigrama (RMR-TSK-0671): el árbol invertido de cada rama. C-level en la
 * BASE (abajo), los mandos encima y arriba cada equipo con su número de
 * personas. Cualquier empleado lo ve aunque /people no sea legible para él: los
 * datos llegan por la callable orgDirectory, que no deja salir nada más.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PEOPLE = {
  'e2e-org-ceo': { name: 'Paloma E2E', orgBranch: 'generico', active: true, notion: { level: 'C-level', role: 'CEO' } },
  'e2e-org-em': { name: 'Mánu E2E', orgBranch: 'engineering', active: true, reportsToPersonId: 'e2e-org-ceo', notion: { level: 'Manager', role: 'Engineering Manager' } },
  'e2e-org-eng': { name: 'Ana E2E', orgBranch: 'engineering', active: true, reportsToPersonId: 'e2e-org-em', notion: { level: 'Individual Contributor', role: 'Backend Engineer', team: 'Backend E2E' }, career: { level: 'L3' } },
  'e2e-org-eng2': { name: 'Bea E2E', orgBranch: 'engineering', active: true, reportsToPersonId: 'e2e-org-em', notion: { level: 'Individual Contributor', team: 'Backend E2E' } },
  'e2e-org-baja': { name: 'Baja E2E', orgBranch: 'engineering', active: false, reportsToPersonId: 'e2e-org-em', notion: { level: 'Individual Contributor', team: 'QA E2E' } },
};

const BRANCHES = { engineering: { label: 'Tech', color: '#2a9d8f' }, generico: { label: 'Dirección', color: '#457b9d' } };

test.beforeEach(async () => {
  for (const [id, data] of Object.entries(PEOPLE)) await db().doc(`people/${id}`).set(data);
  for (const [id, data] of Object.entries(BRANCHES)) await db().doc(`orgBranches/${id}`).set(data);
});

test.afterEach(async () => {
  for (const id of Object.keys(PEOPLE)) await db().doc(`people/${id}`).delete();
  for (const id of Object.keys(BRANCHES)) await db().doc(`orgBranches/${id}`).delete();
});

test('el árbol de tu rama: los equipos arriba con su número de personas; toda la casa con la base abajo', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/organigrama');

  const chart = page.locator('org-branch-chart');
  const card = (id) => chart.locator(`[data-person-id="${id}"]`);
  const team = chart.locator('[data-team="Backend E2E"]');
  // Se abre en la rama de quien entra: la CEO, de otra rama, no sale.
  await expect(chart.getByRole('button', { name: 'Tech', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(card('e2e-org-em')).toContainText('Engineering Manager');
  await expect(team).toContainText('2 personas');
  await expect(card('e2e-org-ceo')).toHaveCount(0);
  await expect(card('e2e-org-eng')).toHaveCount(0);
  await expect(chart.locator('[data-team="QA E2E"]')).toHaveCount(0);

  await chart.getByRole('button', { name: 'Toda la casa' }).click();
  await expect(card('e2e-org-ceo')).toContainText('Paloma E2E');
  // Invertida: el equipo arriba, el manager en medio, la CEO en la base.
  const top = async (loc) => (await loc.boundingBox()).y;
  expect(await top(team)).toBeLessThan(await top(card('e2e-org-em')));
  expect(await top(card('e2e-org-em'))).toBeLessThan(await top(card('e2e-org-ceo')));
  await expect(chart.locator('zoom-port').getByRole('button', { name: 'Ver todo' })).toBeVisible();

  // La callable no deja salir nada que no sea del organigrama.
  const html = await chart.evaluate((el) => el.shadowRoot.innerHTML);
  expect(html).not.toContain('L3');
});
