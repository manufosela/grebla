/**
 * Lo anotado en TU ficha, en «Mi espacio» (RMR-TSK-0578).
 *
 * Lo que se escribe sobre una persona ya era legible por ella —las reglas
 * incluyen a la propia persona en su subárbol—, pero no se enseñaba en ninguna
 * pantalla. Y lo que no se ve no se puede corregir: si algo de lo que hay escrito
 * sobre ti está mal, primero hay que poder leerlo.
 *
 * Lo que se fija aquí: que ve la SUYA y no la de otra persona, y que se distingue
 * de dónde viene cada nota antes de leerla.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const MIA = 'people/e2e-person-eng';
const AJENA = 'people/e2e-person-mgr';

async function conNotas(fn) {
  await db().doc(`${MIA}/conversations/c-mia-agente`).set({
    type: 'o2o',
    date: '2026-09-20',
    notes: 'Nota traida por el agente sobre mi',
    summary: '',
    automated: true,
    source: { system: 'matias', id: 'evt-1', url: 'https://calendario.example/evt-1' },
    createdBy: { uid: 'agent:matias', name: 'matias (automático)' },
  });
  await db().doc(`${MIA}/conversations/c-mia-persona`).set({
    type: 'catchup',
    date: '2026-09-25',
    notes: 'Lo que escribio mi manager despues de hablar',
    createdBy: { uid: 'u-mgr', name: 'Manager E2E' },
  });
  await db().doc(`${AJENA}/conversations/c-ajena`).set({
    type: 'o2o', date: '2026-09-22', notes: 'ESTO ES DE OTRA PERSONA',
    createdBy: { uid: 'u-mgr', name: 'Manager E2E' },
  });
  try { await fn(); } finally {
    await db().doc(`${MIA}/conversations/c-mia-agente`).delete();
    await db().doc(`${MIA}/conversations/c-mia-persona`).delete();
    await db().doc(`${AJENA}/conversations/c-ajena`).delete();
  }
}

test('la persona ve lo anotado en SU ficha, y no lo de otra', async ({ page }) => {
  await conNotas(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#o2o');

    const espacio = page.locator('engineer-space');
    await expect(espacio.getByText('Anotado en tu ficha')).toBeVisible({ timeout: 20_000 });
    await expect(espacio).toContainText('Lo que escribio mi manager despues de hablar');
    await expect(espacio).toContainText('Nota traida por el agente sobre mi');
    // Lo de otra persona no aparece por ningún lado.
    await expect(espacio).not.toContainText('ESTO ES DE OTRA PERSONA');
  });
});

test('se ve de dónde viene cada nota antes de leerla', async ({ page }) => {
  await conNotas(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#o2o');

    const espacio = page.locator('engineer-space');
    await expect(espacio.getByText('Anotado en tu ficha')).toBeVisible({ timeout: 20_000 });
    // La automática dice QUÉ sistema la trajo; la de una persona, quién.
    await expect(espacio.locator('.origin.agente')).toContainText('matias');
    await expect(espacio.locator('.origin.persona')).toContainText('Manager E2E');
    // Y lo último, primero: la del 25 va antes que la del 20.
    const orden = await espacio.evaluate((el) => [...el.shadowRoot.querySelectorAll('.o2o-card .date')].map((n) => n.textContent));
    expect(orden).toContain('2026-09-25');
    expect(orden.indexOf('2026-09-25')).toBeLessThan(orden.indexOf('2026-09-20'));
  });
});
