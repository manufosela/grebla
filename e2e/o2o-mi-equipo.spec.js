/**
 * O2O es de tu equipo (RMR-TSK-0647): ser superadmin no hace que tu equipo sea
 * toda la organización. Quien gobierna y además lleva equipo ve a su gente, no
 * a las 137 personas de la instancia.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test('la lista de O2O sale de los managers asignados, no de quién es el dueño (RMR-TSK-0655)', async ({ page }) => {
  // Asignada a adminmgr aunque su dueño sea otro; y una suya donde ya no está.
  await db().doc('people/e2e-o2o-asignada').set({ name: 'Asignada por superadmin', ownerLeaderUid: 'e2e-outsider-x', o2oManagerUids: ['e2e-adminmgr'], active: true });
  await db().doc('people/e2e-o2o-quitada').set({ name: 'Ya no es suya', ownerLeaderUid: 'e2e-adminmgr', o2oManagerUids: [], active: true });
  try {
    await signInAs(page, 'adminmgr');
    await page.goto('/tools/o2o');
    await page.locator('o2o-app input[type="text"]').fill('Periodo asignados E2E');
    await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();
    await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();
    const options = page.locator('o2o-register').getByRole('combobox', { name: 'Persona', exact: true }).locator('option');
    await expect(options.filter({ hasText: 'Asignada por superadmin' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Ya no es suya' })).toHaveCount(0);
  } finally {
    await db().doc('people/e2e-o2o-asignada').delete();
    await db().doc('people/e2e-o2o-quitada').delete();
  }
});

test('la rama del directorio entra en la lista y se filtra por gremio y por nombre (RMR-TSK-0662)', async ({ page }) => {
  const rama = [
    ['e2e-rama-ios', { name: 'Rama iOS Ñandú', guilds: ['iOS'] }],
    ['e2e-rama-php', { name: 'Rama PHP', guilds: ['Backend PHP'] }],
  ];
  for (const [id, data] of rama) {
    await db().doc(`people/${id}`).set({ ...data, ownerLeaderUid: 'e2e-outsider-x', directoryManagerUids: ['e2e-adminmgr'], active: true });
  }
  try {
    await signInAs(page, 'adminmgr');
    await page.goto('/tools/o2o');
    await page.locator('o2o-app input[type="text"]').fill('Periodo rama E2E');
    await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();
    await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();

    const register = page.locator('o2o-register');
    const options = register.getByRole('combobox', { name: 'Persona', exact: true }).locator('option');
    await expect(options.filter({ hasText: 'Rama iOS' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Rama PHP' })).toHaveCount(1);

    const group = register.getByRole('combobox', { name: 'Grupo', exact: true });
    await group.selectOption({ label: 'Gremio · iOS (1)' });
    await expect(options.filter({ hasText: 'Rama PHP' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Rama iOS' })).toHaveCount(1);

    await group.selectOption({ index: 0 });
    await register.getByRole('textbox', { name: 'Buscar' }).fill('nandu');
    await expect(options.filter({ hasText: 'Rama' })).toHaveCount(1);
    await register.getByRole('combobox', { name: 'Persona', exact: true }).selectOption({ label: 'Rama iOS Ñandú' });
    await expect(register.getByRole('button', { name: '+ Nuevo O2O' })).toBeVisible();
  } finally {
    for (const [id] of rama) await db().doc(`people/${id}`).delete();
  }
});

test('un superadmin con equipo solo ve a su gente al registrar un O2O', async ({ page }) => {
  // adminmgr gobierna la instancia y lleva equipo: «Persona del admin-manager».
  await signInAs(page, 'adminmgr');
  await page.goto('/tools/o2o');
  await page.locator('o2o-app input[type="text"]').fill('Periodo mi equipo E2E');
  await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();
  await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();

  const options = page.locator('o2o-register').getByRole('combobox', { name: 'Persona', exact: true }).locator('option');
  await expect(options.filter({ hasText: 'Persona del admin-manager' })).toHaveCount(1);
  // La gente de otros managers no es suya.
  await expect(options.filter({ hasText: 'Ingeniero E2E' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Persona de fuera' })).toHaveCount(0);
});
