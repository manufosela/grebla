/**
 * EM por equipo en GREBLA (RMR-TSK-0716): al asignar el EM de un equipo en
 * /config/org.teamEms, quien está en ese equipo pasa a tenerlo como jefe para
 * todo lo de EM (dueño, O2O, revisor), sin tocar su jefe de Notion.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { test, expect } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const tech = (level, team, reportsToPersonId, uid) => ({
  name: `EM-equipo ${level}`, uid, active: true, orgBranch: 'engineering', reportsToPersonId,
  notion: { level, team },
});
const IDS = ['e2e-teq-cto', 'e2e-teq-em', 'e2e-teq-other', 'e2e-teq-dev'];

test('asignar el EM de un equipo lo hace jefe efectivo, sin tocar Notion (RMR-TSK-0716)', async () => {
  test.setTimeout(60_000);
  const config = db().doc('config/org');
  const previo = (await config.get()).data()?.teamEms ?? null;
  try {
    await db().doc('people/e2e-teq-cto').set(tech('C-level', 'Backend', null, 'e2e-teq-u-cto'));
    await db().doc('people/e2e-teq-em').set(tech('Manager', 'Mobile', 'e2e-teq-cto', 'e2e-teq-u-em'));
    await db().doc('people/e2e-teq-other').set(tech('Manager', 'Backend', 'e2e-teq-cto', 'e2e-teq-u-other'));
    await db().doc('people/e2e-teq-dev').set(tech('Individual Contributor', 'E2E-IA', 'e2e-teq-other', null));
    const dev = () => db().doc('people/e2e-teq-dev').get().then((s) => s.data());
    await expect.poll(async () => (await dev())?.careerReviewers?.firstUid, { timeout: 20_000 }).toBe('e2e-teq-u-other');

    await config.set({ teamEms: { 'E2E-IA': 'e2e-teq-em' } }, { merge: true });
    await expect.poll(async () => (await dev())?.careerReviewers?.firstUid, { timeout: 20_000 }).toBe('e2e-teq-u-em');
    const after = await dev();
    expect(after.ownerLeaderUid).toBe('e2e-teq-u-em');
    expect(after.directoryManagerUids[0]).toBe('e2e-teq-u-em');
    expect(after.reportsToPersonId).toBe('e2e-teq-other');
  } finally {
    await config.set({ teamEms: previo ?? FieldValue.delete() }, { merge: true });
    for (const id of IDS) await db().doc(`people/${id}`).delete();
  }
});
