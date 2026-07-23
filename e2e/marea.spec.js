/**
 * Flujo de MAREA end-to-end (RMR-TSK-0299, primera tanda). Cierra el círculo
 * completo: UI → escritura en Firestore → Cloud Function de agregación → umbral
 * de anonimato (RMR-BUG-0051). Con dos mareas sembradas, la del ingeniero es la
 * TERCERA: antes de guardarla el agregado está por debajo del umbral (medias
 * ocultas); después, la Cloud Function lo recalcula y se publica.
 *
 * Necesita el emulador de Functions cargando aggregatePulse:
 *   firebase emulators:exec --only auth,firestore,functions --project demo-grebla "npx playwright test"
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';
import { isoWeekKey, dayKey } from '../src/tools/pulse/domain/pulse.js';

const WEEK = isoWeekKey(new Date());
const DAY = dayKey(new Date());
const FULL = { energia: 55, animo: 55, carga: 50, rumbo: 50, tripulacion: 50, reconocimiento: 50 };

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Siembra la marea de una persona ya contada en /people, para esta semana. */
async function seedPulse(db, uid) {
  await db.doc(`people/e2e-pulse-${uid}`).set({ name: `Pulso ${uid}`, uid, ownerLeaderUid: 'e2e-manager', active: true });
  await db.doc(`pulse/${uid}/entries/${DAY}`).set({ ...FULL, uid, day: DAY, weekIso: WEEK, shareWord: false });
}

test.describe('marea: la 3ª respuesta cruza el umbral de anonimato', () => {
  test.beforeAll(async () => {
    const db = admin();
    // Dos mareas sembradas: aún por debajo del mínimo de 3.
    await seedPulse(db, 'e2e-pulse-a');
    await seedPulse(db, 'e2e-pulse-b');
  });

  test('el agregado se oculta con 2 y se publica cuando el ingeniero registra la 3ª', async ({ page }) => {
    const db = admin();

    // Punto de partida: con 2 respuestas, la media general NO se publica.
    await expect.poll(async () => {
      const d = (await db.doc(`pulseAggregates/${WEEK}`).get()).data();
      return d?.general?.means ?? null;
    }, { timeout: 15_000 }).toBeNull();

    // El ingeniero registra su marea por la interfaz (sliders en su valor por
    // defecto: basta con fijarla). La pestaña «Mi marea» está activa de inicio.
    await signInAs(page, 'engineer');
    await page.goto('/marea');
    await page.getByRole('button', { name: /(Fijar|Ajustar) mi marea/i }).click();
    await expect(page.getByText('Marea registrada')).toBeVisible();

    // La Cloud Function recalcula: ahora son 3, así que la media se publica.
    await expect.poll(async () => {
      const d = (await db.doc(`pulseAggregates/${WEEK}`).get()).data();
      return d?.respondents ?? 0;
    }, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);

    const agg = (await db.doc(`pulseAggregates/${WEEK}`).get()).data();
    expect(agg.general.means).not.toBeNull();
    expect(typeof agg.general.means.energia).toBe('number');
  });
});
