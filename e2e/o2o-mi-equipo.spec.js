/**
 * O2O es de tu equipo (RMR-TSK-0647): ser superadmin no hace que tu equipo sea
 * toda la organización. Quien gobierna y además lleva equipo ve a su gente, no
 * a las 137 personas de la instancia.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs, markForWhom, hangFrom } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test('la lista de O2O sale del directorio, no de quién es el dueño de la ficha (RMR-TSK-0665)', async ({ page }) => {
  // Cuelga de adminmgr en el directorio; y otra que es suya pero no está en su rama.
  const limpiar = await hangFrom(db(), 'e2e-o2o-asignada', { name: 'Asignada por superadmin', active: true }, 'e2e-adminmgr');
  await db().doc('people/e2e-o2o-quitada').set({ name: 'Ya no es suya', ownerLeaderUid: 'e2e-adminmgr', active: true });
  try {
    await signInAs(page, 'adminmgr');
    await page.goto('/tools/o2o');
    await page.locator('o2o-app input[type="text"]').fill('Periodo asignados E2E');
    await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();
    const forWhom = page.locator('o2o-for-whom');
    await expect(forWhom.getByRole('checkbox', { name: /Asignada por superadmin/ })).toHaveCount(1);
    await expect(forWhom.getByRole('checkbox', { name: /Ya no es suya/ })).toHaveCount(0);
  } finally {
    await limpiar();
    await db().doc('people/e2e-o2o-quitada').delete();
  }
});

test('«Para quién»: la rama con los directos marcados; registrar solo ofrece a los marcados (RMR-TSK-0664)', async ({ page }) => {
  // Un directorio de verdad: el trigger calcula la rama desde reportsToPersonId.
  // La ficha de adminmgr va inactiva para no salir en ninguna lista.
  const rama = [
    ['e2e-rama-yo', { name: 'Ficha de adminmgr', uid: 'e2e-adminmgr', active: false, reportsToPersonId: null }],
    ['e2e-rama-jefa', { name: 'Rama Jefa', uid: 'e2e-rama-jefa-uid', active: true, reportsToPersonId: 'e2e-rama-yo' }],
    ['e2e-rama-dev', { name: 'Rama Dev', active: true, reportsToPersonId: 'e2e-rama-jefa' }],
  ];
  for (const [id, data] of rama) {
    await db().doc(`people/${id}`).set({ ...data, ownerLeaderUid: 'e2e-outsider-x' });
  }
  try {
    await expect.poll(async () => (await db().doc('people/e2e-rama-dev').get()).data()?.directoryManagerUids ?? [],
      { timeout: 20_000 }).toEqual(['e2e-rama-jefa-uid', 'e2e-adminmgr']);
    await signInAs(page, 'adminmgr');
    await page.goto('/tools/o2o');
    await page.locator('o2o-app input[type="text"]').fill('Periodo rama E2E');
    await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();

    const forWhom = page.locator('o2o-for-whom');
    await expect(forWhom.getByRole('checkbox', { name: 'Rama Jefa', exact: true })).toBeChecked();
    const dev = forWhom.getByRole('checkbox', { name: /Rama Dev \(de Rama Jefa\)/ });
    await expect(dev).not.toBeChecked();

    const options = page.locator('o2o-register select').first().locator('option');
    await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();
    await expect(options.filter({ hasText: 'Rama Jefa' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Rama Dev' })).toHaveCount(0);

    await markForWhom(page, 'Rama Dev');
    await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();
    await expect(options.filter({ hasText: 'Rama Dev' })).toHaveCount(1);
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

  const forWhom = page.locator('o2o-for-whom');
  await expect(forWhom.getByRole('checkbox', { name: /Persona del admin-manager/ })).toHaveCount(1);
  // La gente de otros managers no es suya.
  await expect(forWhom.getByRole('checkbox', { name: /Ingeniero E2E/ })).toHaveCount(0);
  await expect(forWhom.getByRole('checkbox', { name: /Persona de fuera/ })).toHaveCount(0);
});
