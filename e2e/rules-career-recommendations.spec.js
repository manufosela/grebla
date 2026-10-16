/**
 * Reglas de las recomendaciones del mapa de carrera (RMR-TSK-0738): quien lleva
 * a la persona recomienda (y retira la suya mientras esté abierta); la persona
 * decide una vez, aceptando o descartando, y no toca nada más.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-recos';
const AT = '2026-10-16T09:00:00.000Z';
const reco = (uid, extra = {}) => ({
  kind: 'city', routeId: null, cityIds: ['c1'], label: 'Colas', note: 'Te vendrá bien',
  by: { uid, name: uid }, at: AT, status: 'open', decidedAt: null, ...extra,
});

async function prepara(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'u-admin'), { name: 'Admin' });
    await setDoc(doc(db, 'people', 'dev'), {
      name: 'Dev', uid: 'u-dev', ownerLeaderUid: 'u-em', directoryManagerUids: ['u-em', 'u-head'],
      careerReviewers: { firstUid: 'u-em', secondUid: 'u-head' },
    });
    await setDoc(doc(db, 'people/dev/careerRecommendations/r0'), reco('u-em'));
  });
}

test.describe('reglas: recomendaciones del mapa', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const ref = (uid, id) => doc(env.authenticatedContext(uid).firestore(), `people/dev/careerRecommendations/${id}`);
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.beforeEach(async () => { await env.clearFirestore(); await prepara(env); });
  test.afterAll(async () => { await env?.cleanup(); });

  test('quien la lleva recomienda, abierta y firmando como sí mismo', async () => {
    await assertSucceeds(setDoc(ref('u-head', 'r1'), reco('u-head', { kind: 'route', routeId: 'backend--peritus', cityIds: ['c1', 'c2'] })));
    await assertSucceeds(setDoc(ref('u-admin', 'r2'), reco('u-admin')));
    await assertFails(setDoc(ref('u-em', 'r3'), reco('u-head')));
    await assertFails(setDoc(ref('u-em', 'r4'), reco('u-em', { status: 'accepted' })));
    await assertFails(setDoc(ref('u-em', 'r5'), reco('u-em', { kind: 'curso' })));
    await assertFails(setDoc(ref('u-em', 'r6'), reco('u-em', { extra: 'x' })));
  });

  test('la persona no recomienda, pero lee y decide una vez', async () => {
    await assertFails(setDoc(ref('u-dev', 'r1'), reco('u-dev')));
    await assertSucceeds(getDoc(ref('u-dev', 'r0')));
    await assertFails(updateDoc(ref('u-dev', 'r0'), { status: 'accepted', decidedAt: AT, note: 'cambiada' }));
    await assertFails(updateDoc(ref('u-dev', 'r0'), { status: 'open', decidedAt: AT }));
    await assertSucceeds(updateDoc(ref('u-dev', 'r0'), { status: 'accepted', decidedAt: AT }));
    await assertFails(updateDoc(ref('u-dev', 'r0'), { status: 'dismissed', decidedAt: AT }));
    await assertFails(deleteDoc(ref('u-dev', 'r0')));
  });

  test('el manager no decide por ella; retira la suya solo mientras está abierta', async () => {
    await assertFails(updateDoc(ref('u-em', 'r0'), { status: 'accepted', decidedAt: AT }));
    await assertFails(deleteDoc(ref('u-head', 'r0')));
    await assertSucceeds(deleteDoc(ref('u-em', 'r0')));
  });

  test('nadie más la lee ni la toca', async () => {
    await assertFails(getDoc(ref('u-otro', 'r0')));
    await assertFails(setDoc(ref('u-otro', 'r1'), reco('u-otro')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'people/dev/careerRecommendations/r0')));
  });
});
