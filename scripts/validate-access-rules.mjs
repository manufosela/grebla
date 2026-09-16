/**
 * Validación en EMULADOR de la PUERTA de la organización (RMR-TSK-0519): quién
 * puede leer lo que se protege con canAccessOrg().
 *
 * El dominio del correo corporativo lo declara cada instancia en
 * /config/org.employeeDomain, y las reglas lo leen de ahí: sin dominio (la
 * demo) solo entra quien tiene ficha (espejo /members) o rol. Se comprueba con
 * la lista de sesiones de Scrum Poker, que es la colección más simple que pasa
 * por esa puerta.
 *
 * Uso (arranca el emulador, ejecuta y lo apaga):
 *   firebase emulators:exec --only firestore --project demo-grebla \
 *     "node scripts/validate-access-rules.mjs"
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

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

const SESSION = doc(env.unauthenticatedContext().firestore(), 'pokerSessions', 's1').path;
const lee = (ctx) => getDoc(doc(ctx.firestore(), SESSION));
const conCorreo = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true });

try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'leaders', 'leader-uid'), { name: 'Manager' });
    await setDoc(doc(db, 'members', 'member-uid'), { name: 'Miembro' });
    await setDoc(doc(db, 'pokerSessions', 's1'), { name: 'Sesión', ownerLeaderUid: 'leader-uid', revealed: false, round: 1, status: 'open' });
  });

  console.log('Instancia SIN dominio declarado (la demo):');
  await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'config', 'org')));
  await check('un miembro con ficha entra, con el correo que sea',
    assertSucceeds(lee(conCorreo('member-uid', 'miembro@gmail.com'))));
  await check('un líder entra',
    assertSucceeds(lee(conCorreo('leader-uid', 'lider@otra.com'))));
  await check('un correo de tribbuapp.com SIN ficha NO entra: el dominio ya no está en el código',
    assertFails(lee(conCorreo('tribbu-uid', 'alguien@tribbuapp.com'))));
  await check('un gmail suelto NO entra',
    assertFails(lee(conCorreo('nobody-uid', 'x@gmail.com'))));

  console.log('Instancia CON dominio declarado en /config/org (tribbu):');
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config', 'org'), { employeeDomain: 'tribbuapp.com' }));
  await check('un correo del dominio entra aunque no tenga ficha',
    assertSucceeds(lee(conCorreo('tribbu-uid', 'alguien@tribbuapp.com'))));
  await check('el dominio se compara sin distinguir mayúsculas',
    assertSucceeds(lee(conCorreo('tribbu2-uid', 'Alguien@TribbuApp.com'))));
  await check('un subdominio o un dominio parecido NO cuelan',
    assertFails(lee(conCorreo('fake-uid', 'x@tribbuapp.com.evil.com'))));
  await check('un gmail suelto sigue sin entrar',
    assertFails(lee(conCorreo('nobody-uid', 'x@gmail.com'))));
  await check('sin sesión iniciada no se lee nada',
    assertFails(lee(env.unauthenticatedContext())));

  console.log('Dominio declarado pero VACÍO: como si no hubiera:');
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config', 'org'), { employeeDomain: '' }));
  await check('con employeeDomain vacío el correo corporativo NO entra',
    assertFails(lee(conCorreo('tribbu-uid', 'alguien@tribbuapp.com'))));

  console.log(`\n✅ Puerta de la organización: ${passed} comprobaciones OK`);
} finally {
  await env.cleanup();
}
