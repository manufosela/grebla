/**
 * Tests de las REGLAS: lo que viene de Notion no se edita en GREBLA
 * (RMR-TSK-0588, ADR -P1XxVvQPrufU13Bd4RF). En una instancia conectada
 * (/config/org.notionSync == true), nombre, departamento, manager, alta,
 * externo, email y el bloque notion solo los escribe el importador (Admin SDK).
 * Ni el superadmin desde el cliente: si no, la restricción sería solo visual.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-notion';

async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

const comoEmpleado = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

async function prepara(env, notionSync) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'jefa'), { name: 'Jefa' });
    await setDoc(doc(db, 'config', 'org'), { notionSync });
    await setDoc(doc(db, 'people', 'p1'), {
      name: 'Ana', orgBranch: 'engineering', reportsToPersonId: null, startDate: '2024-01-15',
      external: false, active: true, levelId: 'l2', guilds: [],
    });
  });
}

test.describe('reglas: los campos de Notion', () => {
  // En serie: los tres tests cambian el mismo /config/org y en paralelo se pisan.
  test.describe.configure({ mode: 'serial' });
  let env;
  test.beforeAll(async () => { env = await testEnv(); });
  test.afterAll(async () => { await env?.cleanup(); });

  test('con Notion conectado, ni el superadmin cambia nombre, departamento, manager o alta', async () => {
    await prepara(env, true);
    const jefa = comoEmpleado(env, 'jefa').firestore();
    const ref = doc(jefa, 'people', 'p1');
    await assertFails(updateDoc(ref, { name: 'Otra' }));
    await assertFails(updateDoc(ref, { orgBranch: 'product' }));
    await assertFails(updateDoc(ref, { reportsToPersonId: 'p9' }));
    await assertFails(updateDoc(ref, { startDate: '2020-01-01' }));
    await assertFails(updateDoc(ref, { external: true }));
    await assertFails(updateDoc(ref, { notion: { id: 'x' } }));
  });

  test('con Notion conectado, lo propio de GREBLA y la baja se siguen editando', async () => {
    await prepara(env, true);
    const jefa = comoEmpleado(env, 'jefa').firestore();
    const ref = doc(jefa, 'people', 'p1');
    await assertSucceeds(updateDoc(ref, { levelId: 'l3', guilds: ['QA'] }));
    await assertSucceeds(updateDoc(ref, { active: false }));
  });

  test('sin Notion (la demo), el superadmin edita todo como siempre', async () => {
    await prepara(env, false);
    const jefa = comoEmpleado(env, 'jefa').firestore();
    await assertSucceeds(updateDoc(doc(jefa, 'people', 'p1'), { name: 'Otra', orgBranch: 'product' }));
  });
});
