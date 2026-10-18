/**
 * Solo se invita con emails de la organización (RMR-TSK-0774): con dominio de
 * empleados configurado, una ficha no puede guardar un email de invitación de
 * fuera (un gmail), ni al darla de alta ni después.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-invite';

test.describe('reglas: invitaciones solo del dominio', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const ref = (uid, id) => doc(env.authenticatedContext(uid).firestore(), `people/${id}`);
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'u-admin'), { name: 'Admin' });
      await setDoc(doc(ctx.firestore(), 'config', 'org'), { employeeDomain: 'empresa.example' });
      await setDoc(doc(ctx.firestore(), 'people', 'p1'), { name: 'Ana', ownerLeaderUid: 'u-admin', uid: null });
    });
  });
  test.afterAll(async () => { await env?.cleanup(); });

  test('al dar de alta, solo con un email del dominio', async () => {
    await assertSucceeds(setDoc(ref('u-admin', 'p2'), { name: 'Bea', pendingEmail: 'bea@empresa.example' }));
    await assertSucceeds(setDoc(ref('u-admin', 'p3'), { name: 'Sin email', pendingEmail: null }));
    await assertFails(setDoc(ref('u-admin', 'p4'), { name: 'Fuera', pendingEmail: 'fuera@personal.example' }));
  });

  test('al invitar después, igual', async () => {
    await assertSucceeds(updateDoc(ref('u-admin', 'p1'), { pendingEmail: 'ana@empresa.example' }));
    await assertFails(updateDoc(ref('u-admin', 'p1'), { pendingEmail: 'ana@personal.example' }));
    await assertSucceeds(updateDoc(ref('u-admin', 'p1'), { pendingEmail: null }));
  });

  test('y lo demás de la ficha se sigue editando', async () => {
    await assertSucceeds(updateDoc(ref('u-admin', 'p1'), { name: 'Ana B.' }));
  });
});
