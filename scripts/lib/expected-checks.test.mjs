import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  expectedChecks, missingChecks, runsOnPullRequest, jobIds,
} from './expected-checks.mjs';

const wf = (file, content) => ({ file, content });

describe('qué checks espera este repo', () => {
  it('los saca de los workflows que disparan en pull_request', () => {
    const out = expectedChecks([
      wf('a.yml', 'name: A\non:\n  pull_request:\n    branches: [main]\njobs:\n  quality:\n    runs-on: x\n'),
      wf('b.yml', 'name: B\non:\n  pull_request:\njobs:\n  e2e:\n    runs-on: x\n'),
    ]);
    expect(out).toEqual(['e2e', 'quality']);
  });

  it('ignora los que solo corren en push: esos no salen en una PR', () => {
    const out = expectedChecks([
      wf('solo-push.yml', 'on:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: x\n'),
    ]);
    expect(out).toEqual([]);
  });

  it('entiende las CUATRO formas válidas de declarar el evento', () => {
    // Las cuatro son YAML correcto y GitHub las ejecuta igual. Reconocer solo
    // una parte era el agujero que este módulo venía a tapar: un workflow
    // escrito de otra manera dejaba de bloquear el merge.
    expect(runsOnPullRequest('on: pull_request\n')).toBe(true);
    expect(runsOnPullRequest('on: [push, pull_request]\n')).toBe(true);
    expect(runsOnPullRequest('on: { pull_request: { branches: [main] } }\n')).toBe(true);
    expect(runsOnPullRequest('on:\n  pull_request:\n    branches: [main]\n')).toBe(true);
    expect(runsOnPullRequest('on:\n  pull_request: { branches: [main] }\n')).toBe(true);
    expect(runsOnPullRequest('on:\n  - push\n  - pull_request\n')).toBe(true);
  });

  it('y no se inventa el evento cuando no está', () => {
    expect(runsOnPullRequest('on: push\n')).toBe(false);
    expect(runsOnPullRequest('on: [push]\n')).toBe(false);
    expect(runsOnPullRequest('on:\n  push:\n    branches: [main]\n')).toBe(false);
    expect(runsOnPullRequest('on:\n  - push\n')).toBe(false);
    // `pull_request` fuera del bloque `on:` no cuenta: ahí es texto, no evento.
    expect(runsOnPullRequest('on:\n  push:\njobs:\n  x:\n    if: pull_request\n')).toBe(false);
  });

  it('no confunde la CONFIGURACIÓN de otro evento con el evento', () => {
    // Una rama que se llame «pull_request» está más adentro que los eventos: es
    // configuración de `push`, no un evento. Darla por buena metería ese
    // workflow en «lo esperado» y el merge esperaría para siempre un check que
    // no va a correr nunca.
    expect(runsOnPullRequest('on:\n  push:\n    branches: [pull_request]\n')).toBe(false);
    expect(runsOnPullRequest('on:\n  push:\n    branches:\n      - pull_request\n')).toBe(false);
    expect(runsOnPullRequest('on:\n  workflow_run:\n    workflows: [pull_request]\n')).toBe(false);
  });

  it('pero sí lo encuentra cuando está al nivel de los eventos, sea el primero o no', () => {
    expect(runsOnPullRequest('on:\n  push:\n    branches: [main]\n  pull_request:\n')).toBe(true);
    expect(runsOnPullRequest('on:\n\n  # comentario\n  pull_request:\n')).toBe(true);
  });

  it('las formas de lista también aportan sus jobs a lo esperado', () => {
    const out = expectedChecks([
      wf('escalar.yml', 'on: pull_request\njobs:\n  smoke:\n    runs-on: x\n'),
      wf('lista.yml', 'on:\n  - push\n  - pull_request\njobs:\n  lint:\n    runs-on: x\n'),
      wf('inline.yml', 'on:\n  pull_request: { branches: [main] }\njobs:\n  types:\n    runs-on: x\n'),
    ]);
    expect(out).toEqual(['lint', 'smoke', 'types']);
  });

  it('varios jobs en un workflow son varios checks', () => {
    expect(jobIds('jobs:\n  uno:\n    runs-on: x\n  dos:\n    runs-on: x\n')).toEqual(['uno', 'dos']);
  });

  it('no se cuela lo que está anidado dentro de un job', () => {
    // `steps:` y `with:` van más adentro; solo el primer nivel son jobs.
    expect(jobIds('jobs:\n  uno:\n    steps:\n      - uses: x\n    with:\n      foo: bar\n')).toEqual(['uno']);
  });

  it('sin bloque jobs no hay checks que esperar', () => {
    expect(jobIds('name: vacio\n')).toEqual([]);
    expect(runsOnPullRequest('')).toBe(false);
  });
});

describe('qué falta por registrarse', () => {
  it('lo esperado que aún no está', () => {
    expect(missingChecks(['e2e', 'quality'], [{ name: 'quality' }])).toEqual(['e2e']);
  });

  it('vacío cuando están todos, aunque sobren externos', () => {
    // GitGuardian no está en nuestros workflows y no se puede enumerar: si
    // aparece se le exige verde como a cualquiera, pero no se le espera.
    const checks = [{ name: 'e2e' }, { name: 'quality' }, { name: 'GitGuardian Security Checks' }];
    expect(missingChecks(['e2e', 'quality'], checks)).toEqual([]);
  });

  it('sin checks todavía, falta todo', () => {
    expect(missingChecks(['e2e'], [])).toEqual(['e2e']);
  });
});

describe('contra los workflows REALES de este repo', () => {
  // Un test sobre ficheros inventados comprueba el parser; este comprueba que el
  // parser sirve para lo que hay. Si alguien añade un workflow o renombra un
  // job, aquí se ve.
  const dir = join(process.cwd(), '.github/workflows');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => wf(f, readFileSync(join(dir, f), 'utf8')));

  it('reconoce los cuatro checks que de verdad salen en cada PR', () => {
    // Son los que se vieron en la PR #929: scan, e2e, check, quality (más
    // GitGuardian, que es externo y no vive en estos ficheros).
    expect(expectedChecks(files)).toEqual(['check', 'e2e', 'quality', 'scan']);
  });

  it('y ninguno se queda a cero: un parser que no encuentra nada no protege', () => {
    expect(expectedChecks(files).length).toBeGreaterThan(0);
  });
});
