/**
 * Un manager del directorio entra por primera vez (RMR-TSK-0660): cuando su
 * ficha recibe el uid, el trigger le da el rol de líder y le pone como manager
 * de O2O de su equipo. Se prueba contra el emulador de functions real.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect } from './fixtures.js';

const BOSS = 'e2e-dir-boss';
const REPORT = 'e2e-dir-report';
const UID = 'e2e-dir-boss-uid';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test.beforeEach(async () => {
  await db().doc(`people/${BOSS}`).set({ name: 'Jefa del directorio', uid: null, active: true, reportsToPersonId: null });
  await db().doc(`people/${REPORT}`).set({ name: 'Persona del directorio', uid: null, active: true, reportsToPersonId: BOSS });
});

test.afterEach(async () => {
  await Promise.all([`people/${BOSS}`, `people/${REPORT}`, `leaders/${UID}`].map((p) => db().doc(p).delete().catch(() => {})));
});

test('al recibir su cuenta, la jefa del directorio pasa a líder y a manager de O2O de su equipo', async () => {
  await db().doc(`people/${BOSS}`).update({ uid: UID });

  await expect.poll(async () => (await db().doc(`leaders/${UID}`).get()).data()?.displayName ?? null,
    { timeout: 20_000 }).toBe('Jefa del directorio');
  await expect.poll(async () => (await db().doc(`people/${REPORT}`).get()).data()?.o2oManagerUids ?? [],
    { timeout: 20_000 }).toEqual([UID]);
  await expect.poll(async () => (await db().doc(`people/${REPORT}`).get()).data()?.ownerLeaderUid ?? null,
    { timeout: 20_000 }).toBe(UID);
});

test('la rama del directorio queda en cada ficha: quien cuelga de la jefa la tiene como manager (RMR-TSK-0661)', async () => {
  await db().doc(`people/${BOSS}`).update({ uid: UID });

  await expect.poll(async () => (await db().doc(`people/${REPORT}`).get()).data()?.directoryManagerUids ?? null,
    { timeout: 20_000 }).toEqual([UID]);
});
