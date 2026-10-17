/**
 * Mi equipo es el organigrama (RMR-TSK-0747): sale quien te tiene por encima,
 * aunque su ficha la diera de alta otro, y NO sale quien está en el organigrama
 * bajo otra persona, aunque la ficha sea tuya. Así dejan de colarse personas de
 * otros departamentos en el equipo de un manager.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs, hangFrom } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const DEBAJO = 'Persona bajo el head E2E';
const AJENA = 'Persona de otra rama E2E';

test('Mi equipo enseña al organigrama, no a las fichas que uno creó', async ({ page }) => {
  const limpiarDebajo = await hangFrom(db(), 'e2e-equipo-debajo',
    { name: DEBAJO, uid: null, ownerLeaderUid: 'e2e-otro-manager', active: true }, 'e2e-head');
  const limpiarAjena = await hangFrom(db(), 'e2e-equipo-ajena',
    { name: AJENA, uid: null, ownerLeaderUid: 'e2e-head', active: true }, 'e2e-manager-ajeno');
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    await expect(page.getByRole('heading', { name: 'Mapa del equipo' })).toBeVisible();
    await expect(page.getByText(DEBAJO)).toBeVisible();
    await expect(page.getByText(AJENA)).toHaveCount(0);
  } finally {
    await limpiarDebajo();
    await limpiarAjena();
  }
});
