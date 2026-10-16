/**
 * Ficha › Role Mirror (RMR-TSK-0734): el manager ve y gestiona el perfil de la
 * persona desde su ficha, con el mismo componente que la administración.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs, hangFrom } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSONA = 'e2e-person-rm-ficha';
const NOMBRE = 'Rita Role Mirror E2E';

test('la ficha de alguien de ingeniería tiene su Role Mirror', async ({ page }) => {
  const limpiar = await hangFrom(db(), PERSONA, { name: NOMBRE, active: true, orgBranch: 'engineering' }, 'e2e-head');
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: `Abrir ficha de ${NOMBRE}` }).click().catch(async () => {
      await page.getByText(NOMBRE).first().click();
    });
    const ficha = page.locator('team-person-detail');
    await ficha.getByRole('tab', { name: 'Role Mirror' }).click();
    const rm = ficha.locator('rm-person');
    await expect(rm.getByRole('heading', { name: NOMBRE })).toBeVisible();
    await expect(rm).toContainText('Todavía sin perfil definido.');
    await expect(rm.getByRole('tab', { name: 'Perfil que cuenta' })).toHaveAttribute('aria-selected', 'true');
  } finally {
    await limpiar();
  }
});
