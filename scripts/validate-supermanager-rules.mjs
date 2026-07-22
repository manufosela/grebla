/**
 * Validación en EMULADOR de las reglas del SUPERMANAGER (Head of X, RMR-PCS-0023 /
 * RMR-TSK-0292). El Head ve y ACTÚA sobre la gente de los EMs que le reportan
 * (leaders.reportsTo == su uid), como sustituto de un EM, sin ser superadmin.
 *
 * Comprueba contra el emulador de Firestore (puerto 8181, firebase.json) que:
 *  1. Prerrequisito: /supermanagers es legible por cualquier autenticado
 *     (resolveAccess lee el propio doc; sin regla, ese getDoc rompería para todos)
 *     y solo lo escribe el superadmin.
 *  2. El Head LEE y ACTUALIZA a la gente de su rama (owner reporta a él), incluido
 *     el subárbol (lecturas/notas), pero NO transfiere la propiedad ni crea/borra.
 *  3. El Head NO ve ni toca a gente fuera de su rama (owner que no le reporta).
 *  4. Regresión: un líder normal solo ve las suyas (no gana poder de rama); el
 *     dueño conserva su acceso.
 *
 * Uso (arranca el emulador, ejecuta y lo apaga):
 *   firebase emulators:exec --only firestore --project demo-grebla \
 *     "node scripts/validate-supermanager-rules.mjs"
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, query, where,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-grebla';

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: '127.0.0.1',
    port: 8181,
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});

/** Contador de comprobaciones pasadas (el script FALLA a la primera que no). */
let passed = 0;
/** @param {string} label @param {Promise<unknown>} assertion */
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
  // Semilla con el Admin SDK (omite reglas): un Head, dos EMs que le reportan, un
  // líder que NO le reporta, y personas de cada uno con un doc de subárbol.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'super-uid'), { name: 'Super' });
    await setDoc(doc(db, 'supermanagers', 'head-uid'), { name: 'Head of Tech' });
    await setDoc(doc(db, 'leaders', 'em1-uid'), { name: 'EM Uno', reportsTo: 'head-uid' });
    await setDoc(doc(db, 'leaders', 'em2-uid'), { name: 'EM Dos', reportsTo: 'head-uid' });
    await setDoc(doc(db, 'leaders', 'lone-uid'), { name: 'Líder Suelto' });
    await setDoc(doc(db, 'people', 'pb1'), { name: 'De EM1', ownerLeaderUid: 'em1-uid' });
    await setDoc(doc(db, 'people', 'pb2'), { name: 'De EM2', ownerLeaderUid: 'em2-uid' });
    await setDoc(doc(db, 'people', 'pout'), { name: 'Fuera de rama', ownerLeaderUid: 'lone-uid' });
    await setDoc(doc(db, 'people', 'pb1', 'seniority', 'r1'), { date: '2026-07-01', valor: 3 });
    await setDoc(doc(db, 'people', 'pout', 'seniority', 'r1'), { date: '2026-07-01', valor: 3 });
  });

  const head = env.authenticatedContext('head-uid').firestore();
  const em1 = env.authenticatedContext('em1-uid').firestore();
  const nobody = env.authenticatedContext('nobody-uid').firestore();

  console.log('Prerrequisito: /supermanagers legible por autenticados, escritura solo superadmin:');
  await check(
    'el Head LEE su propio doc /supermanagers (resolveAccess no rompe)',
    assertSucceeds(getDoc(doc(head, 'supermanagers', 'head-uid'))),
  );
  await check(
    'cualquier autenticado LEE /supermanagers (aunque no exista su doc)',
    assertSucceeds(getDoc(doc(nobody, 'supermanagers', 'nobody-uid'))),
  );
  await check(
    'un no-superadmin NO se auto-otorga supermanager',
    assertFails(setDoc(doc(em1, 'supermanagers', 'em1-uid'), { name: 'Intruso' })),
  );

  console.log('El Head VE y ACTÚA sobre su rama (EMs que le reportan):');
  await check(
    'Head LEE a la gente de EM1 (owner reporta a él)',
    assertSucceeds(getDoc(doc(head, 'people', 'pb1'))),
  );
  await check(
    'Head LEE a la gente de EM2 (owner reporta a él)',
    assertSucceeds(getDoc(doc(head, 'people', 'pb2'))),
  );
  await check(
    'Head ACTUALIZA a la gente de su rama (sustituye al EM)',
    assertSucceeds(updateDoc(doc(head, 'people', 'pb1'), { levelId: 'l3' })),
  );
  await check(
    'Head LEE el subárbol de su rama (lecturas por dimensión)',
    assertSucceeds(getDoc(doc(head, 'people', 'pb1', 'seniority', 'r1'))),
  );
  await check(
    'Head ESCRIBE el subárbol de su rama (nota/lectura)',
    assertSucceeds(setDoc(doc(head, 'people', 'pb1', 'seniority', 'r2'), { date: '2026-07-10', valor: 4 })),
  );

  // Las comprobaciones anteriores usan getDoc (documento a documento), pero la
  // app LISTA con getDocs + where('ownerLeaderUid','in',[...]). Firestore valida
  // las queries de forma conservadora ("rules are not filters") y puede
  // rechazarlas aunque el getDoc equivalente pase — es lo que provocó
  // RMR-BUG-0009. Así que se valida la QUERY tal y como la lanza la tool Equipo.
  console.log('El Head LISTA su rama con una QUERY (no solo getDoc):');
  await check(
    'Head LISTA con where(ownerLeaderUid, in, [su rama]) — la query de peopleRepo',
    assertSucceeds(getDocs(query(
      collection(head, 'people'),
      where('ownerLeaderUid', 'in', ['em1-uid', 'em2-uid']),
    ))),
  );
  await check(
    'Head NO LISTA si cuela en el in a un líder que no le reporta',
    assertFails(getDocs(query(
      collection(head, 'people'),
      where('ownerLeaderUid', 'in', ['em1-uid', 'lone-uid']),
    ))),
  );
  await check(
    'Head NO LISTA la colección entera sin filtro de rama',
    assertFails(getDocs(collection(head, 'people'))),
  );
  await check(
    'Regresión: un líder normal LISTA lo suyo con where(ownerLeaderUid, ==, su uid)',
    assertSucceeds(getDocs(query(
      collection(em1, 'people'),
      where('ownerLeaderUid', '==', 'em1-uid'),
    ))),
  );

  console.log('El Head NO transfiere propiedad ni crea/borra:');
  await check(
    'Head NO reasigna el ownerLeaderUid (no roba la persona a otra rama)',
    assertFails(updateDoc(doc(head, 'people', 'pb1'), { ownerLeaderUid: 'lone-uid' })),
  );
  await check(
    'Head NO CREA personas (el alta sigue siendo del dueño/superadmin)',
    assertFails(setDoc(doc(head, 'people', 'pnew'), { name: 'Nueva', ownerLeaderUid: 'em1-uid' })),
  );
  await check(
    'Head NO BORRA personas de su rama',
    assertFails(deleteDoc(doc(head, 'people', 'pb1'))),
  );

  console.log('El Head NO ve ni toca fuera de su rama:');
  await check(
    'Head NO LEE a gente de un líder que no le reporta',
    assertFails(getDoc(doc(head, 'people', 'pout'))),
  );
  await check(
    'Head NO ACTUALIZA a gente fuera de su rama',
    assertFails(updateDoc(doc(head, 'people', 'pout'), { levelId: 'l3' })),
  );
  await check(
    'Head NO LEE el subárbol de gente fuera de su rama',
    assertFails(getDoc(doc(head, 'people', 'pout', 'seniority', 'r1'))),
  );
  await check(
    'Head NO ESCRIBE el subárbol de gente fuera de su rama',
    assertFails(setDoc(doc(head, 'people', 'pout', 'seniority', 'r2'), { date: '2026-07-10', valor: 4 })),
  );

  console.log('Regresión: un líder normal no gana poder de rama; el dueño conserva su acceso:');
  await check(
    'EM1 (dueño) LEE a su propia gente',
    assertSucceeds(getDoc(doc(em1, 'people', 'pb1'))),
  );
  await check(
    'EM1 NO ve a la gente de EM2 (no es su rama, es solo un líder)',
    assertFails(getDoc(doc(em1, 'people', 'pb2'))),
  );

  console.log(`\n${passed} comprobaciones de reglas del supermanager pasadas.`);
} finally {
  await env.cleanup();
}
