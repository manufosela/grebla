/**
 * El resumen del mapa de carrera (RMR-TSK-0735): la persona lo ve en Mi espacio
 * en primera persona y con la puerta al juego; es el mismo <career-map-summary>
 * que verá su manager en la ficha.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';
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
