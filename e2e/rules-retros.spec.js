/**
 * Tests de las REGLAS de acceso a retros (RMR-TSK-0453).
 *
 * La intimidad de una retro no la garantiza la interfaz: la garantizan las
 * reglas de Firestore. Aquí se comprueban contra el emulador, con
 * `@firebase/rules-unit-testing` — que estaba en las dependencias del proyecto
 * sin usarse.
 *
 * Lo que más importa es el caso negativo: alguien de la organización con el id
 * de la retro en la mano NO debe poder leerla. Hasta este cambio sí podía, por
 * el simple hecho de tener correo del dominio.
 *
 * Va como spec de Playwright para reutilizar el arranque de emuladores del
 * proyecto, pero no abre ningún navegador: habla con Firestore directamente.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { test, expect } from '@playwright/test';

const PROJECT = 'demo-grebla-rules';
const RETRO = 'retro-1';

/** Entorno con las reglas reales del repo. */
async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    // El puerto sale de firebase.json (8181), no del 8080 por defecto: con el
    // puerto equivocado los tests no fallan, se quedan esperando.
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

/** Contexto autenticado con correo del dominio, que es el caso interesante. */
const comoEmpleado = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

test.describe('reglas de /retros', () => {
  /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
  let env;

  test.beforeAll(async () => {
    env = await testEnv();
  });

  test.afterAll(async () => {
    await env?.cleanup();
  });

  test.beforeEach(async () => {
    await env.clearFirestore();
    // Una retro de Ana, con Luis dentro y «jefa» en la rama.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'retros', RETRO), {
        name: 'Retro del equipo',
        ownerLeaderUid: 'ana',
        memberUids: ['ana', 'luis'],
        branchUids: ['jefa'],
        status: 'open',
      });
    });
  });

  test('quien está dentro la lee', async () => {
    const db = comoEmpleado(env, 'luis').firestore();
    await assertSucceeds(getDoc(doc(db, 'retros', RETRO)));
  });

  test('el manager de la rama la lee sin haber entrado', async () => {
    const db = comoEmpleado(env, 'jefa').firestore();
    await assertSucceeds(getDoc(doc(db, 'retros', RETRO)));
  });

  test('alguien de la organización con el id NO la lee', async () => {
    // Este es el caso que cambia: antes bastaba el correo del dominio.
    const db = comoEmpleado(env, 'ajena').firestore();
    await assertFails(getDoc(doc(db, 'retros', RETRO)));
  });

  test('sin sesión tampoco', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'retros', RETRO)));
  });

  test('las notas heredan el acceso de su retro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'retros', RETRO, 'notes', 'n1'), {
        text: 'algo que se dijo dentro', authorUid: 'luis', columnId: 'bien', voters: [],
      });
    });
    await assertSucceeds(getDoc(doc(comoEmpleado(env, 'luis').firestore(), 'retros', RETRO, 'notes', 'n1')));
    await assertFails(getDoc(doc(comoEmpleado(env, 'ajena').firestore(), 'retros', RETRO, 'notes', 'n1')));
  });

  test('una retro SIN migrar no revienta la consulta: simplemente no se ve', async () => {
    // En un `list` la regla se evalúa por documento y tocar un campo ausente
    // aborta la consulta entera. Un solo documento viejo dejaría el listado de
    // todo el mundo a cero, que es justo lo que pasó al probarlo.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'retros', 'retro-vieja'), {
        name: 'Anterior al cambio', ownerLeaderUid: 'ana', status: 'open',
      });
    });
    await assertFails(getDoc(doc(comoEmpleado(env, 'luis').firestore(), 'retros', 'retro-vieja')));
    // Y la que sí está migrada se sigue leyendo con normalidad.
    await assertSucceeds(getDoc(doc(comoEmpleado(env, 'luis').firestore(), 'retros', RETRO)));
  });

  test('cada cual puede salirse, y solo a sí mismo', async () => {
    const luis = comoEmpleado(env, 'luis').firestore();
    // Echar a otra persona aprovechando el mismo permiso: no.
    await assertFails(updateDoc(doc(luis, 'retros', RETRO), { memberUids: ['luis'] }));
    // Salirse: sí.
    await assertSucceeds(updateDoc(doc(luis, 'retros', RETRO), { memberUids: ['ana'] }));
  });

  test('quien no está dentro no puede tocar la lista de miembros', async () => {
    const ajena = comoEmpleado(env, 'ajena').firestore();
    await assertFails(updateDoc(doc(ajena, 'retros', RETRO), { memberUids: ['ana', 'luis', 'ajena'] }));
  });

  test('un superadmin las ve todas', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'jefaza'), { name: 'Super' });
    });
    await assertSucceeds(getDoc(doc(comoEmpleado(env, 'jefaza').firestore(), 'retros', RETRO)));
  });

  test('quien convoca no puede quedarse fuera de su propia retro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'leaders', 'nueva'), { displayName: 'Nueva', reportsTo: null });
    });
    const db = comoEmpleado(env, 'nueva').firestore();
    // Sin incluirse en memberUids: la retro no se podría ni leer a sí misma.
    await assertFails(setDoc(doc(db, 'retros', 'r-mala'), {
      name: 'Sin mí', ownerLeaderUid: 'nueva', memberUids: ['otro'], branchUids: [], status: 'open',
    }));
    await assertSucceeds(setDoc(doc(db, 'retros', 'r-buena'), {
      name: 'Conmigo', ownerLeaderUid: 'nueva', memberUids: ['nueva'], branchUids: [], status: 'open',
    }));
  });
});

test('las reglas del repo son las que se prueban aquí', async () => {
  // Guarda contra el despiste de probar unas reglas y desplegar otras.
  expect(readFileSync('firestore.rules', 'utf8')).toContain('function canReadRetro(');
});
