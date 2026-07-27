/**
 * Validación en EMULADOR de las reglas de SCRUM POKER (RMR-TSK-0317). Comprueba
 * lo crítico: la OCULTACIÓN del voto es real, no solo de UI.
 *
 * Contra el emulador de Firestore (puerto 8181, firebase.json) verifica que:
 *  1. Solo un líder crea una sesión y a su propio nombre.
 *  2. La sesión y la presencia (/players) son legibles por cualquiera con acceso,
 *     pero el voto ajeno (/votes) NO se puede leer mientras `revealed` sea false
 *     (ni el documento suelto ni listando la colección) — y SÍ tras revelar.
 *  3. Cada uno solo escribe SU presencia y SU voto (no los de otro).
 *  4. Revelar es colaborativo (cualquiera con acceso pone `revealed`), pero un
 *     no-dueño no puede tocar tema/ronda; el dueño sí.
 *
 * Uso (arranca el emulador, ejecuta y lo apaga):
 *   firebase emulators:exec --only firestore --project demo-grebla \
 *     "node scripts/validate-poker-rules.mjs"
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  // Semilla (Admin SDK, omite reglas): un líder dueño, dos miembros, una sesión
  // OCULTA con votos de ambos y otra REVELADA.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', 'super-uid'), { name: 'Super' });
    await setDoc(doc(db, 'leaders', 'leader-uid'), { name: 'Manager' });
    await setDoc(doc(db, 'members', 'alice-uid'), { name: 'Alice' });
    await setDoc(doc(db, 'members', 'bob-uid'), { name: 'Bob' });

    await setDoc(doc(db, 'pokerSessions', 'hidden'), { name: 'Oculta', ownerLeaderUid: 'leader-uid', topic: 'API', revealed: false, round: 1, status: 'open' });
    await setDoc(doc(db, 'pokerSessions', 'hidden', 'players', 'alice-uid'), { name: 'Alice', votedRound: 1 });
    await setDoc(doc(db, 'pokerSessions', 'hidden', 'players', 'bob-uid'), { name: 'Bob', votedRound: 1 });
    await setDoc(doc(db, 'pokerSessions', 'hidden', 'votes', 'alice-uid'), { value: '8', round: 1 });
    await setDoc(doc(db, 'pokerSessions', 'hidden', 'votes', 'bob-uid'), { value: '13', round: 1 });

    await setDoc(doc(db, 'pokerSessions', 'shown'), { name: 'Revelada', ownerLeaderUid: 'leader-uid', topic: 'DB', revealed: true, round: 1, status: 'open' });
    await setDoc(doc(db, 'pokerSessions', 'shown', 'votes', 'alice-uid'), { value: '5', round: 1 });
    await setDoc(doc(db, 'pokerSessions', 'shown', 'votes', 'bob-uid'), { value: '5', round: 1 });
  });

  const leader = env.authenticatedContext('leader-uid').firestore();
  const alice = env.authenticatedContext('alice-uid').firestore();
  const stranger = env.authenticatedContext('nobody-uid', { email: 'x@gmail.com' }).firestore();

  console.log('Crear una sesión: solo un líder y a su nombre:');
  await check('el líder CREA su sesión (ownerLeaderUid == su uid)',
    assertSucceeds(setDoc(doc(leader, 'pokerSessions', 'new1'), { name: 'Nueva', ownerLeaderUid: 'leader-uid', topic: '', revealed: false, round: 1, status: 'open' })));
  await check('un miembro NO crea sesiones',
    assertFails(setDoc(doc(alice, 'pokerSessions', 'new2'), { name: 'Intrusa', ownerLeaderUid: 'alice-uid', topic: '', revealed: false, round: 1, status: 'open' })));
  await check('el líder NO crea una sesión a nombre de otro',
    assertFails(setDoc(doc(leader, 'pokerSessions', 'new3'), { name: 'Suplantada', ownerLeaderUid: 'otro-uid', topic: '', revealed: false, round: 1, status: 'open' })));

  console.log('Leer sesión y presencia: cualquiera con acceso, no un gmail suelto:');
  await check('un miembro LEE la sesión', assertSucceeds(getDoc(doc(alice, 'pokerSessions', 'hidden'))));
  await check('un miembro LEE la presencia (players) — quién votó, sin valor',
    assertSucceeds(getDocs(collection(alice, 'pokerSessions', 'hidden', 'players'))));
  await check('un gmail suelto (sin rol) NO LEE la sesión', assertFails(getDoc(doc(stranger, 'pokerSessions', 'hidden'))));

  console.log('OCULTACIÓN del voto (lo crítico):');
  await check('un miembro NO LEE el voto AJENO mientras no está revelado',
    assertFails(getDoc(doc(alice, 'pokerSessions', 'hidden', 'votes', 'bob-uid'))));
  await check('un miembro SÍ LEE su PROPIO voto aunque no esté revelado',
    assertSucceeds(getDoc(doc(alice, 'pokerSessions', 'hidden', 'votes', 'alice-uid'))));
  await check('un miembro NO LISTA la colección de votos mientras no está revelado',
    assertFails(getDocs(collection(alice, 'pokerSessions', 'hidden', 'votes'))));
  await check('tras REVELAR, un miembro SÍ LISTA todos los votos',
    assertSucceeds(getDocs(collection(alice, 'pokerSessions', 'shown', 'votes'))));
  await check('tras REVELAR, un miembro LEE el voto ajeno',
    assertSucceeds(getDoc(doc(alice, 'pokerSessions', 'shown', 'votes', 'bob-uid'))));

  console.log('Escribir solo lo propio:');
  await check('un miembro ESCRIBE su presencia (se une / vota)',
    assertSucceeds(setDoc(doc(alice, 'pokerSessions', 'hidden', 'players', 'alice-uid'), { name: 'Alice', votedRound: 1 })));
  await check('un miembro NO escribe la presencia de OTRO',
    assertFails(setDoc(doc(alice, 'pokerSessions', 'hidden', 'players', 'bob-uid'), { name: 'Hack', votedRound: 1 })));
  await check('un miembro ESCRIBE su voto',
    assertSucceeds(setDoc(doc(alice, 'pokerSessions', 'hidden', 'votes', 'alice-uid'), { value: '20', round: 1 })));
  await check('un miembro NO escribe el voto de OTRO',
    assertFails(setDoc(doc(alice, 'pokerSessions', 'hidden', 'votes', 'bob-uid'), { value: '1', round: 1 })));

  console.log('Revelar es colaborativo; tema/ronda solo el dueño:');
  await check('un miembro REVELA (solo el campo revealed)',
    assertSucceeds(updateDoc(doc(alice, 'pokerSessions', 'hidden'), { revealed: true })));
  await check('un miembro NO cambia el tema (no es dueño ni es solo-revealed)',
    assertFails(updateDoc(doc(alice, 'pokerSessions', 'hidden'), { topic: 'secuestrado' })));
  await check('un miembro NO re-oculta una sesión ya revelada (revelar es solo false→true)',
    assertFails(updateDoc(doc(alice, 'pokerSessions', 'shown'), { revealed: false })));
  await check('el dueño CAMBIA tema y ronda (pasar de tema)',
    assertSucceeds(updateDoc(doc(leader, 'pokerSessions', 'hidden'), { topic: 'nuevo', round: 2, revealed: false })));
  await check('un gmail suelto NO revela',
    assertFails(updateDoc(doc(stranger, 'pokerSessions', 'hidden'), { revealed: true })));

  console.log('Voto CONGELADO tras revelar (integridad del resultado):');
  await check('un miembro NO cambia su voto tras revelar',
    assertFails(setDoc(doc(alice, 'pokerSessions', 'shown', 'votes', 'alice-uid'), { value: '40', round: 1 })));
  await check('un miembro NO borra su voto tras revelar',
    assertFails(deleteDoc(doc(alice, 'pokerSessions', 'shown', 'votes', 'alice-uid'))));

  console.log('Limpieza en cascada: el dueño borra la subcolección al eliminar:');
  await check('el dueño BORRA el voto de otro (limpieza al borrar la sesión)',
    assertSucceeds(deleteDoc(doc(leader, 'pokerSessions', 'shown', 'votes', 'bob-uid'))));

  console.log('Borrar: el dueño (o superadmin), no un miembro:');
  await check('un miembro NO borra la sesión', assertFails(deleteDoc(doc(alice, 'pokerSessions', 'hidden'))));
  await check('el dueño BORRA su sesión', assertSucceeds(deleteDoc(doc(leader, 'pokerSessions', 'shown'))));

  console.log(`\n✅ Reglas de Scrum Poker: ${passed} comprobaciones OK`);
} finally {
  await env.cleanup();
}
