/**
 * ¿Qué puede leer una persona de lo que se escribe SOBRE ella? (RMR-TSK-0578)
 *
 * «Mi espacio» dice hoy, literalmente: «Solo ves lo que tu manager ha marcado
 * como compartido; sus notas privadas no son visibles». Esa frase es una promesa
 * de intimidad, y una promesa que solo cumple la interfaz no la cumple nadie:
 * cualquiera puede abrir la consola del navegador y pedir el documento.
 *
 * Aquí se comprueba contra las reglas reales qué pasa de verdad, que es el único
 * sitio donde esa promesa puede vivir.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-conversaciones';
const PERSONA = 'p-ana';
const ANA = 'uid-ana';
const MANAGER = 'uid-manager';
const OTRA = 'uid-otra';

async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

const comoEmpleado = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

test.describe('reglas de /people/{id}/conversations', () => {
  /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
  let env;

  test.beforeAll(async () => {
    env = await testEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'leaders', MANAGER), { displayName: 'Manager', reportsTo: null });
      await setDoc(doc(db, 'people', PERSONA), {
        name: 'Ana', uid: ANA, ownerLeaderUid: MANAGER, active: true,
      });
      // Una nota de O2O que el manager NO ha compartido.
      await setDoc(doc(db, 'people', PERSONA, 'conversations', 'c1'), {
        type: 'o2o', date: '2026-09-01', notes: 'Le cuesta delegar; hablarlo en la próxima.',
      });
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  test('el manager lee las conversaciones de su gente', async () => {
    const db = comoEmpleado(env, MANAGER).firestore();
    await assertSucceeds(getDoc(doc(db, 'people', PERSONA, 'conversations', 'c1')));
  });

  test('alguien de fuera NO las lee, aunque tenga correo del dominio', async () => {
    const db = comoEmpleado(env, OTRA).firestore();
    await assertFails(getDoc(doc(db, 'people', PERSONA, 'conversations', 'c1')));
  });

  test('LA PROPIA PERSONA sí las lee, incluidas las no compartidas', async () => {
    // Esto es lo que se quiere documentar: la pantalla promete que no, y las
    // reglas dicen que sí. Si algún día se cierra, este test cambia de bando y
    // deja constancia del porqué.
    const db = comoEmpleado(env, ANA).firestore();
    await assertSucceeds(getDoc(doc(db, 'people', PERSONA, 'conversations', 'c1')));
  });
});
