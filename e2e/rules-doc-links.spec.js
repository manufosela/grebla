/**
 * Reglas de los enlaces de Documentación (RMR-TSK-0778): los lee cualquiera con
 * sesión; los gestiona quien gobierna o gestiona Documentación; solo https.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-doc-links';
const link = (extra = {}) => ({ group: 'tribbu', title: 'TRIBBU Wiki', url: 'https://www.notion.so/abc', description: '', order: 1, ...extra });

test.describe('reglas: enlaces de Documentación', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const ref = (uid, id) => doc(env.authenticatedContext(uid).firestore(), `docLinks/${id}`);
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
      await setDoc(doc(ctx.firestore(), 'docLinks', 'l1'), link());
    });
  });
  test.afterAll(async () => { await env?.cleanup(); });

  test('cualquiera con sesión los lee; sin sesión, no', async () => {
    await assertSucceeds(getDoc(ref('u-cualquiera', 'l1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'docLinks/l1')));
  });

  test('quien gobierna los gestiona, solo con https y campos conocidos', async () => {
    await assertSucceeds(setDoc(ref('u-admin', 'l2'), link({ title: 'SRE', group: 'abiertas', url: 'https://sre.google/books/' })));
    await assertFails(setDoc(ref('u-admin', 'l3'), link({ url: 'javascript:alert(1)' })));
    await assertFails(setDoc(ref('u-admin', 'l4'), link({ group: 'otro' })));
    await assertFails(setDoc(ref('u-admin', 'l5'), link({ extra: 'x' })));
    await assertSucceeds(deleteDoc(ref('u-admin', 'l1')));
  });

  test('alguien sin gestión no escribe ni borra', async () => {
    await assertFails(setDoc(ref('u-cualquiera', 'l6'), link()));
    await assertFails(deleteDoc(ref('u-cualquiera', 'l1')));
  });
});
