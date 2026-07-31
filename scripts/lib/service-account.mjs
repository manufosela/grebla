/**
 * Resuelve la ruta de la clave de servicio (Admin SDK) de una instancia GREBLA.
 *
 * Las claves viven FUERA del repo, agrupadas en ~/.secrets/firebase/ (permisos
 * 700), con nombres por instancia: grebla-app-sa.json (demo), grebla-tribbu-sa.json,
 * grebla-portal-sa.json (el Firestore del portal de métricas). Nunca en el repo.
 *
 * Compatibilidad: si no está en ~/.secrets/firebase y el objetivo es 'app', cae a
 * una *firebase-adminsdk*.json en la raíz del repo (ubicación antigua).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SECRETS_DIR = join(homedir(), '.secrets', 'firebase');
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * @param {'app'|'tribbu'|'portal'} [target='app'] instancia cuya clave se necesita
 * @returns {string} ruta absoluta al JSON de la service account
 */
export function serviceAccountPath(target = 'app') {
  const primary = join(SECRETS_DIR, `grebla-${target}-sa.json`);
  if (existsSync(primary)) return primary;
  if (target === 'app') {
    const legacy = readdirSync(REPO_ROOT).find((f) => /firebase-adminsdk.*\.json$/.test(f));
    if (legacy) return join(REPO_ROOT, legacy);
  }
  throw new Error(`No se encontró la clave de servicio de «${target}». Colócala en ${primary} (chmod 600).`);
}
