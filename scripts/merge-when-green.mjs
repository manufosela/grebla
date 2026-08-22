#!/usr/bin/env node
/**
 * Mergea una PR SOLO cuando todos sus checks han terminado en verde
 * (RMR-TSK-0445).
 *
 * Por qué existe: mergear «mirando» la salida de `gh pr checks --watch` es
 * frágil. En la PR #647 un `head -3` cortó ese comando, la tubería devolvió 0 y
 * el merge salió sin que nadie hubiera confirmado el verde. Los checks habían
 * pasado, pero eso fue suerte, no procedimiento. Aquí decide `mergeVerdict()`
 * sobre el estado que devuelve la API, y esa decisión está cubierta por tests.
 *
 * Uso:
 *   node scripts/merge-when-green.mjs <nº de PR> --account <cuenta-github>
 *   node scripts/merge-when-green.mjs 651 --account manufosela --delete-branch
 *
 * La cuenta se pasa SIEMPRE y de forma explícita, y viaja como token por
 * entorno en cada invocación: hay varias sesiones trabajando en paralelo con
 * identidades distintas (personal y de empresa), y `gh auth switch` cambiaría
 * una cuenta activa que las demás también están usando.
 *
 * Salidas: 0 mergeada · 1 no se mergea (con el motivo) · 2 mal invocado.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mergeVerdict } from './lib/merge-verdict.mjs';

const POLL_MS = 15_000;
const TIMEOUT_MS = 30 * 60_000;

const USAGE = 'Uso: node scripts/merge-when-green.mjs <nº de PR> --account <cuenta> [--delete-branch] [--squash]';
const fail = (why) => {
  console.error(`✗ ${why}\n${USAGE}`);
  process.exit(2);
};

const [prArg, ...rest] = process.argv.slice(2);
// `--account` se exige de forma EXPLÍCITA: sin este parseo, un `indexOf` que no
// encuentra el flag devuelve -1 y el siguiente índice es el primer argumento
// suelto, así que un despiste mergearía con la identidad equivocada. Con varias
// sesiones trabajando a la vez con cuentas distintas, eso no puede pasar.
const at = rest.indexOf('--account');
if (at === -1) fail('falta --account.');
const account = rest[at + 1];
if (!account || account.startsWith('--')) fail('--account necesita el nombre de la cuenta detrás.');
if (!prArg || !/^\d+$/.test(prArg)) fail('el primer argumento debe ser el número de la PR.');

/**
 * Token de la cuenta pedida, leído SIN cambiar la cuenta activa.
 *
 * `gh auth switch` muta estado global del CLI: entre el switch y el comando,
 * otra sesión puede cambiar la cuenta y el comando saldría con la identidad
 * equivocada. Pasando el token por entorno en cada invocación no hay estado
 * compartido que se pueda pisar.
 */
let token;
try {
  // stderr silenciado: si la cuenta no existe, el mensaje que vale es el nuestro.
  token = execFileSync('gh', ['auth', 'token', '--user', account], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  fail(`no hay sesión de gh para la cuenta «${account}» (revisa \`gh auth status\`).`);
}
if (!token) fail(`no se pudo obtener el token de la cuenta «${account}».`);

/** Ejecuta `gh` con la identidad pedida, sin tocar la cuenta activa. */
const gh = (args) => execFileSync('gh', args, {
  encoding: 'utf8',
  env: { ...process.env, GH_TOKEN: token },
});

const started = Date.now();
let verdict;
for (;;) {
  verdict = mergeVerdict(JSON.parse(gh(['pr', 'view', prArg, '--json', 'statusCheckRollup,state,mergeable,isDraft'])));
  if (verdict.action !== 'wait') break;
  if (Date.now() - started > TIMEOUT_MS) {
    console.error(`✗ Tiempo agotado: ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`· ${verdict.reason}`);
  await sleep(POLL_MS);
}

if (verdict.action === 'abort') {
  console.error(`✗ NO se mergea la PR #${prArg}: ${verdict.reason}`);
  process.exit(1);
}

console.log(`✓ ${verdict.reason}: ${verdict.checks.map((c) => c.name).join(', ')}`);
const args = ['pr', 'merge', prArg, rest.includes('--squash') ? '--squash' : '--merge'];
if (rest.includes('--delete-branch')) args.push('--delete-branch');
process.stdout.write(gh(args));
console.log(`✓ PR #${prArg} mergeada.`);
