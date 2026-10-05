/**
 * E2E del gremio PRINCIPAL (RMR-TSK-0594).
 *
 * Militar en dos gremios es normal; contar dos veces a la misma persona, no. El
 * principal es el que manda al agrupar por gremio. Lo que se fija aquí es lo que
 * se ve: con un solo gremio no se pregunta nada, con dos se pregunta y —mientras
 * no haya respuesta— se DICE que falta, en vez de elegir por el usuario.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const GUILDS = ['e2e-g-front', 'e2e-g-qa'];

/** Siembra dos gremios de catálogo y una persona propia del head. */
async function conDosGremios(fn, { guilds = [] } = {}) {
  await db().doc('guilds/e2e-g-front').set({ name: 'E2E Frontend' });
  await db().doc('guilds/e2e-g-qa').set({ name: 'E2E QA' });
  // Los gremios son de los departamentos que los tienen (RMR-TSK-0593): la
  // persona es de uno así, como en Tech.
  await db().doc('orgBranches/e2e-tech').set({ label: 'E2E Tech', hasGuilds: true });
  const suya = db().doc('people/e2e-person-gremio');
  await suya.set({ name: 'Persona de gremios E2E', uid: null, ownerLeaderUid: 'e2e-head', active: true, guilds, orgBranch: 'e2e-tech' });
  try {
    await fn(suya);
  } finally {
    await suya.delete();
    await db().doc('orgBranches/e2e-tech').delete();
    for (const id of GUILDS) await db().doc(`guilds/${id}`).delete();
  }
}

/** Abre la ficha de la persona sembrada en Organización › Gremios. */
async function abrirGremios(page) {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: 'Personas' }).first().click();
  await page.getByRole('row', { name: /Persona de gremios E2E/ }).getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('tab', { name: 'Organización' }).click();
  await page.getByRole('tab', { name: 'Gremios' }).click();
}

test('con un solo gremio no se pregunta cuál es el principal', async ({ page }) => {
  await conDosGremios(async () => {
    await abrirGremios(page);
    await expect(page.getByRole('checkbox', { name: 'E2E Frontend' })).toBeChecked();
    // No hay elección posible: preguntarla sería preguntar por algo ya sabido.
    await expect(page.getByRole('group', { name: 'Gremio principal' })).toHaveCount(0);
  }, { guilds: ['E2E Frontend'] });
});

test('con dos gremios se pregunta, se avisa si falta y se guarda el elegido', async ({ page }) => {
  await conDosGremios(async (suya) => {
    await abrirGremios(page);
    const bloque = page.getByRole('group', { name: 'Gremio principal' });
    await expect(bloque).toBeVisible();
    // Mientras no haya elegido, se dice — no se rellena por él.
    await expect(bloque.getByText(/Sin elegir/)).toBeVisible();

    await bloque.getByRole('radio', { name: 'E2E QA' }).check();
    await expect(bloque.getByText(/Sin elegir/)).toHaveCount(0);
    await page.getByRole('button', { name: /Guardar/ }).first().click();

    await expect.poll(async () => (await suya.get()).data()?.primaryGuild ?? null, { timeout: 15_000 })
      .toBe('E2E QA');
  }, { guilds: ['E2E Frontend', 'E2E QA'] });
});

test('al quitarle el gremio que era principal, deja de serlo', async ({ page }) => {
  await conDosGremios(async (suya) => {
    await suya.set({ ...(await suya.get()).data(), primaryGuild: 'E2E QA' });
    await abrirGremios(page);
    await page.getByRole('checkbox', { name: 'E2E QA' }).uncheck();
    await page.getByRole('button', { name: /Guardar/ }).first().click();

    // Conservarlo contaría a la persona en un gremio al que ya no pertenece.
    await expect.poll(async () => (await suya.get()).data()?.primaryGuild ?? null, { timeout: 15_000 })
      .toBe('E2E Frontend');
  }, { guilds: ['E2E Frontend', 'E2E QA'] });
});
