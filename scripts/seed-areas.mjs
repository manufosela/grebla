/**
 * Seed de áreas de conocimiento GLOBALES típicas de un equipo de desarrollo de
 * producto (Admin SDK). Idempotente por nombre: no duplica las que ya existan.
 * Las áreas globales no llevan `ownerLeaderUid` (las gestiona el superadmin) y
 * son editables/borrables desde Equipo → Ajustes.
 *
 * Uso:  node scripts/seed-areas.mjs        (crea las que falten)
 * Usa la service account *firebase-adminsdk*.json de la raíz (no se sube al repo).
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/** Áreas típicas de un equipo de dev de producto. Editables después en la app. */
const AREAS = [
  'Frontend',
  'Backend',
  'Bases de datos',
  'APIs',
  'Arquitectura',
  'DevOps/Infra',
  'Cloud',
  'CI/CD',
  'Testing/QA',
  'Seguridad',
  'Observabilidad',
  'Datos/Analytics',
  'Mobile',
  'UX/UI',
  'Producto/Negocio',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();

const snap = await db.collection('areas').get();
const existing = new Set(
  snap.docs.map((d) => String(d.data().name ?? '').trim().toLowerCase()),
);

let created = 0;
for (const name of AREAS) {
  if (existing.has(name.toLowerCase())) {
    console.log(`• «${name}» ya existe: no se toca`);
    continue;
  }
  await db.collection('areas').add({ name, createdAt: FieldValue.serverTimestamp() });
  console.log(`✓ Área global creada: «${name}»`);
  created++;
}
console.log(`\nHecho. Creadas ${created} de ${AREAS.length} (el resto ya existían).`);
process.exit(0);
