/**
 * E2E del GOBIERNO y del SUPERIOR en la tabla de Personas
 * (RMR-TSK-0474 y RMR-TSK-0473).
 *
 * Gobierno: superadmin y viewer son excluyentes por modelo —lo fija el ADR
 * «Acceso en dos ejes»—, así que se eligen en un control de tres opciones y no
 * en dos controles que permitirían marcar ambas.
 *
 * Superior: puede serlo cualquiera con tanta o más responsabilidad, no solo
 * quien tenga el rol justo por encima. Las organizaciones reales tienen huecos.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const fila = (page, nombre) => page.locator('superadmin-panel tbody tr')
  .filter({ has: page.locator('td:nth-child(1)').filter({ hasText: nombre }) });

test('el gobierno se elige entre tres opciones excluyentes', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin#users');

  const suya = fila(page, 'Ingeniero E2E');
  const gobierno = suya.getByRole('radiogroup');
  await expect(gobierno.getByRole('radio')).toHaveCount(3);
  // Sin gobierno de partida.
  await expect(gobierno.getByRole('radio').first()).toBeChecked();

  try {
    await suya.getByRole('radio', { name: 'Viewer' }).click();
    await expect.poll(async () => (await db().doc('viewers/e2e-engineer').get()).exists,
      { timeout: 15_000 }).toBe(true);

    // Pasar a superadmin RETIRA el viewer: no pueden convivir.
    await suya.getByRole('radio', { name: 'Superadmin' }).click();
    await expect.poll(async () => ({
      admin: (await db().doc('admins/e2e-engineer').get()).exists,
      viewer: (await db().doc('viewers/e2e-engineer').get()).exists,
    }), { timeout: 15_000 }).toEqual({ admin: true, viewer: false });
  } finally {
    await db().doc('admins/e2e-engineer').delete();
    await db().doc('viewers/e2e-engineer').delete();
  }
});

test('gestionar encuestas ya no se concede aquí: es un permiso', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/admin#users');

  // Dejó de ser un rol suelto (RMR-TSK-0476): se da en Permisos, como el de
  // cualquier otra herramienta, así que no tiene control propio en la tabla.
  await expect(page.locator('superadmin-panel tbody')).not.toContainText('People (encuestas)');
  await expect(fila(page, 'Ingeniero E2E').getByRole('radiogroup')).not.toContainText('People');
});

test('se puede reportar a alguien con más responsabilidad aunque falte el rol de en medio', async ({ page }) => {
  // QA sin Head of QA: antes se quedaba sin candidatos.
  await db().doc('orgRoles/e2e-cto').set({ label: 'CTO E2E', branch: 'engineering', reportsToRoleId: null, layer: 0 });
  await db().doc('orgRoles/e2e-head-qa').set({ label: 'Head of QA E2E', branch: 'engineering', reportsToRoleId: 'e2e-cto', layer: 1 });
  await db().doc('orgRoles/e2e-qa').set({ label: 'QA E2E', branch: 'engineering', reportsToRoleId: 'e2e-head-qa', layer: 3 });
  await db().doc('people/e2e-cto-persona').set({ name: 'Directora de Tecnología', uid: null, ownerLeaderUid: 'e2e-manager', active: true, orgRole: 'e2e-cto' });
  await db().doc('people/e2e-qa-persona').set({ name: 'Persona de QA', uid: null, ownerLeaderUid: 'e2e-manager', active: true, orgRole: 'e2e-qa' });
  try {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#users');

    const selector = page.locator('superadmin-panel select[aria-label="Superior de Persona de QA"]');
    await expect(selector).toBeVisible();
    const opciones = await selector.locator('option').allInnerTexts();
    expect(opciones).toContain('Directora de Tecnología');
  } finally {
    for (const ref of ['people/e2e-qa-persona', 'people/e2e-cto-persona', 'orgRoles/e2e-qa', 'orgRoles/e2e-head-qa', 'orgRoles/e2e-cto']) {
      await db().doc(ref).delete();
    }
  }
});
