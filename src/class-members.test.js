/**
 * Guard contra MIEMBROS DUPLICADOS de clase (RMR-BUG-0094).
 *
 * Declarar dos veces el mismo método en una clase no es un error de JavaScript:
 * el último gana y el primero desaparece EN SILENCIO. Ni el runtime, ni el lint,
 * ni `astro check` dicen nada. Así se perdió el `updated()` que cargaba las
 * personas en la herramienta de Equipo, y la pestaña se quedó vacía durante
 * semanas en producción.
 *
 * Este guard recorre el AST de todo el código de `src/` y hace fallar la suite
 * si una clase declara dos miembros con el mismo nombre. `get`/`set` del mismo
 * nombre sí es legal y no cuenta.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const SRC = new URL('.', import.meta.url).pathname;

/** Todos los .js de src/ que no son tests. */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/** Miembros declarados más de una vez dentro de la misma clase. */
function duplicateMembers(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
  const found = [];
  const visit = (node) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const seen = new Map();
      for (const member of node.members) {
        if (!member.name || ts.isGetAccessor(member) || ts.isSetAccessor(member)) continue;
        const isStatic = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
        const key = `${isStatic ? 'static ' : ''}${member.name.getText(source)}`;
        const line = source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1;
        if (seen.has(key)) found.push(`${file.replace(SRC, 'src/')}:${line} — ${node.name?.getText(source) ?? '(anónima)'} declara «${key}» dos veces (línea ${seen.get(key)} y ${line})`);
        else seen.set(key, line);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('miembros de clase duplicados', () => {
  // Parsea el AST de todo `src/` (300+ ficheros), así que es intrínsecamente
  // lento: ~0,5 s normalmente y ~7 s bajo la instrumentación de cobertura. Con
  // el timeout por defecto de 5 s caía SOLO al medir cobertura — un rojo que no
  // señala ningún defecto y que acaba con el guard desactivado por «flaky».
  it('ninguna clase de src/ declara dos veces el mismo miembro', { timeout: 60_000 }, () => {
    const offenders = sourceFiles(SRC).flatMap(duplicateMembers);
    expect(offenders).toEqual([]);
  });
});
