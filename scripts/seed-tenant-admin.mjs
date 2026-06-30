/**
 * Asigna a un usuario el rol de admin (o el indicado) dentro de un tenant:
 * escribe /tenants/{tenantId}/members/{uid} = { role }.
 *
 * Necesario para acceder al panel de Role Mirror tras migrarlo a tenant
 * (RMR-TSK-0063): el guard pasó de super-admin de plataforma a admin del tenant.
 *
 * Uso:
 *   pnpm seed:tenant-admin --email=tu-email@dominio.com --tenant=manufosela
 *   (también admite SEED_EMAIL / SEED_TENANT por entorno; --role=admin por defecto)
 *
 * El usuario debe haber iniciado sesión al menos una vez (existir en Auth).
 * Usa la service account *firebase-adminsdk*.json de la raíz (NO subir al repo).
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz del proyecto.');
  process.exit(1);
}

const arg = (name) => {
  const found = process.argv.find((x) => x.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : undefined;
};
const email = arg('email') || process.env.SEED_EMAIL;
const tenantId = arg('tenant') || process.env.SEED_TENANT || 'manufosela';
const role = arg('role') || 'admin';

if (!email) {
  console.error('✗ Falta --email=<email>.');
  console.error('  Uso: pnpm seed:tenant-admin --email=tu-email@dominio.com --tenant=manufosela');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();
const auth = getAuth();

// El tenant se identifica por SLUG (campo); su doc id es un push id (igual que
// getBySlug en la app). Se acepta también pasar directamente el doc id.
let tenantDocId = tenantId;
let tenantSlug = tenantId;
const bySlug = await db.collection('tenants').where('slug', '==', tenantId).limit(1).get();
if (!bySlug.empty) {
  tenantDocId = bySlug.docs[0].id;
  tenantSlug = bySlug.docs[0].data().slug || tenantId;
} else {
  const direct = await db.doc(`tenants/${tenantId}`).get();
  if (!direct.exists) {
    console.error(`✗ No existe ningún tenant con slug ni id "${tenantId}" en /tenants.`);
    process.exit(1);
  }
  tenantSlug = direct.data().slug || tenantId;
}

try {
  const user = await auth.getUserByEmail(email);
  await db.doc(`tenants/${tenantDocId}/members/${user.uid}`).set(
    {
      role,
      email: user.email ?? email,
      displayName: user.displayName ?? user.email ?? email,
      addedAt: FieldValue.serverTimestamp(),
      addedBy: 'seed-tenant-admin',
    },
    { merge: true },
  );
  // Índice inverso usuario→tenants (para la landing "mis organizaciones").
  await db.doc(`userTenants/${user.uid}/tenants/${tenantDocId}`).set(
    { slug: tenantSlug, role, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log(`✓ ${email} (${user.uid}) → member "${role}" del tenant "${tenantId}" (${tenantDocId}); índice userTenants actualizado.`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`✗ No se pudo asignar. ¿El usuario ha iniciado sesión alguna vez en Auth?`);
  console.error(`  Detalle: ${msg}`);
  process.exit(1);
}

process.exit(0);
