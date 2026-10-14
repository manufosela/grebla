/**
 * Editor del EM por equipo (RMR-TSK-0717): el superadmin elige el EM de un
 * equipo de Tech en Organigrama › EM por equipo y se guarda en /config/org.teamEms.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const tech = (name, level, team) => ({ name, active: true, orgBranch: 'engineering', notion: { level, team } });

test('el superadmin asigna el EM de un equipo (RMR-TSK-0717)', async ({ page }) => {
  const config = db().doc('config/org');
  const previo = (await config.get()).data()?.teamEms ?? null;
  try {
    await db().doc('people/e2e-teqed-em').set(tech('Manager EM-equipo E2E', 'Manager', 'E2E-Otro'));
    await db().doc('people/e2e-teqed-dev').set(tech('Dev EM-equipo E2E', 'Individual Contributor', 'E2E-Equipo'));
    await signInAs(page, 'superadmin');
    await page.goto('/admin/organizacion#organigrama');
    const panel = page.locator('superadmin-panel');
    await panel.getByRole('button', { name: 'EM por equipo' }).click();
    const editor = panel.locator('team-ems-editor');
    await editor.getByLabel('E2E-Equipo').selectOption({ label: 'Manager EM-equipo E2E' });
    await editor.getByRole('button', { name: 'Guardar' }).click();
    await expect(editor.getByRole('status')).toContainText('Guardado');    await expect.poll(async () => (await config.get()).data()?.teamEms?.['E2E-Equipo']).toBe('e2e-teqed-em');
  } finally {
    await config.set({ teamEms: previo ?? FieldValue.delete() }, { merge: true });
    await db().doc('people/e2e-teqed-em').delete();
    await db().doc('people/e2e-teqed-dev').delete();
  }
});
