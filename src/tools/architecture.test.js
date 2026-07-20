/**
 * Guard de arquitectura de las herramientas (RMR-TSK-0287).
 *
 * Cada tool de `src/tools/` es una pieza autónoma con hexagonal por dentro
 * (domain / application / infrastructure). Hoy esa independencia se cumple, pero
 * por disciplina: nada impide que un día alguien importe `src/lib/firebase.js`
 * desde un dominio y la deje pegada a la app para siempre.
 *
 * Este test la convierte en una regla que se cumple por construcción. No es
 * cosmética: es lo que mantiene barato extraer una herramienta a su propio
 * paquete el día que haga falta, sin pagar hoy la ceremonia de un monorepo.
 *
 * Tres reglas:
 *  1. Una herramienta NO depende de la app (src/lib, src/components, src/pages).
 *  2. Una herramienta NO depende de otra herramienta.
 *  3. Firebase solo vive en `infrastructure/` — el dominio es JS puro y por eso
 *     se puede testear (y portar) sin arrancar nada.
 *
 * EXCEPCIÓN: `composition/container.js` de cada tool. Es la raíz de composición,
 * el único sitio donde se enchufan los adaptadores concretos: importa el
 * `src/lib/firebase.js` ya inicializado y los SDK. Es deliberado —sin él, cada
 * tool tendría que inicializar su propia app de Firebase— pero conviene tenerlo
 * localizado: al extraer una herramienta a otro proyecto, SU CONTENEDOR es el
 * único fichero que hay que reescribir. Todo lo demás se mueve tal cual.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const TOOLS_DIR = new URL('.', import.meta.url).pathname;

/** Todos los .js de src/tools, recursivo. @returns {string[]} rutas absolutas */
function listJsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listJsFiles(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

/** Especificadores importados por un fichero (import estático y dinámico). */
function importsOf(source) {
  const specs = [];
  for (const m of source.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1]);
  return specs;
}

/** Herramienta a la que pertenece un fichero: `src/tools/<tool>/...` */
function toolOf(absPath) {
  return relative(TOOLS_DIR, absPath).split('/')[0];
}

/** Ruta del import resuelta contra `src/`, o null si no es relativa. */
function resolvedFrom(absFile, spec) {
  if (!spec.startsWith('.')) return null;
  const srcDir = resolve(TOOLS_DIR, '..');
  return relative(srcDir, resolve(dirname(absFile), spec));
}

const FILES = listJsFiles(TOOLS_DIR).filter((f) => f !== import.meta.filename);

/** La raíz de composición es el único punto donde se enchufa lo concreto. */
const isCompositionRoot = (file) => file.includes('/composition/');

/** Infracciones de una regla, como texto legible para el mensaje de fallo. */
function findViolations(predicate) {
  return FILES.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return importsOf(source)
      .filter((spec) => predicate(file, spec))
      .map((spec) => `${relative(TOOLS_DIR, file)} → ${spec}`);
  });
}

describe('arquitectura de src/tools', () => {
  it('encuentra ficheros que revisar (si no, el guard sería un test vacío)', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('la dependencia a la app está confinada a las raíces de composición', () => {
    // Se afirma DÓNDE está permitido acoplarse, no solo dónde no: si mañana
    // aparece un container nuevo tocando la app, aquí se ve; y si alguien limpia
    // uno, también. Es el inventario de lo que hay que reescribir al extraer.
    const coupled = new Set(FILES.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return importsOf(source).some((spec) => {
        const target = resolvedFrom(file, spec);
        return target !== null && /^(lib|components|pages|client|layouts)\//.test(target);
      });
    }).map((file) => relative(TOOLS_DIR, file)));
    expect([...coupled].toSorted()).toEqual([
      'career/composition/container.js',
      'dora/composition/container.js',
      'lean/composition/container.js',
      'motivators/composition/container.js',
      'o2o/composition/container.js',
      'team/composition/container.js',
    ]);
  });

  it('ninguna herramienta depende de la app, salvo su raíz de composición', () => {
    const offenders = findViolations((file, spec) => {
      if (isCompositionRoot(file)) return false;
      const target = resolvedFrom(file, spec);
      return target !== null && /^(lib|components|pages|client|layouts)\//.test(target);
    });
    expect(offenders).toEqual([]);
  });

  it('ninguna herramienta depende de otra herramienta', () => {
    const offenders = findViolations((file, spec) => {
      const target = resolvedFrom(file, spec);
      if (target === null || !target.startsWith('tools/')) return false;
      return target.split('/')[1] !== toolOf(file);
    });
    expect(offenders).toEqual([]);
  });

  it('Firebase solo se importa desde infrastructure/ o la raíz de composición', () => {
    const offenders = findViolations((file, spec) =>
      spec.startsWith('firebase') && !file.includes('/infrastructure/') && !isCompositionRoot(file));
    expect(offenders).toEqual([]);
  });
});
