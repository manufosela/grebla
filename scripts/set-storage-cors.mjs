/**
 * Configura el CORS del bucket de una instancia (RMR-PCS-0041).
 *
 * Hace falta porque la aplicación DESCARGA los documentos con `getBlob`, que es
 * una petición del navegador al bucket: sin CORS, el navegador la bloquea antes
 * de que las reglas lleguen siquiera a opinar, y el visor se queda en blanco sin
 * decir por qué. Nos pasó el 2026-09-14 con las dos instancias a la vez.
 *
 * Vive aquí y no en la memoria de nadie: un bucket recreado vuelve a nacer sin
 * CORS, y entonces esto es lo que hay que volver a ejecutar.
 *
 * Solo lectura (GET/HEAD) y solo desde los orígenes de esa instancia: subir y
 * borrar no pasan por el navegador —van por Cloud Function— así que no hacen
 * falta más métodos.
 *
 * Uso: node scripts/set-storage-cors.mjs --target=tribbu | app
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '--target=app').split('=')[1];

/** Orígenes desde los que se abre cada instancia. localhost, para desarrollo. */
const ORIGINS = {
  app: ['https://grebla-app.web.app', 'https://grebla-app.firebaseapp.com'],
  tribbu: ['https://grebla.tribbu.io', 'https://grebla-tribbu.web.app', 'https://grebla-tribbu.firebaseapp.com'],
};
const DEV = ['http://localhost:4321', 'http://127.0.0.1:4321'];

const key = JSON.parse(readFileSync(serviceAccountPath(target), 'utf8'));
const bucket = `${key.project_id}.firebasestorage.app`;

/** Token de la cuenta de servicio con permiso para configurar el bucket. */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 600,
    iat: now,
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${signer.sign(key.private_key, 'base64url')}`;
  const res = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })).json();
  if (!res.access_token) throw new Error(`No se pudo obtener el token: ${JSON.stringify(res).slice(0, 200)}`);
  return res.access_token;
}

async function main() {
  const origins = ORIGINS[target];
  if (!origins) throw new Error(`Instancia desconocida: ${target}`);
  console.log(`\n=== CORS de ${bucket} ===`);

  const token = await accessToken();
  const res = await (await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      cors: [{
        origin: [...origins, ...DEV],
        method: ['GET', 'HEAD'],
        responseHeader: ['Content-Type', 'Authorization', 'Range'],
        maxAgeSeconds: 3600,
      }],
    }),
  })).json();

  if (res.error) throw new Error(res.error.message);
  for (const regla of res.cors ?? []) console.log(`  ✓ ${regla.method.join('/')} desde ${regla.origin.length} orígenes`);
  console.log('=== hecho ===\n');
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
