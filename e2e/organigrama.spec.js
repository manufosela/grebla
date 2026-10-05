/**
 * Organigrama (RMR-TSK-0617): una sola vista, la pirámide invertida de
 * PERSONAS. Con Notion, cada capa es un Level: C-level en la BASE (abajo),
 * IC en la cima. Cualquier empleado la ve aunque /people no sea legible para
 * él: los datos llegan por la callable orgDirectory, que no deja salir nada más.
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
  'e2e-org-em': { name: 'Mánu E2E', orgBranch: 'engineering', active: true, notion: { level: 'Manager', role: 'Engineering Manager' } },
  'e2e-org-eng': { name: 'Ana E2E', orgBranch: 'engineering', active: true, notion: { level: 'IC', role: 'Backend Engineer' }, career: { level: 'L3' } },
  'e2e-org-baja': { name: 'Baja E2E', orgBranch: 'engineering', active: false, notion: { level: 'IC', role: 'QA' } },
};

test.beforeEach(async () => {
  for (const [id, data] of Object.entries(PEOPLE)) await db().doc(`people/${id}`).set(data);
});

test.afterEach(async () => {
  for (const id of Object.keys(PEOPLE)) await db().doc(`people/${id}`).delete();
});

test('una sola vista: la pirámide de personas con la base abajo y el rol de cada una', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/organigrama');

  const chart = page.locator('org-people-pyramid');
  const card = (id) => chart.locator(`[data-person-id="${id}"]`);
  await expect(card('e2e-org-ceo')).toContainText('Paloma E2E');
  await expect(card('e2e-org-eng')).toContainText('Backend Engineer');
  await expect(chart.getByRole('region', { name: 'Base · C-level' })).toContainText('Paloma E2E');
  await expect(card('e2e-org-baja')).toHaveCount(0);
  await expect(page.locator('org-people-chart')).toHaveCount(0);

  // Invertida: la ingeniera (IC) arriba, el manager en medio, la CEO en la base.
  const top = async (id) => (await card(id).boundingBox()).y;
  expect(await top('e2e-org-eng')).toBeLessThan(await top('e2e-org-em'));
  expect(await top('e2e-org-em')).toBeLessThan(await top('e2e-org-ceo'));

  // La callable no deja salir nada que no sea del organigrama.
  const html = await chart.evaluate((el) => el.shadowRoot.innerHTML);
  expect(html).not.toContain('L3');
});
