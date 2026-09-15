/**
 * El ingeniero ve el O2O que viene y sus preguntas previas (RMR-TSK-0512).
 *
 * El periodo vive bajo el líder y las reglas se lo deniegan a la persona, así
 * que esto solo puede llegar por la Cloud Function `getMyO2O`. Lo que de verdad
 * hay que vigilar es lo que NO sale: en el mismo documento que el formulario
 * previo vive la guía del manager, que es suya.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

// El ingeniero de las fixtures cuelga de e2e-manager (ver global-setup).
const LEADER = 'e2e-manager';
const PERIOD = `leaders/${LEADER}/o2oPeriods/e2e-periodo-sep`;
const GUIA_DEL_MANAGER = 'Pregunta privada que solo usa el manager';

/** Corre `fn` con un periodo del manager, y lo borra después. */
async function conPeriodo(fn, { form, createdAt = '2026-09-01T10:00:00.000Z', name = 'Periodo Septiembre 2026' } = {}) {
  await db().doc(PERIOD).set({
    name,
    status: 'open',
    createdAt,
    guide: {
      version: 2,
      blocks: [{ id: 'b1', title: 'Durante', questions: [{ id: 'g1', text: GUIA_DEL_MANAGER }] }],
    },
    form,
  });
  try { await fn(); } finally { await db().doc(PERIOD).delete(); }
}

const FORM_CON_PREGUNTAS = {
  version: 1,
  intro: 'Piensa en esto antes de vernos',
  sections: [
    { id: 's1', title: 'Tu trabajo', questions: [{ id: 'f1', text: '¿Qué te está costando más ahora?' }] },
    { id: 's2', title: 'Tu crecimiento', questions: [{ id: 'f2', text: '¿Qué te gustaría aprender?' }] },
  ],
};

test('el ingeniero ve el próximo O2O con sus preguntas para pensar', async ({ page }) => {
  await conPeriodo(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#o2o');

    await expect(page.getByText('Tu próximo O2O · Periodo Septiembre 2026')).toBeVisible();
    await expect(page.getByText('Piensa en esto antes de vernos')).toBeVisible();
    await expect(page.getByText('¿Qué te está costando más ahora?')).toBeVisible();
    await expect(page.getByText('¿Qué te gustaría aprender?')).toBeVisible();
    // Son temas para pensar, no un formulario: que no parezca que debe rellenarlo.
    await expect(page.getByText('no un formulario que rellenar')).toBeVisible();
  }, { form: FORM_CON_PREGUNTAS });
});

test('la guía del manager NO llega al navegador del ingeniero', async ({ page }) => {
  await conPeriodo(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#o2o');
    await expect(page.getByText('Tu próximo O2O · Periodo Septiembre 2026')).toBeVisible();

    // Ni pintada ni escondida en el HTML: la proyección la deja fuera en origen.
    const html = await page.content();
    expect(html).not.toContain(GUIA_DEL_MANAGER);
  }, { form: FORM_CON_PREGUNTAS });
});

test('un periodo con el formulario en blanco no promete preguntas que no hay', async ({ page }) => {
  await conPeriodo(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#o2o');

    await expect(page.locator('engineer-space')).toBeVisible();
    await expect(page.getByText('Tu próximo O2O')).toHaveCount(0);
  }, { form: { version: 1, intro: '', sections: [] } });
});

test('con varios periodos, el que se ve es el más reciente', async ({ page }) => {
  const viejo = `leaders/${LEADER}/o2oPeriods/e2e-periodo-jul`;
  await db().doc(viejo).set({
    name: 'Periodo Julio 2026',
    status: 'open',
    createdAt: '2026-07-01T10:00:00.000Z',
    guide: { version: 1, blocks: [] },
    form: { version: 1, intro: 'El de julio', sections: [{ id: 'v1', title: 'Viejo', questions: [{ id: 'vq', text: 'Pregunta de julio' }] }] },
  });
  try {
    await conPeriodo(async () => {
      await signInAs(page, 'engineer');
      await page.goto('/mi-espacio#o2o');

      await expect(page.getByText('Tu próximo O2O · Periodo Septiembre 2026')).toBeVisible();
      await expect(page.getByText('Pregunta de julio')).toHaveCount(0);
    }, { form: FORM_CON_PREGUNTAS });
  } finally {
    await db().doc(viejo).delete();
  }
});
