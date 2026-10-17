/**
 * Reglas de los objetivos medibles (RMR-TSK-0749): quien lleva a la persona los
 * pone, los ajusta mientras están en curso y los cierra una vez; la persona los
 * lee; nadie los borra (un objetivo que ya no aplica se cierra como descartado).
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-objectives';
const AT = '2026-10-17T09:00:00.000Z';
const objective = (uid, extra = {}) => ({
  title: 'Medir el impacto de la IA', measure: 'Ahorro ≥ 20 % frente a la línea base', dueDate: '2026-12-31',
  levelId: 'l2', dimensionId: 'orchestration', status: 'open', closingNote: '', closedAt: null,
  by: { uid, name: uid }, at: AT, ...extra,
});

async function prepara(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'u-admin'), { name: 'Admin' });
    await setDoc(doc(db, 'people', 'dev'), {
      name: 'Dev', uid: 'u-dev', ownerLeaderUid: 'u-em', directoryManagerUids: ['u-em', 'u-head'],
    });
    await setDoc(doc(db, 'people/dev/careerObjectives/o0'), objective('u-em'));
  });
}

test.describe('reglas: objetivos medibles', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const ref = (uid, id) => doc(env.authenticatedContext(uid).firestore(), `people/dev/careerObjectives/${id}`);
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.beforeEach(async () => { await env.clearFirestore(); await prepara(env); });
  test.afterAll(async () => { await env?.cleanup(); });

  test('quien la lleva pone objetivos en curso, firmando como sí mismo', async () => {
    await assertSucceeds(setDoc(ref('u-head', 'o1'), objective('u-head')));
    await assertSucceeds(setDoc(ref('u-admin', 'o2'), objective('u-admin', { levelId: null, dimensionId: null, dueDate: null })));
    await assertFails(setDoc(ref('u-em', 'o3'), objective('u-head')));
    await assertFails(setDoc(ref('u-em', 'o4'), objective('u-em', { status: 'achieved' })));
    await assertFails(setDoc(ref('u-em', 'o5'), objective('u-em', { measure: '' })));
    await assertFails(setDoc(ref('u-em', 'o6'), objective('u-em', { dueDate: '31/12/2026' })));
    await assertFails(setDoc(ref('u-em', 'o7'), objective('u-em', { dimensionId: null })));
    await assertFails(setDoc(ref('u-em', 'o8'), objective('u-em', { extra: 'x' })));
  });

  test('lo ajusta en curso y lo cierra una sola vez; nadie lo borra', async () => {
    await assertSucceeds(updateDoc(ref('u-head', 'o0'), { measure: 'Ahorro ≥ 25 %', dueDate: '2027-01-31' }));
    await assertFails(updateDoc(ref('u-em', 'o0'), { by: { uid: 'u-em', name: 'Otro' } }));
    await assertFails(updateDoc(ref('u-em', 'o0'), { status: 'achieved' }));
    await assertSucceeds(updateDoc(ref('u-em', 'o0'), { status: 'achieved', closingNote: 'Medido: 23 %', closedAt: AT }));
    await assertFails(updateDoc(ref('u-em', 'o0'), { status: 'missed', closedAt: AT }));
    await assertFails(updateDoc(ref('u-em', 'o0'), { title: 'Reescrito' }));
    await assertFails(deleteDoc(ref('u-em', 'o0')));
  });

  test('la persona los lee pero no los toca', async () => {
    await assertSucceeds(getDoc(ref('u-dev', 'o0')));
    await assertFails(setDoc(ref('u-dev', 'o1'), objective('u-dev')));
    await assertFails(updateDoc(ref('u-dev', 'o0'), { status: 'achieved', closingNote: '', closedAt: AT }));
  });

  test('nadie más los lee', async () => {
    await assertFails(getDoc(ref('u-otro', 'o0')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'people/dev/careerObjectives/o0')));
  });
});
