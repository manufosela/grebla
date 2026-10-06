/**
 * Notas PRIVADAS del manager sobre una persona (RMR-TSK-0636): performance
 * reviews y contexto. A diferencia de /people/{id}/conversations, la propia
 * persona NO las lee: por eso viven fuera de su ficha, en /managerNotes. La
 * promesa solo vale si la cumplen las reglas, así que se prueba contra ellas.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-notas-privadas';
const PERSONA = 'p-ana';
const ANA = 'uid-ana';
const MANAGER = 'uid-manager';
const HEAD = 'uid-head';
const VISOR = 'uid-visor';
const OTRA = 'uid-otra';
const ENTRY = ['managerNotes', PERSONA, 'entries', 'e1'];
const VALIDA = { type: 'perf-review', date: '2026-06-30', title: 'Review H1', content: 'Muy buen semestre.' };

async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

const como = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true }).firestore();

test.describe('reglas de /managerNotes/{personId}/entries', () => {
  /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
  let env;

  test.beforeAll(async () => {
    env = await testEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'leaders', MANAGER), { displayName: 'Manager', reportsTo: HEAD, chain: [HEAD] });
      await setDoc(doc(db, 'leaders', HEAD), { displayName: 'Head', reportsTo: null });
      await setDoc(doc(db, 'leaders', ANA), { displayName: 'Ana también lidera', reportsTo: null });
      await setDoc(doc(db, 'viewers', VISOR), { at: 'x' });
      await setDoc(doc(db, 'people', PERSONA), { name: 'Ana', uid: ANA, ownerLeaderUid: MANAGER, active: true });
      await setDoc(doc(db, ...ENTRY), VALIDA);
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  test('su manager lee y escribe', async () => {
    const db = como(env, MANAGER);
    await assertSucceeds(getDoc(doc(db, ...ENTRY)));
    await assertSucceeds(setDoc(doc(db, 'managerNotes', PERSONA, 'entries', 'e2'), { ...VALIDA, type: 'contexto' }));
  });

  test('el manager de su manager (cadena) también', async () => {
    await assertSucceeds(getDoc(doc(como(env, HEAD), ...ENTRY)));
  });

  test('LA PROPIA PERSONA no las lee ni las escribe, aunque también sea líder', async () => {
    const db = como(env, ANA);
    await assertFails(getDoc(doc(db, ...ENTRY)));
    await assertFails(setDoc(doc(db, 'managerNotes', PERSONA, 'entries', 'e3'), VALIDA));
  });

  test('ni el visor global ni alguien de fuera', async () => {
    await assertFails(getDoc(doc(como(env, VISOR), ...ENTRY)));
    await assertFails(getDoc(doc(como(env, OTRA), ...ENTRY)));
  });

  test('una entrada mal formada no se guarda', async () => {
    const db = como(env, MANAGER);
    await assertFails(setDoc(doc(db, 'managerNotes', PERSONA, 'entries', 'm1'), { ...VALIDA, type: 'otra' }));
    await assertFails(setDoc(doc(db, 'managerNotes', PERSONA, 'entries', 'm2'), { ...VALIDA, date: '30/06/2026' }));
    await assertFails(setDoc(doc(db, 'managerNotes', PERSONA, 'entries', 'm3'), { ...VALIDA, extra: 1 }));
  });
});
