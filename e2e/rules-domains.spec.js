/**
 * Tests de las REGLAS de dominios y subdominios (ADR «De squads a dominios y
 * subdominios»).
 *
 * La `key` se exige en las reglas y no solo en el cliente porque es la clave del
 * CONTRATO con el portal: un documento sin ella no se puede publicar ni agregar,
 * así que no debe poder existir. Y un subdominio sin `domainKey` nace huérfano —
 * el portal no sabría a qué dominio sumarlo.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { test } from '@playwright/test';

const PROJECT = 'demo-grebla-rules-domains';

async function testEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT,
    // El puerto sale de firebase.json (8181), no del 8080 por defecto.
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  });
}

const comoEmpleado = (env, uid) => env.authenticatedContext(uid, { email: `${uid}@tribbuapp.com`, email_verified: true });

test.describe('reglas de /domains y /subdomains', () => {
  let env;

  test.beforeAll(async () => {
    env = await testEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'admins', 'jefa'), { name: 'Jefa' });
      await setDoc(doc(db, 'domains', 'd1'), { key: 'tribbu-app', name: 'TRIBBU-APP' });
    });
  });

  test.afterAll(async () => { await env?.cleanup(); });

  test('cualquiera con acceso puede leer el catálogo', async () => {
    // Hace falta para pintar a qué pertenece cada persona.
    const db = comoEmpleado(env, 'cualquiera').firestore();
    await assertSucceeds(getDoc(doc(db, 'domains', 'd1')));
  });

  test('solo el superadmin escribe el catálogo', async () => {
    const ajeno = comoEmpleado(env, 'cualquiera').firestore();
    await assertFails(setDoc(doc(ajeno, 'domains', 'd2'), { key: 'plataforma', name: 'Plataforma' }));

    const jefa = comoEmpleado(env, 'jefa').firestore();
    await assertSucceeds(setDoc(doc(jefa, 'domains', 'd2'), { key: 'plataforma', name: 'Plataforma' }));
  });

  test('un dominio SIN key no se puede crear, ni siendo superadmin', async () => {
    // Sin clave no se puede publicar ni agregar: no debe poder existir.
    const jefa = comoEmpleado(env, 'jefa').firestore();
    await assertFails(setDoc(doc(jefa, 'domains', 'malo'), { name: 'Sin clave' }));
    await assertFails(setDoc(doc(jefa, 'domains', 'malo2'), { key: '', name: 'Clave vacía' }));
  });

  test('un subdominio SIEMPRE dice de qué dominio cuelga', async () => {
    const jefa = comoEmpleado(env, 'jefa').firestore();
    await assertFails(setDoc(doc(jefa, 'subdomains', 'huerfano'), { key: 'caes', name: 'CAES' }));
    await assertSucceeds(setDoc(doc(jefa, 'subdomains', 's1'), {
      key: 'caes', name: 'CAES', domainKey: 'tribbu-app',
    }));
  });

  test('renombrar no exige tocar la clave, pero no se puede dejar sin ella', async () => {
    const jefa = comoEmpleado(env, 'jefa').firestore();
    await assertSucceeds(setDoc(doc(jefa, 'subdomains', 's1'), {
      key: 'caes', name: 'CAEs (otro rótulo)', domainKey: 'tribbu-app',
    }));
    await assertFails(setDoc(doc(jefa, 'subdomains', 's1'), { name: 'Solo nombre' }));
  });
});
