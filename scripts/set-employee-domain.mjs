/**
 * Configura el dominio de email de empleados de una instancia (/config/org),
 * que habilita el acceso base al hub (RMR-PCS-0027 · F6). Merge: no pisa otros
 * campos de /config/org. Pasar cadena vacía lo desactiva.
 *
 * Uso: node scripts/set-employee-domain.mjs --target=tribbu --domain=tribbuapp.com
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1];
const domain = (process.argv.find((a) => a.startsWith('--domain=')) || '--domain=').split('=')[1];
if (!target) { console.error('✗ Indica --target=tribbu | app'); process.exit(1); }

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const clean = domain.trim().toLowerCase().replace(/^@/, '');
await db.collection('config').doc('org').set({ employeeDomain: clean }, { merge: true });
console.log(`✓ [${target}] /config/org.employeeDomain = ${clean === '' ? '(vacío → acceso base desactivado)' : clean}`);
process.exit(0);
