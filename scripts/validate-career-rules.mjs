/**
 * Validación en EMULADOR de las reglas del INGENIERO QUE JUEGA (JG-1,
 * RMR-TSK-0139) y de las máscaras de /carpools.
 *
 * Comprueba contra el emulador de Firestore (puerto 8181, firebase.json) que:
 *  1. El jugador VINCULADO (Person.uid == auth.uid) escribe SU
 *     career/journey, career/playtime y career/achievements.
 *  2. NO escribe los de OTRA persona, y un viewer no escribe ninguno.
 *  3. NO gana escritura fuera de esos tres docs: lecturas/notas/Role Mirror
 *     de su propio subárbol siguen siendo del líder; tampoco puede BORRAR
 *     su journey (el plan se corrige, no se borra).
 *  4. Su ficha /people/{id} sigue acotada a careerTargetLevelId (regresión).
 *  5. El líder dueño conserva su flujo (escribe el journey de su gente).
 *  6. /carpools: cualquier autenticado crea FIRMANDO como él mismo
 *     (createdBy.uid == auth.uid, nunca como otro) y se une/sale con la
 *     máscara members/memberIds/status; nombre/ruta/aforo siguen siendo del
 *     creador o superadmin.
 *
 * Uso (arranca el emulador, ejecuta y lo apaga):
 *   firebase emulators:exec --only firestore --project demo-grebla \
 *     "node scripts/validate-career-rules.mjs"
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  // Semilla con el Admin SDK (omite reglas): roles, dos personas vinculadas y
  // una sin vincular, un journey previo y un carpool abierto de un líder.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'leaders', 'leader-uid'), { name: 'Líder' });
    await setDoc(doc(db, 'viewers', 'viewer-uid'), { name: 'Viewer' });
    await setDoc(doc(db, 'people', 'p1'), {
      name: 'Ingeniera Uno',
      ownerLeaderUid: 'leader-uid',
      uid: 'eng-uid',
    });
    await setDoc(doc(db, 'people', 'p2'), {
      name: 'Ingeniero Dos',
      ownerLeaderUid: 'leader-uid',
      uid: 'other-uid',
    });
    await setDoc(doc(db, 'people', 'p3'), {
      name: 'Sin Vincular',
      ownerLeaderUid: 'leader-uid',
    });
    await setDoc(doc(db, 'people', 'p1', 'career', 'journey'), {
      visitedCities: [],
      currentCity: null,
      plannedRoute: [],
      evidences: {},
    });
    await setDoc(doc(db, 'carpools', 'cp1'), {
      name: 'Ruta Git',
      seats: 3,
      status: 'open',
      route: [],
      conductor: { personId: 'p9', name: 'Otro' },
      members: [{ personId: 'p9', name: 'Otro' }],
      memberIds: ['p9'],
      createdBy: { uid: 'leader-uid', name: 'Líder' },
    });
  });

  const eng = env.authenticatedContext('eng-uid').firestore();
  const viewer = env.authenticatedContext('viewer-uid').firestore();
  const leader = env.authenticatedContext('leader-uid').firestore();

  console.log('El vinculado JUEGA su plan (journey / playtime / achievements):');
  await check(
    'vinculado ACTUALIZA su journey (marcar visitada)',
    assertSucceeds(
      updateDoc(doc(eng, 'people', 'p1', 'career', 'journey'), {
        visitedCities: ['bases~git'],
        currentCity: 'bases~git',
      }),
    ),
  );
  await check(
    'vinculado CREA su playtime (primer volcado del tracker)',
    assertSucceeds(
      setDoc(doc(eng, 'people', 'p1', 'career', 'playtime'), {
        totalMinutes: 3,
        byDay: { '2026-07-04': 3 },
      }),
    ),
  );
  await check(
    'vinculado registra sus achievements (cosmético: los coins firmados son la capa antifraude)',
    assertSucceeds(
      setDoc(doc(eng, 'people', 'p1', 'career', 'achievements'), {
        citizenships: { engineering: '2026-07-04T10:00:00Z' },
        badges: {},
      }),
    ),
  );
  await check(
    'vinculado LEE su journey (regresión: lectura del subárbol propio)',
    assertSucceeds(getDoc(doc(eng, 'people', 'p1', 'career', 'journey'))),
  );

  console.log('Nadie juega el plan de OTRO:');
  await check(
    'vinculado NO escribe el journey de OTRA persona',
    assertFails(
      setDoc(doc(eng, 'people', 'p2', 'career', 'journey'), { visitedCities: ['x'] }),
    ),
  );
  await check(
    'vinculado NO escribe el playtime de OTRA persona',
    assertFails(
      setDoc(doc(eng, 'people', 'p2', 'career', 'playtime'), { totalMinutes: 999 }),
    ),
  );
  await check(
    'viewer NO escribe el journey de nadie',
    assertFails(
      setDoc(doc(viewer, 'people', 'p1', 'career', 'journey'), { visitedCities: ['x'] }),
    ),
  );
  await check(
    'la excepción no aplica a personas SIN uid vinculado',
    assertFails(
      setDoc(doc(eng, 'people', 'p3', 'career', 'journey'), { visitedCities: ['x'] }),
    ),
  );

  console.log('El vinculado NO gana escritura fuera de sus tres docs:');
  await check(
    'vinculado NO escribe lecturas de su subárbol (siguen siendo del líder)',
    assertFails(
      setDoc(doc(eng, 'people', 'p1', 'lecturas', 'dim1'), { valor: 5 }),
    ),
  );
  await check(
    'vinculado NO escribe notas de su subárbol',
    assertFails(setDoc(doc(eng, 'people', 'p1', 'notes', 'n1'), { text: 'hola' })),
  );
  await check(
    'vinculado NO escribe su resumen de Role Mirror',
    assertFails(
      setDoc(doc(eng, 'people', 'p1', 'rolemirror', 'summary'), { dominant: 'architect' }),
    ),
  );
  await check(
    'vinculado NO BORRA su journey (el plan se corrige, no se borra)',
    assertFails(deleteDoc(doc(eng, 'people', 'p1', 'career', 'journey'))),
  );
  await check(
    'ficha acotada (regresión): vinculado declara su careerTargetLevelId',
    assertSucceeds(updateDoc(doc(eng, 'people', 'p1'), { careerTargetLevelId: 'l3' })),
  );
  await check(
    'ficha acotada (regresión): vinculado NO toca otros campos de su ficha',
    assertFails(updateDoc(doc(eng, 'people', 'p1'), { name: 'Otro Nombre' })),
  );

  console.log('El líder conserva su flujo (regresión):');
  await check(
    'líder dueño escribe el journey de su gente',
    assertSucceeds(
      updateDoc(doc(leader, 'people', 'p1', 'career', 'journey'), {
        plannedRoute: ['bases~git', 'bases~http'],
      }),
    ),
  );

  console.log('Carpools: todo usuario firma como él mismo y usa la máscara de unirse:');
  await check(
    'vinculado CREA un carpool firmado como él mismo',
    assertSucceeds(
      setDoc(doc(eng, 'carpools', 'cp-eng'), {
        name: 'Mi carpool',
        seats: 2,
        status: 'open',
        route: [],
        conductor: { personId: 'p1', name: 'Ingeniera Uno' },
        members: [{ personId: 'p1', name: 'Ingeniera Uno' }],
        memberIds: ['p1'],
        createdBy: { uid: 'eng-uid', name: 'Ingeniera Uno' },
      }),
    ),
  );
  await check(
    'nadie firma un carpool en nombre de OTRO',
    assertFails(
      setDoc(doc(eng, 'carpools', 'cp-falso'), {
        name: 'Suplantado',
        seats: 2,
        status: 'open',
        route: [],
        conductor: { personId: 'p1', name: 'Ingeniera Uno' },
        members: [],
        memberIds: [],
        createdBy: { uid: 'leader-uid', name: 'Líder' },
      }),
    ),
  );
  await check(
    'vinculado se UNE a un carpool ajeno (máscara members/memberIds/status)',
    assertSucceeds(
      updateDoc(doc(eng, 'carpools', 'cp1'), {
        members: [
          { personId: 'p9', name: 'Otro' },
          { personId: 'p1', name: 'Ingeniera Uno' },
        ],
        memberIds: ['p9', 'p1'],
      }),
    ),
  );
  await check(
    'vinculado NO toca nombre/ruta/aforo de un carpool ajeno',
    assertFails(updateDoc(doc(eng, 'carpools', 'cp1'), { name: 'Secuestrado', seats: 99 })),
  );
  await check(
    'vinculado NO borra un carpool ajeno',
    assertFails(deleteDoc(doc(eng, 'carpools', 'cp1'))),
  );

  console.log(`\n${passed} comprobaciones de reglas de JG-1 pasadas.`);
} finally {
  await env.cleanup();
}
