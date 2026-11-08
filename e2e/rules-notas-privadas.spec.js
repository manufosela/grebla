/**
 * Notas del manager sobre una persona (RMR-TSK-0636): performance reviews y
 * contexto. Viven fuera de su ficha, en /managerNotes. La persona lee sus
 * performance reviews (RMR-TSK-0544), pero el contexto sigue siendo privado del
 * manager. La promesa solo vale si la cumplen las reglas: se prueba contra ellas.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-notas-privadas';
const PERSONA = 'p-ana';
const ANA = 'uid-ana';
const MANAGER = 'uid-manager';
const HEAD = 'uid-head';
const VISOR = 'uid-visor';
const OTRA = 'uid-otra';
const ENTRY = ['managerNotes', PERSONA, 'entries', 'e1'];
const CONTEXTO = ['managerNotes', PERSONA, 'entries', 'c1'];
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
      await setDoc(doc(db, ...CONTEXTO), { ...VALIDA, type: 'contexto' });
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

  test('la propia persona LEE sus performance reviews, pero no las escribe (RMR-TSK-0544)', async () => {
    const db = como(env, ANA);
    await assertSucceeds(getDoc(doc(db, ...ENTRY)));
    await assertSucceeds(getDocs(query(collection(db, 'managerNotes', PERSONA, 'entries'), where('type', '==', 'perf-review'))));
    await assertFails(setDoc(doc(db, 'managerNotes', PERSONA, 'entries', 'e3'), VALIDA));
    await assertFails(updateDoc(doc(db, ...ENTRY), { title: 'Me la cambio' }));
    await assertFails(deleteDoc(doc(db, ...ENTRY)));
  });

  test('las notas de CONTEXTO siguen siendo solo del manager, aunque la persona también sea líder', async () => {
    const db = como(env, ANA);
    await assertFails(getDoc(doc(db, ...CONTEXTO)));
    await assertFails(getDocs(collection(db, 'managerNotes', PERSONA, 'entries')));
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
