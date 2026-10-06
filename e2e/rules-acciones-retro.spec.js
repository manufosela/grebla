/**
 * Acciones de retro (RMR-TSK-0640). Desde que cualquiera convoca una retro, sus
 * acciones las tiene que poder guardar quien la convoca aunque no sea manager;
 * y el Head tiene que ver las de las retros de su rama. Se prueba contra las
 * reglas reales.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-acciones-retro';
const CONVOCA = 'uid-convoca'; // no es manager
const PARTICIPA = 'uid-participa';
const EM = 'uid-em';
const HEAD = 'uid-head';
const accion = (owner, extra = {}) => ({
  text: 'Revisar el flujo de despliegue', owners: [], ownerNames: [], ownerLeaderUid: owner,
  scope: { type: 'team', domainKey: null, label: null }, fromRetroId: 'r1', status: 'pending', doneAt: null, ...extra,
});

async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

const como = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true }).firestore();

test.describe('reglas de /retroActions', () => {
  /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
  let env;

  test.beforeAll(async () => {
    env = await testEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'retros', 'r1'), { ownerLeaderUid: CONVOCA, memberUids: [CONVOCA, PARTICIPA], title: 'Retro' });
      await setDoc(doc(db, 'leaders', EM), { displayName: 'EM', reportsTo: HEAD, chain: [HEAD] });
      await setDoc(doc(db, 'leaders', HEAD), { displayName: 'Head', reportsTo: null });
      await setDoc(doc(db, 'supermanagers', HEAD), { displayName: 'Head' });
      await setDoc(doc(db, 'retroActions', 'de-la-rama'), accion(EM, { fromRetroId: 'r-em' }));
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  test('quien convoca la retro guarda sus acciones aunque no sea manager', async () => {
    await assertSucceeds(setDoc(doc(como(env, CONVOCA), 'retroActions', 'a1'), accion(CONVOCA)));
  });

  test('otro participante no guarda acciones en nombre de quien convoca', async () => {
    await assertFails(setDoc(doc(como(env, PARTICIPA), 'retroActions', 'a2'), accion(CONVOCA)));
  });

  test('nadie guarda una acción de una retro que no es suya', async () => {
    await assertFails(setDoc(doc(como(env, PARTICIPA), 'retroActions', 'a3'), accion(PARTICIPA)));
  });

  test('quien participa en la retro ve y lista sus acciones, aunque no la convocara (RMR-TSK-0642)', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'retroActions', 'de-r1'), accion(CONVOCA)));
    const db = como(env, PARTICIPA);
    await assertSucceeds(getDoc(doc(db, 'retroActions', 'de-r1')));
    await assertSucceeds(getDocs(query(collection(db, 'retroActions'), where('fromRetroId', '==', 'r1'))));
  });

  test('quien no participa no las ve', async () => {
    await assertFails(getDocs(query(collection(como(env, 'uid-fuera'), 'retroActions'), where('fromRetroId', '==', 'r1'))));
  });

  test('el Head ve y lista las acciones pendientes de las retros de su rama', async () => {
    const db = como(env, HEAD);
    await assertSucceeds(getDoc(doc(db, 'retroActions', 'de-la-rama')));
    await assertSucceeds(getDocs(query(collection(db, 'retroActions'), where('ownerLeaderUid', 'in', [EM]), where('status', '==', 'pending'))));
  });
});
