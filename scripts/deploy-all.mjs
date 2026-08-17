/**
 * Despliega GREBLA a TODAS las instancias configuradas (demo, tribbu…) y
 * sincroniza el badge de versión (/config/appVersion) en cada una, para que
 * ninguna quede avisando de «versión nueva» sin poder recargar (RMR-TSK-0345).
 *
 * Solo hosting; las Cloud Functions se despliegan aparte cuando cambian.
 *
 * Requiere `deploy.config.json` (gitignored — ver deploy.config.example.json):
 *   { "instances": [ { "name", "project", "account", "buildScript" }, … ] }
 * Las cuentas viven ahí (fuera del repo público) para no exponer datos personales.
 * Necesita `firebase` autenticado con esas cuentas; el badge se publica con
 * publish-version.mjs (Admin SDK, claves de ~/.secrets/firebase — RMR-TSK-0433),
 * así que gcloud ya no pinta nada y un login caducado no rompe el deploy.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Comandos con argumentos como ARRAY (execFileSync, sin shell): así ningún valor
// de la config puede inyectar comandos aunque esté malformado.
const run = (file, args) => execFileSync(file, args, { cwd: root, stdio: 'inherit' });
const capture = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8' }).trim();

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

let config;
try {
  config = JSON.parse(readFileSync(join(root, 'deploy.config.json'), 'utf8'));
} catch {
  fail('Falta deploy.config.json. Copia deploy.config.example.json y rellena tus instancias y cuentas.');
}
const instances = config.instances ?? [];
if (!instances.length) fail('deploy.config.json no tiene ninguna instancia.');

// Allowlist de scripts de build: solo los declarados en package.json.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declaredScripts = new Set(Object.keys(pkg.scripts ?? {}));

const PROJECT_RE = /^[a-z][a-z0-9-]{3,}$/;
const ACCOUNT_RE = /^[^\s@]+@[^\s@]+$/;

const hash = capture('git', ['rev-parse', '--short', 'HEAD']);

for (const inst of instances) {
  const { name, project, account, buildScript } = inst;
  if (!PROJECT_RE.test(String(project ?? ''))) fail(`Instancia "${name ?? '?'}": project inválido.`);
  if (!ACCOUNT_RE.test(String(account ?? ''))) fail(`Instancia "${name ?? '?'}": account inválido.`);
  if (!declaredScripts.has(buildScript)) fail(`Instancia "${name ?? '?'}": buildScript "${buildScript}" no existe en package.json.`);

  console.log(`\n=== ${name} · ${project} ===`);
  run('npm', ['run', buildScript]);
  run('firebase', ['deploy', '--only', 'hosting', '--project', project, '--account', account]);

  // Sincroniza el badge por el MISMO camino que a mano (RMR-TSK-0433):
  // publish-version.mjs con el Admin SDK y la clave por instancia de
  // ~/.secrets/firebase — sin gcloud. El name «demo» es la instancia «app»
  // para las claves (grebla-app-sa.json).
  const versionTarget = name === 'demo' ? 'app' : name;
  run('node', [join('scripts', 'publish-version.mjs'), versionTarget]);
  console.log(`✓ ${name} desplegado · badge = grebla-${hash}`);
}

console.log('\n✔ Todas las instancias desplegadas y sincronizadas.');
