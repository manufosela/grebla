/**
 * Guard contra TERNARIOS ANIDADOS EN LA RAMA DEL `?` (RMR-TSK-0450).
 *
 * El criterio no es el de Sonar. Un ternario es legible para quien programa, y
 * encadenarlos en la rama del `:` también: se lee de arriba abajo como un
 * `if / else if`. Lo que sí cuesta es cuando el segundo ternario cuelga de la
 * rama del `?`, porque entonces hay que ir emparejando qué `:` cierra qué:
 *
 *     c1 ? c2 ? a : b : c        ← esto es lo que no se lee
 *     c1 ? a : c2 ? b : c        ← esto se lee como if / else if
 *
 * Tampoco cuenta el ternario que vive DENTRO de un delimitador —un template,
 * un array, un objeto, una llamada—, porque ahí no hay nada que emparejar: la
 * plantilla o los corchetes ya lo aíslan visualmente. Es el caso de la
 * pluralización `${n === 1 ? '' : 'es'}`, que en este repo era el 68 % de lo
 * que marcaba la regla S3358 de Sonar.
 *
 * Medido antes de escribir esto: de 225 ternarios dentro de otro ternario, 153
 * estaban dentro de un template, 68 eran cadena en el `else` y solo 2 eran el
 * patrón de abajo. Por eso S3358 se silencia en `sonar-project.properties` y se
 * sustituye por este guard, que acierta lo que nos importa.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const SRC = new URL('.', import.meta.url).pathname;

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/** Quita los paréntesis: `a ? (b ? x : y) : z` sigue siendo anidado en el `?`. */
const unwrap = (node) => (node && ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node);

/** Ternarios que cuelgan DIRECTAMENTE de la rama `?` de otro. */
export function nestedInConsequent(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
  const found = [];
  const visit = (node) => {
    if (ts.isConditionalExpression(node) && ts.isConditionalExpression(unwrap(node.whenTrue))) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      found.push(`${file.replace(SRC, 'src/')}:${line} — el segundo ternario cuelga de la rama «?»; muévelo a la rama «:» o sácalo a una variable`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('ternarios anidados en la rama del «?»', () => {
  it('ninguno en src/', () => {
    expect(sourceFiles(SRC).flatMap(nestedInConsequent)).toEqual([]);
  }, 60_000);
});
