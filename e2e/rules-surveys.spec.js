/**
 * Tests de las REGLAS de gestión de encuestas (RMR-TSK-0476).
 *
 * Gestionar encuestas era un rol aparte (/surveyAdmins), creado antes de que
 * existiera el sistema de permisos. Es exactamente «puede gestionar la
 * herramienta Encuestas», así que pasa a concederse como permiso, materializado
 * en /toolManagers — el mismo espejo que usan las demás herramientas.
 *
 * Lo que se comprueba aquí es que el cambio es ADITIVO: quien tiene el permiso
 * nuevo entra, quien sigue con el rol antiguo también, y quien no tiene ninguno
 * de los dos sigue fuera. Sin esa última parte, «funciona» no significaría nada.
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
      await setDoc(doc(db, 'surveyAdmins', 'conRolViejo'), { email: 'viejo@tribbuapp.com' });
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  test('quien tiene el permiso de la herramienta gestiona las encuestas', async () => {
    const db = comoEmpleado(env, 'conPermiso').firestore();
    await assertSucceeds(getDoc(doc(db, 'surveys', 'clima-1')));
    await assertSucceeds(setDoc(doc(db, 'surveys', 'clima-2'), { title: 'Nueva' }));
  });

  test('quien aún tiene el rol antiguo sigue entrando: la migración no deja a nadie fuera', async () => {
    const db = comoEmpleado(env, 'conRolViejo').firestore();
    await assertSucceeds(getDoc(doc(db, 'surveys', 'clima-1')));
  });

  test('sin permiso ni rol no se entra, aunque se tenga correo del dominio', async () => {
    const db = comoEmpleado(env, 'cualquiera').firestore();
    await assertFails(getDoc(doc(db, 'surveys', 'clima-1')));
    await assertFails(setDoc(doc(db, 'surveys', 'clima-3'), { title: 'No' }));
  });

  test('el permiso de OTRA herramienta no abre las encuestas', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'toolManagers', 'dora--soloDora'), { toolId: 'dora', uid: 'soloDora' });
    });
    const db = comoEmpleado(env, 'soloDora').firestore();
    await assertFails(getDoc(doc(db, 'surveys', 'clima-1')));
  });
});
