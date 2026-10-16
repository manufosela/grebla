/**
 * El resumen del mapa de carrera (RMR-TSK-0735): la persona lo ve en Mi espacio
 * en primera persona y con la puerta al juego; es el mismo <career-map-summary>
 * que verá su manager en la ficha.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs, hangFrom } from './fixtures.js';
import { seedCareerMap } from '../src/tools/career/data/maps.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const JOURNEY = 'people/e2e-person-eng/career/journey';
const [primera, segunda] = seedCareerMap().cities;

test('Mi espacio enseña mi mapa: casa actual, dominadas y mi ruta', async ({ page }) => {
  await db().doc(JOURNEY).set({ currentCity: primera.id, visitedCities: [primera.id], plannedRoute: [segunda.id] });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#carrera');
    const espacio = page.locator('engineer-space');
    await espacio.getByRole('tab', { name: 'Mapa' }).click();
    const mapa = espacio.locator('career-map-summary');
    await expect(mapa).toContainText('Mi isla actual');
    await expect(mapa).toContainText('Casas dominadas (1)');
    await expect(mapa).toContainText('Tu ruta');
    await expect(mapa.locator('ol.route')).toContainText(segunda.name);
    await expect(mapa.getByRole('link', { name: /jugar en 3D/ })).toBeVisible();
  } finally {
    await db().doc(JOURNEY).delete();
  }
});

test('su manager ve el mismo mapa en la ficha › Carrera › Mapa, sin jugarlo (RMR-TSK-0736)', async ({ page }) => {
  await db().doc(JOURNEY).set({ currentCity: primera.id, visitedCities: [primera.id], plannedRoute: [segunda.id] });
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: 'Abrir Carrera de Ingeniero E2E' }).click();
    const ficha = page.locator('team-person-detail');
    await ficha.getByRole('tab', { name: 'Mapa' }).click();
    const mapa = ficha.locator('career-map-summary');
    await expect(mapa).toContainText('Su isla actual');
    await expect(mapa).toContainText('Su ruta');
    await expect(mapa.locator('ol.route')).toContainText(segunda.name);
    await expect(mapa.getByRole('link', { name: /jugar/ })).toHaveCount(0);
  } finally {
    await db().doc(JOURNEY).delete();
  }
});

test('quien la lleva le recomienda una casa con su nota y la retira mientras no decida (RMR-TSK-0739)', async ({ page }) => {
  const PERSONA = 'e2e-person-reco';
  const NOMBRE = 'Rosa Recomendada E2E';
  const limpiar = await hangFrom(db(), PERSONA, { name: NOMBRE, active: true, orgBranch: 'engineering' }, 'e2e-head');
  await db().doc(`people/${PERSONA}/career/journey`).set({ currentCity: primera.id, visitedCities: [primera.id], plannedRoute: [] });
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
    const ficha = page.locator('team-person-detail');
    await ficha.getByRole('tab', { name: 'Mapa' }).click();
    const reco = ficha.locator('career-recommend');
    await reco.getByRole('radio', { name: 'Una casa' }).check();
    await reco.getByRole('combobox', { name: 'Casa' }).selectOption({ label: segunda.name });
    await reco.getByRole('textbox', { name: /Nota/ }).fill('Te prepara para el siguiente nivel');
    await reco.getByRole('button', { name: 'Recomendar' }).click();
    const item = reco.locator('li', { hasText: segunda.name });
    await expect(item).toContainText('Pendiente de que decida');
    await expect(item).toContainText('Te prepara para el siguiente nivel');
    await item.getByRole('button', { name: 'Retirar' }).click();
    await expect(reco.locator('li', { hasText: segunda.name })).toHaveCount(0);
  } finally {
    await db().doc(`people/${PERSONA}/career/journey`).delete();
    for (const r of (await db().collection(`people/${PERSONA}/careerRecommendations`).get()).docs) await r.ref.delete();
    await limpiar();
  }
});

test('en el juego, «Mi ruta» enseña lo recomendado y aceptarlo lo suma a la ruta (RMR-TSK-0742)', async ({ page }) => {
  const recos = db().collection('people/e2e-person-eng/careerRecommendations');
  await db().doc(JOURNEY).set({ currentCity: primera.id, visitedCities: [primera.id], plannedRoute: [] });
  await recos.doc('juego').set({ kind: 'city', routeId: null, cityIds: [segunda.id], label: segunda.name, note: 'Para el juego',
    by: { uid: 'e2e-head', name: 'Head E2E' }, at: '2026-10-16T09:00:00.000Z', status: 'open', decidedAt: null });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/tools/career-map');
    const app = page.locator('career-app');
    await app.getByRole('button', { name: /Mi ruta/ }).click();
    const ruta = app.getByRole('dialog', { name: 'Mi ruta libre' });
    await ruta.locator('career-recommendations-inbox').getByRole('button', { name: 'Añadir a mi ruta' }).click();
    await expect(ruta).toContainText(segunda.name);
    await expect.poll(async () => (await db().doc(JOURNEY).get()).data()?.plannedRoute).toEqual([segunda.id]);
  } finally {
    await db().doc(JOURNEY).delete();
    for (const r of (await recos.get()).docs) await r.ref.delete();
  }
});

test('la persona decide: añade a su ruta lo recomendado o lo descarta (RMR-TSK-0741)', async ({ page }) => {
  const recos = db().collection('people/e2e-person-eng/careerRecommendations');
  const base = { kind: 'city', routeId: null, note: 'Te vendrá bien', by: { uid: 'e2e-head', name: 'Head E2E' },
    at: '2026-10-16T09:00:00.000Z', status: 'open', decidedAt: null };
  await db().doc(JOURNEY).set({ currentCity: primera.id, visitedCities: [primera.id], plannedRoute: [] });
  await recos.doc('si').set({ ...base, cityIds: [segunda.id], label: segunda.name });
  await recos.doc('no').set({ ...base, cityIds: [primera.id], label: 'Descartable E2E' });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#carrera');
    const espacio = page.locator('engineer-space');
    await espacio.getByRole('tab', { name: 'Mapa' }).click();
    const inbox = espacio.locator('career-recommendations-inbox');
    await expect(inbox).toContainText('Recomendado por tu manager');
    await inbox.locator('li', { hasText: segunda.name }).getByRole('button', { name: 'Añadir a mi ruta' }).click();
    await expect(espacio.locator('career-map-summary ol.route')).toContainText(segunda.name);
    await inbox.locator('li', { hasText: 'Descartable E2E' }).getByRole('button', { name: 'Descartar' }).click();
    await expect(inbox).toHaveText('');
    await expect.poll(async () => (await recos.doc('no').get()).data()?.status).toBe('dismissed');
    expect((await db().doc(JOURNEY).get()).data()?.plannedRoute).toEqual([segunda.id]);
  } finally {
    await db().doc(JOURNEY).delete();
    for (const r of (await recos.get()).docs) await r.ref.delete();
  }
});
