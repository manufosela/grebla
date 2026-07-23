/**
 * Arranque de la batería E2E (RMR-TSK-0299). Corre UNA vez antes de los tests,
 * con el Admin SDK apuntando a los emuladores (emulators:exec deja puestas
 * FIREBASE_AUTH_EMULATOR_HOST y FIRESTORE_EMULATOR_HOST). Su trabajo:
 *
 *  1. Crear los 3 usuarios de test, uno por rol.
 *  2. Sembrar la jerarquía y las personas base (un Head con un manager debajo y
 *     una persona de ingeniero).
 *  3. Firmar un custom token por rol y dejarlo en e2e/.auth/{rol}.json, que los
 *     tests canjean por una sesión con window.__e2eSignIn (sin login de Google).
 *
 * No toca producción: todo vive en los emuladores y desaparece al apagarlos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '.auth');

/** uids fijos, uno por rol, para que los tests sepan a quién esperan ver. */
export const ROLES = {
  superadmin: 'e2e-superadmin',
  head: 'e2e-head',       // Head of X y, a la vez, líder con su propio equipo
  engineer: 'e2e-engineer',
  adminmgr: 'e2e-adminmgr', // admin de instancia Y ADEMÁS líder de un equipo (RMR-TSK-0309)
};
const MANAGER = 'e2e-manager'; // reporta al Head; no es usuario que loguee
const OUTSIDER = 'e2e-outsider'; // líder que NO reporta al Head: prueba la exclusión

export default async function globalSetup() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'Los E2E deben correr dentro de los emuladores. Usa:\n' +
      '  firebase emulators:exec --only auth,firestore,functions --project demo-grebla "npx playwright test"',
    );
  }

  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  const auth = getAuth();
  const db = getFirestore();

  // Usuarios de Auth (idempotente: si ya existen de una corrida previa, se reusan).
  const ensureUser = async (uid, email) => {
    try { await auth.createUser({ uid, email }); }
    catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  };
  await Promise.all([
    ensureUser(ROLES.superadmin, 'superadmin@e2e.test'),
    ensureUser(ROLES.head, 'head@e2e.test'),
    ensureUser(ROLES.engineer, 'engineer@e2e.test'),
    ensureUser(ROLES.adminmgr, 'adminmgr@e2e.test'),
  ]);

  // Roles y jerarquía. El Head es también líder (para tener equipo propio); el
  // manager le reporta; la persona del ingeniero cuelga del manager.
  await db.doc(`admins/${ROLES.superadmin}`).set({ name: 'Super E2E' });
  await db.doc(`supermanagers/${ROLES.head}`).set({ displayName: 'Head E2E', email: 'head@e2e.test' });
  await db.doc(`leaders/${ROLES.head}`).set({ displayName: 'Head E2E', email: 'head@e2e.test', reportsTo: null });
  await db.doc(`leaders/${MANAGER}`).set({ displayName: 'Manager E2E', email: 'manager@e2e.test', reportsTo: ROLES.head });
  // Líder fuera de la rama del Head (reportsTo null): su gente NO debe verse.
  await db.doc(`leaders/${OUTSIDER}`).set({ displayName: 'Ajeno E2E', email: 'ajeno@e2e.test', reportsTo: null });
  // Líder sin Head asignado, para el test de asignación por UI (no interfiere con
  // la exclusión: ese lo prueba OUTSIDER).
  await db.doc('leaders/e2e-unassigned').set({ displayName: 'Sin Head E2E', email: 'sinhead@e2e.test', reportsTo: null });
  await db.doc('people/e2e-person-eng').set({
    name: 'Ingeniero E2E', uid: ROLES.engineer, ownerLeaderUid: MANAGER, active: true,
  });
  await db.doc('people/e2e-person-mgr').set({
    name: 'Persona del manager', uid: null, ownerLeaderUid: MANAGER, active: true,
  });
  await db.doc('people/e2e-person-out').set({
    name: 'Persona de fuera', uid: null, ownerLeaderUid: OUTSIDER, active: true,
  });
  // Admin que ADEMÁS lidera (RMR-TSK-0309): gobierna la instancia y tiene equipo
  // propio, así que puede elegir «mi equipo» vs «toda la organización».
  await db.doc(`admins/${ROLES.adminmgr}`).set({ name: 'Admin-Manager E2E' });
  await db.doc(`leaders/${ROLES.adminmgr}`).set({ displayName: 'Admin-Manager E2E', email: 'adminmgr@e2e.test', reportsTo: null });
  await db.doc('people/e2e-person-adminmgr').set({
    name: 'Persona del admin-manager', uid: null, ownerLeaderUid: ROLES.adminmgr, active: true,
  });
  // Retros: una del manager de la rama (el Head debe verla) y otra del ajeno (no).
  await db.doc('retros/e2e-retro-branch').set({
    name: 'Retro de la rama', ownerLeaderUid: MANAGER, status: 'open',
    scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });
  await db.doc('retros/e2e-retro-out').set({
    name: 'Retro ajena', ownerLeaderUid: OUTSIDER, status: 'open',
    scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });

  // Custom token por rol, para que cada test entre sin pasar por el login.
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const [role, uid] of Object.entries(ROLES)) {
    const token = await auth.createCustomToken(uid);
    writeFileSync(join(AUTH_DIR, `${role}.json`), JSON.stringify({ role, uid, token }, null, 2));
  }
}
