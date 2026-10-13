/**
 * Avance hacia el nivel siguiente (RMR-PCS-0044 · F3): el EM marca en la ficha
 * qué expectativas de L2 cubre ya la persona, y de ahí sale el L1-2 — no del
 * avance en el mapa de carrera, que cuenta otra historia.
 *
 * Siembra su propia persona y su propio framework: qué ve el head depende de lo
 * que dejen otros specs, y una prueba que pasa sola y falla en la suite no es
 * una prueba.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-avance';
const NOMBRE = 'Persona del avance E2E';

/** L1 y L2 con pesos distintos: tech vale 3 y es imprescindible; product, 1. */
const FRAMEWORK = {
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [
    { id: 'av-l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: '', typicalProfile: '' },
    { id: 'av-l2', code: 'L2', title: 'Engineer II', trackId: 'ic', order: 2, description: '', typicalProfile: '' },
  ],
  dimensions: [
    { id: 'av-tech', name: 'Técnica', order: 1 },
    { id: 'av-product', name: 'Producto', order: 2 },
  ],
  disciplines: [],
  expectations: [
    { levelId: 'av-l1', dimensionId: 'av-tech', text: 'Escribe código que otros leen' },
    { levelId: 'av-l2', dimensionId: 'av-tech', text: 'Diseña un servicio entero', weight: 3, core: true },
    { levelId: 'av-l2', dimensionId: 'av-product', text: 'Discute el alcance con producto', weight: 1 },
  ],
  addendums: [],
};

async function conPersonaEnL1(fn) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  await db().doc(PERSON).set({
    name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, levelId: 'av-l1',
    careerReviewers: { firstUid: 'e2e-head', secondUid: null, arbiterUid: null },
  });
  try { await fn(); } finally {
    await db().doc(`${PERSON}/careerClaims/av-l2__av-tech`).delete();
    await db().doc(`${PERSON}/careerAssessments/av-l2`).delete();
    await db().doc(`${PERSON}/career/assessment`).delete();
    await db().doc(PERSON).delete();
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
}

const ficha = (page) => page.locator('team-person-detail');

async function abrirCarrera(page) {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
  await expect(ficha(page)).toBeVisible();
  // El avance vive junto a la valoración del nivel, en la sub-pestaña «Nivel».
  await ficha(page).getByRole('tab', { name: 'Nivel' }).click();
}

/**
 * Mi carrera (RMR-TSK-0684): el ingeniero marca con evidencia en Mi espacio y su
 * responsable la acepta desde la ficha; el avance sale de lo ACEPTADO.
 */
const ENG = 'people/e2e-person-eng';
async function conIngenieroEnL1(fn) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  const ficha0 = (await db().doc(ENG).get()).data();
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  // Cuelga del head (de Tech) en el directorio: el trigger le hace su revisor.
  const jefe = db().doc('people/e2e-ficha-e2e-head');
  const jefe0 = (await jefe.get()).data() ?? null;
  // Todo dentro del try: si algo falla a medias, la ficha del ingeniero se restaura.
  try {
    await jefe.set({ name: 'Ficha de e2e-head', uid: 'e2e-head', active: false, reportsToPersonId: 'e2e-sin-ficha',
      ...jefe0, orgBranch: 'engineering' });
    await db().doc(ENG).update({ levelId: 'av-l1', reportsToPersonId: 'e2e-ficha-e2e-head', orgBranch: 'engineering' });
    await expect.poll(async () => (await db().doc(ENG).get()).data()?.careerReviewers?.firstUid, { timeout: 20_000 }).toBe('e2e-head');
    await fn();
  } finally {
    if (jefe0) await jefe.set(jefe0);
    else await jefe.delete();
    for (const c of (await db().collection(`${ENG}/careerClaims`).get()).docs) await c.ref.delete();
    await db().doc(ENG).set(ficha0);
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
}

test('el ingeniero marca con evidencia y su responsable la acepta: el avance sale de lo aceptado', async ({ page, browser }) => {
  test.setTimeout(90_000); // dos sesiones: el ingeniero y su responsable
  await conIngenieroEnL1(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#carrera');
    const espacio = page.locator('engineer-space');
    await espacio.getByRole('tab', { name: 'Expectativas' }).click();
    const tech = espacio.locator('career-expectations li', { hasText: 'Técnica' }).first();
    await tech.getByRole('button', { name: 'Marcar como cumplida' }).click();
    const dialogo = espacio.locator('career-claim-dialog');
    await dialogo.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(dialogo).toContainText('Falta la evidencia');
    await dialogo.getByRole('textbox').first().fill('Diseñé entero el servicio de cobros');
    await dialogo.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(tech).toContainText('Pendiente de revisión');

    // Su responsable, en otra sesión.
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const head = await ctx.newPage();
    await signInAs(head, 'head');
    await head.goto('/tools/team');
    await head.getByRole('button', { name: 'Abrir Carrera de Ingeniero E2E' }).click();
    await ficha(head).getByRole('tab', { name: 'Expectativas' }).click();    const fila = ficha(head).locator('career-expectations li', { hasText: 'Técnica' }).first();
    await fila.getByRole('button', { name: 'Revisar' }).click();
    await ficha(head).locator('career-review-dialog').getByRole('button', { name: 'Aceptar' }).click();
    await expect(fila).toContainText('Aceptada');
    // 3 de 4 puntos aceptados: L1-2.
    await ficha(head).getByRole('tab', { name: 'Seguimiento' }).click();
    await expect(ficha(head).locator('career-person-panel')).toContainText('L1-2 · 75 %');
    await ctx.close();
  });
});

test('el subnivel ajustado por el manager se ve igual en Nivel y en Seguimiento (RMR-TSK-0693)', async ({ page }) => {
  await conPersonaEnL1(async () => {
    await db().doc(PERSON).update({ subLevelOverride: { value: 3, note: 'lidera de facto' } });
    await abrirCarrera(page);
    await expect(ficha(page)).toContainText('L1-3');
    await ficha(page).getByRole('tab', { name: 'Seguimiento' }).click();
    await expect(ficha(page).locator('career-person-panel')).toContainText('L1-3');
    await expect(ficha(page).locator('career-person-panel')).toContainText('lidera de facto');
  });
});

test('la curva de progresión se dibuja con las valoraciones cerradas (RMR-TSK-0556)', async ({ page }) => {
  await conPersonaEnL1(async () => {
    await db().doc(`${PERSON}/careerAssessments/av-l2`).set({
      levelId: 'av-l2',
      byDimension: { 'av-tech': { meets: true } },
      closures: [
        { at: '2026-06-01T09:00:00.000Z', earned: 1, total: 4, pct: 25 },
        { at: '2026-09-01T09:00:00.000Z', earned: 3, total: 4, pct: 75 },
      ],
    });
    await abrirCarrera(page);
    await expect(ficha(page).locator('career-progression-chart')).toBeVisible();
  });
});

test('el badge del seguimiento sale de lo ACEPTADO, no del avance en el mapa', async ({ page }) => {
  await conPersonaEnL1(async () => {
    // 3 de 4 puntos aceptados (RMR-TSK-0686). En el mapa de carrera no ha certificado
    // ni una casa: el nivel no se mueve por formarse, y el badge lo demuestra.
    await db().doc(`${PERSON}/careerClaims/av-l2__av-tech`).set({
      levelId: 'av-l2', dimensionId: 'av-tech', status: 'claimed', evidence: { text: 'ADR', links: [] },
      reviews: { first: { decision: 'accept' } }, history: [],
    });
    // El badge se mudó con la tabla: ya no hay dos, hay una (RMR-TSK-0590).
    await signInAs(page, 'superadmin');
    await page.goto('/tools/career-map/admin');
    await expect(page.locator('career-tracking .side')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Conjunto' }).click();

    const fila = page.locator('career-tracking tr', { hasText: NOMBRE });
    await expect(fila.locator('.lvl.sub')).toHaveText('L1-2');
    await expect(fila.locator('.lvl.sub')).toHaveAttribute('title', /3 de 4 puntos aceptados/);
  });
});

test('el hash viejo de «Carrera» lleva al seguimiento, no a una pestaña que ya no existe', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team#career');
  await expect(page).toHaveURL(/\/tools\/career-map\/admin/);
});
