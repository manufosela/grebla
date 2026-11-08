/**
 * Encuestas salió de GREBLA (HU-0016). Sus datos siguen en la base, pero ya
 * ningún cliente los lee ni los escribe: ni quien tenía el permiso, ni quien
 * tenía el rol antiguo, ni el superadmin. Lo único que los toca es el Admin SDK.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-surveys';

async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    // El puerto sale de firebase.json (8181), no del 8080 por defecto.
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

const comoEmpleado = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

test.describe('reglas de /surveys', () => {
  let env;

  test.beforeAll(async () => {
    env = await testEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'surveys', 'clima-1'), { title: 'Clima Q3' });
      // Con el permiso nuevo (lo materializa la CF desde la política).
      await setDoc(doc(db, 'toolManagers', 'surveys--conPermiso'), { toolId: 'surveys', uid: 'conPermiso' });
      // Con el rol antiguo, aún sin migrar.
      await setDoc(doc(db, 'surveyAdmins', 'conRolViejo'), { addedAt: 'legacy' });
      await setDoc(doc(db, 'admins', 'jefa'), { email: 'jefa@tribbuapp.com' });
      await setDoc(doc(db, 'padron', 'p1'), { email: 'ana@tribbuapp.com' });
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  for (const quien of ['conPermiso', 'conRolViejo', 'jefa', 'cualquiera']) {
    test(`${quien} ya no lee ni escribe encuestas, padrón ni gestores`, async () => {
      const db = comoEmpleado(env, quien).firestore();
      await assertFails(getDoc(doc(db, 'surveys', 'clima-1')));
      await assertFails(setDoc(doc(db, 'surveys', 'clima-2'), { title: 'Nueva' }));
      await assertFails(getDoc(doc(db, 'padron', 'p1')));
      await assertFails(getDoc(doc(db, 'surveyAdmins', 'conRolViejo')));
    });
  }

  test('los datos siguen ahí: solo se cierra el acceso, no se borra nada', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'surveys', 'clima-1')));
    });
  });
});
