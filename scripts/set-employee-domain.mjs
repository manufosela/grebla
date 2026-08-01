/**
 * Configura /config/org de una instancia (RMR-PCS-0027). Merge: no pisa otros
 * campos. Campos:
 *   --domain=<dominio>   dominio de email de empleados (acceso base al hub, F6).
 *   --crown=<texto>      etiqueta del nivel simbólico en la cima de la pirámide
 *                        invertida (los usuarios del producto). Cadena vacía lo quita.
 *
 * Uso: node scripts/set-employee-domain.mjs --target=tribbu --domain=tribbuapp.com --crown="Usuarios de TRIBBU"
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(`--${name}=`.length) : undefined;
};
const target = arg('target');
if (!target) { console.error('✗ Indica --target=tribbu | app'); process.exit(1); }

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const patch = {};
const domain = arg('domain');
if (domain !== undefined) patch.employeeDomain = domain.trim().toLowerCase().replace(/^@/, '');
const crown = arg('crown');
if (crown !== undefined) patch.usersCrownLabel = crown.trim();
if (Object.keys(patch).length === 0) { console.error('✗ Nada que configurar (usa --domain y/o --crown).'); process.exit(1); }

await db.collection('config').doc('org').set(patch, { merge: true });
for (const [k, v] of Object.entries(patch)) console.log(`✓ [${target}] /config/org.${k} = ${v === '' ? '(vacío)' : v}`);
process.exit(0);
