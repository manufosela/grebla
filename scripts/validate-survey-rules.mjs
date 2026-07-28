/**
 * Validación en EMULADOR de las reglas de ENCUESTAS ANÓNIMAS (RMR-TSK-0318).
 * Lo crítico: el anonimato es por construcción — NINGÚN cliente puede escribir
 * respuestas ni tokens (solo la Cloud Function con Admin SDK), y solo el admin
 * (superadmin en Fase 1) puede leer.
 *
 * Contra el emulador de Firestore (puerto 8181, firebase.json) verifica que:
 *  1. El admin (superadmin) crea/lee la encuesta y lee tokens y respuestas.
 *  2. Un miembro normal NO lee ni la encuesta, ni tokens, ni respuestas.
 *  3. Un no-autenticado NO lee nada.
 *  4. NADIE (ni el admin) escribe tokens/answers desde el cliente: esas
 *     colecciones son solo-CF (Admin SDK).
 *
 * Uso:
 *   firebase emulators:exec --only firestore --project demo-grebla \
 *     "node scripts/validate-survey-rules.mjs"
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-grebla';

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: '127.0.0.1',
    port: 8181,
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});

let passed = 0;
async function check(label, assertion) {
  try {
    await assertion;
    passed += 1;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}`);
    throw err;
  }
}

try {
  // Semilla (Admin SDK, omite reglas): un superadmin, un miembro, una encuesta con
  // un token (lado admin) y una respuesta anónima.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'super-uid'), { name: 'People admin' });
    await setDoc(doc(db, 'surveyAdmins', 'people-uid'), { name: 'Gestor de encuestas' });
    await setDoc(doc(db, 'members', 'alice-uid'), { name: 'Alice' });
    await setDoc(doc(db, 'surveys', 's1'), { title: 'Clima agosto', status: 'open', threshold: 5 });
    await setDoc(doc(db, 'surveys', 's1', 'tokens', 'tok1'), { email: 'x@tribbuapp.com', metadata: { dept: 'Eng' }, used: false });
    await setDoc(doc(db, 'surveys', 's1', 'answers', 'ans1'), { answers: { enps: 9 }, metadata: { dept: 'Eng', tenure: '1-3' } });
  });

  const admin = env.authenticatedContext('super-uid').firestore();
  const people = env.authenticatedContext('people-uid').firestore();
  const member = env.authenticatedContext('alice-uid').firestore();
  const anon = env.unauthenticatedContext().firestore();

  console.log('El admin (superadmin) gestiona y lee todo:');
  await check('crea/configura una encuesta', assertSucceeds(setDoc(doc(admin, 'surveys', 's2'), { title: 'Otra', status: 'draft' })));
  await check('lee la encuesta', assertSucceeds(getDoc(doc(admin, 'surveys', 's1'))));
  await check('lee los tokens (participación por depto, reenvío)', assertSucceeds(getDoc(doc(admin, 'surveys', 's1', 'tokens', 'tok1'))));
  await check('lee las respuestas anónimas (dashboards)', assertSucceeds(getDoc(doc(admin, 'surveys', 's1', 'answers', 'ans1'))));

  console.log('El gestor de encuestas (People, NO superadmin) gestiona y lee:');
  await check('crea una encuesta', assertSucceeds(setDoc(doc(people, 'surveys', 'sp'), { title: 'De People', status: 'draft' })));
  await check('lee la encuesta', assertSucceeds(getDoc(doc(people, 'surveys', 's1'))));
  await check('lee los tokens', assertSucceeds(getDoc(doc(people, 'surveys', 's1', 'tokens', 'tok1'))));
  await check('lee las respuestas', assertSucceeds(getDoc(doc(people, 'surveys', 's1', 'answers', 'ans1'))));
  await check('NO se auto-concede el rol (solo superadmin escribe /surveyAdmins)',
    assertFails(setDoc(doc(people, 'surveyAdmins', 'people-uid'), { name: 'x' })));
  await check('el superadmin SÍ concede el rol', assertSucceeds(setDoc(doc(admin, 'surveyAdmins', 'otro-uid'), { name: 'Nuevo' })));

  console.log('Un miembro normal NO ve nada de la encuesta:');
  await check('NO lee la encuesta', assertFails(getDoc(doc(member, 'surveys', 's1'))));
  await check('NO lee los tokens', assertFails(getDoc(doc(member, 'surveys', 's1', 'tokens', 'tok1'))));
  await check('NO lee las respuestas', assertFails(getDoc(doc(member, 'surveys', 's1', 'answers', 'ans1'))));
  await check('NO crea encuestas', assertFails(setDoc(doc(member, 'surveys', 's3'), { title: 'Intrusa' })));

  console.log('Un no-autenticado NO lee nada:');
  await check('anónimo NO lee la encuesta', assertFails(getDoc(doc(anon, 'surveys', 's1'))));
  await check('anónimo NO lee respuestas', assertFails(getDoc(doc(anon, 'surveys', 's1', 'answers', 'ans1'))));

  console.log('Tokens y respuestas son SOLO-CF: nadie escribe desde el cliente:');
  await check('el admin NO escribe un token (lo hace la CF)', assertFails(setDoc(doc(admin, 'surveys', 's1', 'tokens', 'tok2'), { email: 'y@tribbuapp.com', used: false })));
  await check('el admin NO escribe una respuesta (la escribe la CF)', assertFails(setDoc(doc(admin, 'surveys', 's1', 'answers', 'ans2'), { answers: { enps: 1 } })));
  await check('un miembro NO escribe una respuesta', assertFails(setDoc(doc(member, 'surveys', 's1', 'answers', 'ans3'), { answers: { enps: 10 } })));
  await check('un anónimo NO escribe una respuesta', assertFails(setDoc(doc(anon, 'surveys', 's1', 'answers', 'ans4'), { answers: { enps: 10 } })));

  console.log(`\n✅ Reglas de Encuestas: ${passed} comprobaciones OK`);
} finally {
  await env.cleanup();
}
