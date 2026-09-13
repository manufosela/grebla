/**
 * Tests de las REGLAS de /toolSettings (RMR-TSK-0496).
 *
 * El umbral de anonimato de Marea se puede subir desde la herramienta, así que
 * deja de ser una constante del código para pasar a ser un documento. Lo que
 * antes protegía un despliegue ahora lo tienen que proteger estas reglas: que
 * solo lo toque quien gestiona la herramienta, y que NADIE —tampoco un
 * superadmin, tampoco un script— pueda dejarlo por debajo de 3.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-tool-settings';

const como = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

test.describe('reglas de /toolSettings', () => {
  let env;

  test.beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'admins', 'jefa'), { name: 'Jefa' });
      // Espejo del grant managedBy que materializa la CF syncToolManagers.
      await setDoc(doc(db, 'toolManagers', 'marea--gestora'), { toolId: 'marea', uid: 'gestora' });
      await setDoc(doc(db, 'toolSettings', 'marea'), { minCount: 3 });
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  test('cualquiera con acceso lee el umbral', async () => {
    // La vista lo necesita para explicar por qué un grupo aún no tiene media.
    await assertSucceeds(getDoc(doc(como(env, 'quien-sea').firestore(), 'toolSettings', 'marea')));
  });

  test('quien gestiona la herramienta lo sube', async () => {
    await assertSucceeds(setDoc(doc(como(env, 'gestora').firestore(), 'toolSettings', 'marea'), { minCount: 5 }));
  });

  test('quien no la gestiona no lo toca', async () => {
    await assertFails(setDoc(doc(como(env, 'cualquiera').firestore(), 'toolSettings', 'marea'), { minCount: 5 }));
  });

  test('NADIE lo baja de 3, ni siquiera el superadmin', async () => {
    // El suelo no es una preferencia de configuración: es lo que se le prometió
    // a quien rellena su marea.
    await assertFails(setDoc(doc(como(env, 'jefa').firestore(), 'toolSettings', 'marea'), { minCount: 2 }));
  });

  test('ni lo deja en algo que no sea un entero de personas', async () => {
    const db = como(env, 'jefa').firestore();
    await assertFails(setDoc(doc(db, 'toolSettings', 'marea'), { minCount: 3.5 }));
    await assertFails(setDoc(doc(db, 'toolSettings', 'marea'), { minCount: '5' }));
    await assertFails(setDoc(doc(db, 'toolSettings', 'marea'), { otra: 'cosa' }));
  });

  test('ni lo sube tanto que ningún grupo llegue nunca', async () => {
    await assertFails(setDoc(doc(como(env, 'jefa').firestore(), 'toolSettings', 'marea'), { minCount: 500 }));
  });
});
