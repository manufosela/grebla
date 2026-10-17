/**
 * Quien tiene a la persona por encima en el organigrama la edita (RMR-TSK-0761):
 * es su Mi equipo. Como el dueño, pero sin poder quedársela ni tocar lo que
 * calcula el servidor.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-people-dir';

test.describe('reglas: la ficha y el organigrama', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const ref = (uid) => doc(env.authenticatedContext(uid).firestore(), 'people/dev');
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'people/dev'), {
        name: 'Dev', uid: 'u-dev', ownerLeaderUid: 'u-em', directoryManagerUids: ['u-em', 'u-head', 'u-cto'],
      });
    });
  });
  test.afterAll(async () => { await env?.cleanup(); });

  test('quien está por encima edita su nivel, sus gremios y su objetivo de carrera', async () => {
    await assertSucceeds(updateDoc(ref('u-cto'), { levelId: 'l2', guilds: ['QA'], careerTargetLevelId: 'l3' }));
  });

  test('pero no se la queda ni toca lo que calcula el servidor', async () => {
    await assertFails(updateDoc(ref('u-cto'), { ownerLeaderUid: 'u-cto' }));
    await assertFails(updateDoc(ref('u-cto'), { directoryManagerUids: ['u-cto'] }));
  });

  test('quien no está en su organigrama no la edita', async () => {
    await assertFails(updateDoc(ref('u-otro'), { levelId: 'l2' }));
  });
});
