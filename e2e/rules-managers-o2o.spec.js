/**
 * Tests de las REGLAS: managers de O2O (RMR-TSK-0654). Una persona puede tener
 * varios managers de O2O; quien está en la lista la lee, y la lista solo la
 * cambia el superadmin. Ni el dueño de la ficha se la puede asignar a otro.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-o2o-managers';

const como = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

test.describe('reglas: managers de O2O', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.afterAll(async () => { await env?.cleanup(); });
  test.beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'admins', 'jefa'), { name: 'Jefa' });
      await setDoc(doc(db, 'leaders', 'duena'), { name: 'Dueña' });
      await setDoc(doc(db, 'leaders', 'mario'), { name: 'Mario' });
      await setDoc(doc(db, 'people', 'p1'), { name: 'Ana', ownerLeaderUid: 'duena', o2oManagerUids: ['mario'], active: true });
    });
  });

  test('un manager de O2O lee la ficha; otro manager cualquiera, no', async () => {
    await assertSucceeds(getDoc(doc(como(env, 'mario').firestore(), 'people', 'p1')));
    await assertFails(getDoc(doc(como(env, 'otro').firestore(), 'people', 'p1')));
  });

  test('ni el dueño ni el manager de O2O cambian la lista; el superadmin, sí', async () => {
    await assertFails(updateDoc(doc(como(env, 'duena').firestore(), 'people', 'p1'), { o2oManagerUids: ['duena'] }));
    await assertFails(updateDoc(doc(como(env, 'mario').firestore(), 'people', 'p1'), { o2oManagerUids: [] }));
    await assertSucceeds(updateDoc(doc(como(env, 'jefa').firestore(), 'people', 'p1'), { o2oManagerUids: ['mario', 'duena'] }));
  });

  test('el dueño sigue editando lo demás de la ficha', async () => {
    await assertSucceeds(updateDoc(doc(como(env, 'duena').firestore(), 'people', 'p1'), { name: 'Ana B.' }));
  });

  test('un líder no crea personas con managers de O2O puestos', async () => {
    const db = como(env, 'duena').firestore();
    await assertFails(setDoc(doc(db, 'people', 'p2'), { name: 'B', ownerLeaderUid: 'duena', o2oManagerUids: ['duena'] }));
    await assertSucceeds(setDoc(doc(db, 'people', 'p3'), { name: 'C', ownerLeaderUid: 'duena' }));
  });
});
