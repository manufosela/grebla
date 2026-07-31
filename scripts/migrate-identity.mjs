/**
 * Migración ÚNICA al modelo persona-céntrico (RMR-PCS-0027 · F4). Puebla en cada
 * ficha /people su organización EXPLÍCITA: orgRole (roleId del catálogo /orgRoles),
 * orgBranch y reportsToPersonId (superior por personId). Con esto la jerarquía deja
 * de depender del uid/login.
 *
 * NO adivina por nombre. El mapeo de las cuentas CON ROL (managers/heads) a su
 * ficha se pasa en un fichero EXTERNO al repo (uids/emails de terceros nunca se
 * commitean). El resto (engineers) se deriva: su superior es la ficha cuyo uid ==
 * su ownerLeaderUid.
 *
 * SEGURO: dry-run por defecto; solo AÑADE campos (merge), nunca borra; crea las
 * fichas que falten (p.ej. un head sin ficha) si el mapa lo indica.
 *
 * Mapa (JSON): {
 *   "accounts": [
 *     { "uid": "...", "personId": "...", "roleId": "em" },
 *     { "uid": "...", "personId": null, "roleId": "head-eng",
 *       "create": { "name": "...", "email": "..." } }
 *   ]
 * }
 *
 * Uso: node scripts/migrate-identity.mjs --target=tribbu --map=/ruta/mapa.json [--apply]
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1];
const mapPath = (process.argv.find((a) => a.startsWith('--map=')) || '').split('=')[1];
const apply = process.argv.includes('--apply');
if (!target || !mapPath) { console.error('✗ Uso: --target=tribbu --map=/ruta/mapa.json [--apply]'); process.exit(1); }

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const accounts = map.accounts ?? [];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

async function main() {
  const [peopleSnap, leadersSnap, rolesSnap] = await Promise.all([
    db.collection('people').get(),
    db.collection('leaders').get(),
    db.collection('orgRoles').get(),
  ]);
  const people = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const leaders = new Map(leadersSnap.docs.map((d) => [d.id, d.data()]));
  const branchByRole = new Map(rolesSnap.docs.map((d) => [d.id, d.data().branch ?? 'generico']));

  // Índice uid→personId de las cuentas con rol (para traducir superiores).
  const personIdByUid = new Map();
  for (const acc of accounts) if (acc.personId) personIdByUid.set(acc.uid, acc.personId);
  // Las fichas que se van a CREAR también deben poder resolverse como superior.
  const creations = [];
  for (const acc of accounts) {
    if (!acc.personId && acc.create) {
      const newRef = db.collection('people').doc();
      acc.personId = newRef.id;
      personIdByUid.set(acc.uid, newRef.id);
      creations.push({ ref: newRef, acc });
    }
  }

  // Validación ESTRICTA antes de escribir nada: un roleId inexistente o un
  // personId que no corresponde a una ficha real abortan la migración (un error
  // en el mapa no debe corromper datos ni crear fichas parciales por sorpresa).
  const peopleById = new Map(people.map((p) => [p.id, p]));
  for (const acc of accounts) {
    if (!branchByRole.has(acc.roleId)) {
      throw new Error(`roleId «${acc.roleId}» (uid ${acc.uid}) no existe en /orgRoles. Corrige el mapa o siembra el rol.`);
    }
    if (!acc.create && !peopleById.has(acc.personId)) {
      throw new Error(`personId «${acc.personId}» (uid ${acc.uid}) no existe en /people. Usa un "create" explícito si quieres crear la ficha.`);
    }
  }

  console.log(`\n=== MIGRACIÓN IDENTIDAD · ${target} · ${apply ? 'APPLY' : 'DRY-RUN'} ===`);
  const writes = [];

  // 1) Cuentas con rol: fijar orgRole/orgBranch/uid/reportsToPersonId en su ficha.
  for (const acc of accounts) {
    const branch = branchByRole.get(acc.roleId);
    const superiorUid = leaders.get(acc.uid)?.reportsTo ?? null; // head al que reporta un manager
    const reportsToPersonId = superiorUid ? (personIdByUid.get(superiorUid) ?? null) : null;
    const patch = { orgRole: acc.roleId, orgBranch: branch, uid: acc.uid, reportsToPersonId };
    if (acc.create) {
      patch.name = acc.create.name;
      patch.email = acc.create.email ?? null;
      patch.active = true;
      writes.push({ kind: 'create', personId: acc.personId, patch });
      console.log(`  + CREAR ficha ${acc.personId} «${acc.create.name}» rol=${acc.roleId} branch=${branch} reportsTo=${reportsToPersonId ?? '—'}`);
    } else {
      writes.push({ kind: 'update', personId: acc.personId, patch });
      const f = people.find((p) => p.id === acc.personId);
      console.log(`  → ${acc.personId} «${f?.name ?? '?'}» rol=${acc.roleId} branch=${branch} reportsTo=${reportsToPersonId ?? '—'}`);
    }
  }

  // 2) Resto de fichas (engineers): orgRole='engineer', branch engineering,
  //    superior = ficha cuyo uid == su ownerLeaderUid (traducido a personId).
  const roleAccountPersonIds = new Set(accounts.map((a) => a.personId));
  for (const p of people) {
    if (roleAccountPersonIds.has(p.id)) continue; // ya tratada como cuenta con rol
    if (p.active === false) continue;
    const reportsToPersonId = p.ownerLeaderUid ? (personIdByUid.get(p.ownerLeaderUid) ?? null) : null;
    const patch = { orgRole: 'engineer', orgBranch: 'engineering', reportsToPersonId };
    writes.push({ kind: 'update', personId: p.id, patch });
    console.log(`  · engineer ${p.id} «${p.name}» reportsTo=${reportsToPersonId ?? '— (sin manager)'}`);
  }

  console.log(`\n  Cambios: ${writes.length} (${creations.length} creaciones)`);
  if (!apply) { console.log('  (dry-run: nada escrito. Añade --apply.)\n'); process.exit(0); }

  for (const w of writes) {
    await db.collection('people').doc(w.personId).set(w.patch, { merge: true });
  }
  console.log(`\n=== APLICADO: ${writes.length} fichas ===\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
