/**
 * Tests de las REGLAS de las marcas de expectativas (Mi carrera, RMR-TSK-0677).
 * El ingeniero marca con evidencia y no puede aceptarse; cada revisor solo
 * escribe su propia revisión y nunca la evidencia; el árbitro solo con empate;
 * y nadie toca `careerReviewers`, que calcula el servidor.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-claims';
const CLAIM = 'people/dev/careerClaims/l2__tech';
const evidence = { text: 'ADR del cobro en dos fases', links: [{ kind: 'adr', url: 'https://x.dev/adr/7' }] };
const claim = (reviews = {}) => ({
  levelId: 'l2', dimensionId: 'tech', status: 'claimed', evidence,
  claimedBy: { uid: 'u-dev', name: 'Dev' }, claimedAt: '2026-10-12', reviews, history: [],
});
const review = (uid, decision, reason = '') => ({ decision, reason, by: { uid, name: uid }, at: '2026-10-12' });

async function prepara(env, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'leaders', 'u-em'), { displayName: 'EM' });
    await setDoc(doc(db, 'people', 'dev'), {
      name: 'Dev', uid: 'u-dev', ownerLeaderUid: 'u-em',
      careerReviewers: { firstUid: 'u-em', secondUid: 'u-head', arbiterUid: 'u-cto' },
    });
    if (data) await setDoc(doc(db, CLAIM), data);
  });
}

test.describe('reglas: marcas de expectativas', () => {
  test.describe.configure({ mode: 'serial' });
  let env;
  const as = (uid) => env.authenticatedContext(uid).firestore();
  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
  });
  test.beforeEach(async () => { await env.clearFirestore(); });
  test.afterAll(async () => { await env?.cleanup(); });

  test('el ingeniero marca con evidencia, pero no se acepta ni marca por otro', async () => {
    await prepara(env);
    await assertFails(setDoc(doc(as('u-dev'), CLAIM), claim({ first: review('u-dev', 'accept') })));
    await assertFails(setDoc(doc(as('u-dev'), CLAIM), { ...claim(), evidence: { text: '' } }));
    await assertFails(setDoc(doc(as('u-dev'), 'people/dev/careerClaims/l2__culture'), claim()));
    await assertFails(setDoc(doc(as('u-otro'), CLAIM), claim()));
    await assertSucceeds(setDoc(doc(as('u-dev'), CLAIM), claim()));
    await assertFails(deleteDoc(doc(as('u-dev'), CLAIM)));
  });

  test('cada revisor escribe solo su revisión y nunca la evidencia', async () => {
    await prepara(env, claim());
    await assertFails(updateDoc(doc(as('u-em'), CLAIM), { evidence: { text: 'otra cosa', links: [] } }));
    await assertFails(updateDoc(doc(as('u-em'), CLAIM), { 'reviews.second': review('u-em', 'accept') }));
    await assertFails(updateDoc(doc(as('u-em'), CLAIM), { 'reviews.first': review('u-head', 'accept') }));
    await assertFails(updateDoc(doc(as('u-em'), CLAIM), { 'reviews.first': review('u-em', 'reject') }));
    // Aceptar también exige motivo (RMR-TSK-0703).
    await assertFails(updateDoc(doc(as('u-em'), CLAIM), { 'reviews.first': review('u-em', 'accept') }));
    await assertSucceeds(updateDoc(doc(as('u-em'), CLAIM), { 'reviews.first': review('u-em', 'accept', 'Visto en el ADR') }));
    await assertSucceeds(updateDoc(doc(as('u-head'), CLAIM), { 'reviews.second': review('u-head', 'reject', 'Falta el RFC') }));
    await assertSucceeds(getDoc(doc(as('u-head'), CLAIM)));
  });

  test('el árbitro solo decide cuando hay empate', async () => {
    await prepara(env, claim({ first: review('u-em', 'accept', 'Sí'), second: review('u-head', 'accept', 'Sí') }));
    await assertFails(updateDoc(doc(as('u-cto'), CLAIM), { 'reviews.arbiter': review('u-cto', 'reject', 'No') }));
    await prepara(env, claim({ first: review('u-em', 'accept', 'Sí'), second: review('u-head', 'reject', 'No') }));
    await assertSucceeds(updateDoc(doc(as('u-cto'), CLAIM), { 'reviews.arbiter': review('u-cto', 'accept', 'Lo he visto') }));
  });

  test('al reenviar, el ingeniero archiva la ronda y las revisiones vuelven a cero', async () => {
    const old = claim({ first: review('u-em', 'reject', 'Sin ADR') });
    await prepara(env, old);
    const round = { evidence: old.evidence, reviews: old.reviews };
    await assertFails(updateDoc(doc(as('u-dev'), CLAIM), { evidence: { text: 'Ahora con ADR', links: [] } }));
    await assertFails(updateDoc(doc(as('u-dev'), CLAIM), {
      evidence: { text: 'Ahora con ADR', links: [] }, reviews: {}, history: [{ evidence, reviews: {} }],
    }));
    await assertSucceeds(updateDoc(doc(as('u-dev'), CLAIM), {
      evidence: { text: 'Ahora con ADR', links: [] }, reviews: {}, history: [round],
    }));
    // Con historial previo: no se puede reescribir lo archivado.
    const next = { evidence: { text: 'Ahora con ADR', links: [] }, reviews: {} };
    await assertFails(updateDoc(doc(as('u-dev'), CLAIM), {
      evidence: { text: 'Otra vez', links: [] }, history: [next, next],
    }));
    await assertSucceeds(updateDoc(doc(as('u-dev'), CLAIM), {
      evidence: { text: 'Otra vez', links: [] }, history: [round, next],
    }));
  });

  test('un revisor marca directamente con su revisión y su motivo; el árbitro no (RMR-TSK-0704)', async () => {
    await prepara(env);
    const byReviewer = (uid, slot, decision, reason) => ({
      ...claim({ [slot]: review(uid, decision, reason) }),
      evidence: { text: reason || 'x', links: [] }, claimedBy: { uid, name: uid },
    });
    await assertFails(setDoc(doc(as('u-em'), CLAIM), byReviewer('u-em', 'first', 'accept', '')));
    await assertFails(setDoc(doc(as('u-em'), CLAIM), byReviewer('u-em', 'second', 'accept', 'Sí')));
    await assertFails(setDoc(doc(as('u-em'), CLAIM), { ...byReviewer('u-em', 'first', 'accept', 'Sí'), claimedBy: { uid: 'u-dev', name: 'Dev' } }));
    await assertFails(setDoc(doc(as('u-cto'), CLAIM), byReviewer('u-cto', 'arbiter', 'accept', 'Sí')));
    await assertFails(setDoc(doc(as('u-otro'), CLAIM), byReviewer('u-otro', 'first', 'accept', 'Sí')));
    await assertSucceeds(setDoc(doc(as('u-em'), CLAIM), byReviewer('u-em', 'first', 'accept', 'Lideró el rediseño')));
    await assertSucceeds(updateDoc(doc(as('u-head'), CLAIM), { 'reviews.second': review('u-head', 'accept', 'De acuerdo') }));
  });

  test('sobre una marca retirada, el revisor archiva la ronda y marca de nuevo (RMR-TSK-0704)', async () => {
    const old = { ...claim(), status: 'withdrawn' };
    await prepara(env, old);
    const round = { evidence: old.evidence, reviews: old.reviews };
    const remark = (history) => ({
      status: 'claimed', evidence: { text: 'Aún no', links: [] }, claimedBy: { uid: 'u-em', name: 'u-em' },
      claimedAt: '2026-10-14', reviews: { first: review('u-em', 'reject', 'Aún no') }, history,
    });
    await assertFails(updateDoc(doc(as('u-em'), CLAIM), remark([])));
    await assertSucceeds(updateDoc(doc(as('u-em'), CLAIM), remark([round])));
  });

  test('el ingeniero reenvía una marca de su revisor y pasa a ser suya, no de otro (RMR-TSK-0704)', async () => {
    const byEm = { ...claim({ first: review('u-em', 'reject', 'Aún no') }), claimedBy: { uid: 'u-em', name: 'EM' } };
    await prepara(env, byEm);
    const round = { evidence: byEm.evidence, reviews: byEm.reviews };
    const resend = (uid) => ({
      evidence: { text: 'Ya está el ADR', links: [] }, reviews: {}, history: [round], claimedBy: { uid, name: uid },
    });
    await assertFails(updateDoc(doc(as('u-dev'), CLAIM), resend('u-head')));
    // Reenviar dejándola a nombre del revisor tampoco: la marca pasa a quien la reenvía.
    await assertFails(updateDoc(doc(as('u-dev'), CLAIM), { ...resend('u-em'), claimedBy: byEm.claimedBy }));
    await assertSucceeds(updateDoc(doc(as('u-dev'), CLAIM), resend('u-dev')));
  });

  test('nadie cambia los revisores desde el cliente, ni el superadmin', async () => {
    await prepara(env);
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins', 'u-admin'), { name: 'Admin' }));
    const admin = as('u-admin');
    const solo = { careerReviewers: { firstUid: 'u-admin', secondUid: null, arbiterUid: null } };
    await assertFails(updateDoc(doc(as('u-em'), 'people/dev'), solo));
    await assertFails(updateDoc(doc(admin, 'people/dev'), solo));
    await assertSucceeds(updateDoc(doc(admin, 'people/dev'), { name: 'Dev Dos' }));
  });
});
