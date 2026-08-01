import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Regresión RMR-BUG-0056: `nothing` (centinela de render de Lit) usado en
 * career-app sin importarlo de 'lit' → «ReferenceError: nothing is not defined»
 * en runtime, que ni astro check ni el smoke de módulos (importa, no renderiza)
 * cazan. Este test estático verifica que si un componente de career USA el
 * centinela `nothing`, lo tiene en su import de 'lit'.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const componentFiles = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));

describe('componentes career — centinelas de Lit usados están importados', () => {
  it.each(componentFiles)('%s importa `nothing` si lo usa', (file) => {
    const src = readFileSync(join(dir, file), 'utf8');
    const litImport = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]lit['"]/);
    // Cuerpo sin la línea del import (para no contar el propio símbolo importado).
    const body = litImport ? src.replace(litImport[0], '') : src;
    const usesNothing = /(?<![\w.$])nothing(?![\w$])/.test(body);
    if (!usesNothing) return; // no lo usa: nada que exigir
    const imported = new Set((litImport?.[1] ?? '').split(',').map((s) => s.trim()));
    expect(imported.has('nothing'), `${file} usa «nothing» sin importarlo de 'lit'`).toBe(true);
  });
});
