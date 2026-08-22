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
 * La cuenta se pasa SIEMPRE y de forma explícita: hay varias sesiones
 * trabajando en paralelo con identidades distintas (personal y de empresa) y la
 * cuenta activa de `gh` puede haber cambiado hace un segundo.
 *
 * Salidas: 0 mergeada · 1 no se mergea (con el motivo) · 2 mal invocado.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mergeVerdict } from './lib/merge-verdict.mjs';

const POLL_MS = 15_000;
const TIMEOUT_MS = 30 * 60_000;

const [prArg, ...rest] = process.argv.slice(2);
const account = rest[rest.indexOf('--account') + 1];

if (!prArg || !/^\d+$/.test(prArg) || !account || account.startsWith('--')) {
  console.error('Uso: node scripts/merge-when-green.mjs <nº de PR> --account <cuenta> [--delete-branch] [--squash]');
  process.exit(2);
}

/** Ejecuta `gh` fijando antes la cuenta, sin fiarse de la activa. */
const gh = (args) => {
  execFileSync('gh', ['auth', 'switch', '--user', account], { stdio: 'ignore' });
  return execFileSync('gh', args, { encoding: 'utf8' });
};

const started = Date.now();
let verdict;
for (;;) {
  verdict = mergeVerdict(JSON.parse(gh(['pr', 'view', prArg, '--json', 'statusCheckRollup,state,mergeable'])));
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
