/**
 * Reglas del historial de expectativas (RMR-TSK-0710): solo se añade. El
 * ingeniero aporta pruebas suyas; quien lleva a la persona (dueño de la ficha,
 * sus revisores, su directorio, el superadmin) añade cualquier tipo. Nadie edita
 * ni borra: la evolución no se reescribe.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-evidence';
const entry = (uid, kind = 'proof', extra = {}) => ({
  levelId: 'l2', dimensionId: 'tech', kind, text: 'Diseñó el servicio de cobros',
  links: [{ kind: 'pr', url: 'https://x.dev/pr/1' }], by: { uid, name: uid }, at: '2026-10-14T09:00:00.000Z', ...extra,
});

async function prepara(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'leaders', 'u-em'), { displayName: 'EM' });
    await setDoc(doc(db, 'admins', 'u-admin'), { name: 'Admin' });
    await setDoc(doc(db, 'people', 'dev'), {
      name: 'Dev', uid: 'u-dev', ownerLeaderUid: 'u-em', directoryManagerUids: ['u-dir'],
      careerReviewers: { firstUid: 'u-em', secondUid: 'u-head', arbiterUid: 'u-cto' },
    });
    await setDoc(doc(db, 'people/dev/careerEvidence/e0'), entry('u-em', 'misses'));
  });
}

test.describe('reglas: historial de expectativas', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const as = (uid) => env.authenticatedContext(uid).firestore();
  const ref = (uid, id) => doc(as(uid), `people/dev/careerEvidence/${id}`);
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.beforeEach(async () => { await env.clearFirestore(); await prepara(env); });
  test.afterAll(async () => { await env?.cleanup(); });

  test('el ingeniero añade pruebas suyas, pero no pone el estado ni firma por otro', async () => {
    await assertSucceeds(setDoc(ref('u-dev', 'e1'), entry('u-dev', 'proof')));
    await assertFails(setDoc(ref('u-dev', 'e2'), entry('u-dev', 'meets')));
    await assertFails(setDoc(ref('u-dev', 'e3'), entry('u-em', 'proof')));
    await assertSucceeds(getDoc(ref('u-dev', 'e0')));
  });

  test('quien lleva a la persona añade cualquier tipo, firmando como sí mismo', async () => {
    await assertSucceeds(setDoc(ref('u-em', 'e1'), entry('u-em', 'meets')));
    await assertSucceeds(setDoc(ref('u-head', 'e2'), entry('u-head', 'misses')));
    await assertSucceeds(setDoc(ref('u-dir', 'e3'), entry('u-dir', 'proof')));
    await assertSucceeds(setDoc(ref('u-admin', 'e4'), entry('u-admin', 'meets')));
    await assertFails(setDoc(ref('u-em', 'e5'), entry('u-head', 'meets')));
    await assertSucceeds(getDoc(ref('u-head', 'e0')));
  });

  test('alguien de fuera ni lee ni escribe; el árbitro solo lee', async () => {
    await assertFails(setDoc(ref('u-otro', 'e1'), entry('u-otro', 'proof')));
    await assertFails(getDoc(ref('u-otro', 'e0')));
    await assertFails(setDoc(ref('u-cto', 'e1'), entry('u-cto', 'meets')));
    await assertSucceeds(getDoc(ref('u-cto', 'e0')));
  });

  test('sin sesión no se lee nada, aunque la persona no tenga árbitro', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'people/dev'), {
      careerReviewers: { firstUid: 'u-em', secondUid: null, arbiterUid: null },
    }));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'people/dev/careerEvidence/e0')));
  });

  test('una entrada no se edita ni se borra, ni siquiera el superadmin', async () => {
    await assertFails(updateDoc(ref('u-em', 'e0'), { text: 'otra cosa' }));
    await assertFails(deleteDoc(ref('u-em', 'e0')));
    await assertFails(deleteDoc(ref('u-admin', 'e0')));
  });

  test('la forma se valida: tipo, texto, enlaces y sin campos de más', async () => {
    await assertFails(setDoc(ref('u-em', 'e1'), entry('u-em', 'quizá')));
    await assertFails(setDoc(ref('u-em', 'e2'), entry('u-em', 'meets', { text: '' })));
    await assertFails(setDoc(ref('u-em', 'e3'), entry('u-em', 'meets', { extra: 1 })));
    const links = Array.from({ length: 6 }, () => ({ kind: 'doc', url: 'https://x.dev' }));
    await assertFails(setDoc(ref('u-em', 'e4'), entry('u-em', 'meets', { links })));
    await assertFails(setDoc(ref('u-em', 'e5'), entry('u-em', 'meets', { links: [{ kind: 'pr', url: 'javascript:1' }] })));
    await assertFails(setDoc(ref('u-em', 'e6'), entry('u-em', 'meets', { links: ['https://x.dev'] })));
    await assertFails(setDoc(ref('u-em', 'e7'), entry('u-em', 'meets', { by: { uid: 'u-em', name: '' } })));
    await assertFails(setDoc(ref('u-em', 'e8'), entry('u-em', 'meets', { by: { uid: 'u-em', name: 'EM', role: 'x' } })));
  });
});
