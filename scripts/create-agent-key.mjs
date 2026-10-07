/**
 * Alta y baja de claves de agentes de ingesta (RMR-TSK-0650): una clave por
 * agente, atada a su manager. GREBLA guarda solo su huella en /agentKeys; la
 * clave se escribe UNA vez en ~/.secrets/grebla/agent-keys/<label>.key (chmod
 * 600) para entregarla al agente. No se imprime en pantalla ni en logs.
 *
 * Uso:
 *   node scripts/create-agent-key.mjs --instance=tribbu --manager=email@dominio --label=matias-manu
 *   node scripts/create-agent-key.mjs --instance=tribbu --revoke=matias-manu
 */
import { mkdirSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { generateAgentKey, agentKeyId } from '../functions/agentIngest.js';

const arg = (name) => process.argv.find((x) => x.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? '';
const instance = arg('instance') || 'app';
const label = (arg('label') || arg('revoke')).trim();
if (!/^[a-z0-9-]{3,40}$/.test(label)) {
  console.error('✗ --label (o --revoke) es obligatorio: minúsculas, números y guiones (3-40).');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath(instance), 'utf8'))) });
const db = getFirestore();

if (arg('revoke')) {
  const snap = await db.collection('agentKeys').where('label', '==', label).get();
  await Promise.all(snap.docs.map((d) => d.ref.update({ active: false, revokedAt: FieldValue.serverTimestamp() })));
  console.log(`✓ ${snap.size} clave(s) «${label}» retirada(s) en ${instance}.`);
  process.exit(0);
}

const managerEmail = arg('manager').trim().toLowerCase();
const manager = await getAuth().getUserByEmail(managerEmail).catch(() => null);
if (!manager || !(await db.doc(`leaders/${manager.uid}`).get()).exists) {
  console.error(`✗ ${managerEmail || '(sin --manager)'} no es un manager de GREBLA en ${instance}.`);
  process.exit(1);
}
const dupe = await db.collection('agentKeys').where('label', '==', label).where('active', '==', true).get();
if (!dupe.empty) {
  console.error(`✗ Ya hay una clave activa «${label}». Retírala antes con --revoke=${label}.`);
  process.exit(1);
}

const key = generateAgentKey();
await db.doc(`agentKeys/${agentKeyId(key)}`).create({
  label, managerUid: manager.uid, managerEmail, active: true, createdAt: FieldValue.serverTimestamp(),
});
const dir = join(homedir(), '.secrets', 'grebla', 'agent-keys');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = join(dir, `${instance}-${label}.key`);
if (existsSync(file)) console.log(`· se sobrescribe ${file}`);
writeFileSync(file, `${key}\n`, { mode: 0o600 });
chmodSync(file, 0o600);
console.log(`✓ Clave «${label}» de ${managerEmail} creada en ${instance}. Está en ${file} (solo tú puedes leerla).`);
