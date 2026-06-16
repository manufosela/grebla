/**
 * Provisión de un tenant (Admin SDK). Crea/actualiza el tenant, registra su
 * dominio (subdominio + dominios propios) en /tenantDomains y asigna miembros.
 *
 * Uso:
 *   node scripts/provision-tenant.mjs --slug=tribbu --name="TRIBBU" \
 *     --domains=tribbu.grebla.app,app.tribbu.com \
 *     --admin=email-de-un-usuario-existente@dominio.com \
 *     --leader=otro-email@dominio.com
 *
 * Requiere la service account *firebase-adminsdk*.json en la raíz (no se sube al
 * repo). Los usuarios (admin/leader) deben existir en Auth (haber entrado al
 * menos una vez). NO se ejecuta automáticamente.
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
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
};

const slug = (arg('slug') || '').trim().toLowerCase();
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('✗ --slug es obligatorio y debe ser [a-z0-9-].');
  process.exit(1);
}
const name = arg('name') || slug;
const domains = (arg('domains') || `${slug}.grebla.app`)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
const adminEmail = arg('admin');
const leaderEmail = arg('leader');

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();
const auth = getAuth();

/** Busca el uid de un email (debe existir en Auth). */
async function uidFor(email) {
  if (!email) return null;
  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch {
    console.error(`✗ No existe en Auth el usuario ${email} (debe haber entrado al menos una vez).`);
    process.exit(1);
  }
}

// 1) Tenant (reutiliza si ya existe ese slug)
const existing = await db.collection('tenants').where('slug', '==', slug).limit(1).get();
let tenantId;
if (!existing.empty) {
  tenantId = existing.docs[0].id;
  await db.doc(`tenants/${tenantId}`).set({ name, domains, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`✓ Tenant existente actualizado: ${slug} (${tenantId})`);
} else {
  const ref = await db.collection('tenants').add({
    slug,
    name,
    domains,
    createdAt: FieldValue.serverTimestamp(),
  });
  tenantId = ref.id;
  console.log(`✓ Tenant creado: ${slug} (${tenantId})`);
}

// 2) Mapa de dominios → tenantId
for (const host of domains) {
  await db.doc(`tenantDomains/${host}`).set({ tenantId, slug });
  console.log(`  ✓ dominio ${host} → ${slug}`);
}

// 3) Miembros
const adminUid = await uidFor(adminEmail);
if (adminUid) {
  await db.doc(`tenants/${tenantId}/members/${adminUid}`).set({ role: 'admin' }, { merge: true });
  console.log(`  ✓ admin: ${adminEmail}`);
}
const leaderUid = await uidFor(leaderEmail);
if (leaderUid) {
  await db.doc(`tenants/${tenantId}/members/${leaderUid}`).set({ role: 'leader' }, { merge: true });
  console.log(`  ✓ leader: ${leaderEmail}`);
}

console.log('Provisión completada.');
process.exit(0);
