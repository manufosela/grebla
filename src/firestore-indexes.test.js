/**
 * Guard: toda consulta que combine `array-contains` con `orderBy` tiene su
 * índice compuesto declarado (RMR-BUG-0103).
 *
 * Firestore exige un índice compuesto para esa combinación, y **el emulador no
 * lo valida**: los crea al vuelo. Así que la suite entera puede estar en verde
 * —36 E2E lo estaban— y la consulta reventar contra Firestore de verdad, con un
 * «The query requires an index» en la cara del usuario.
 *
 * Aquí se leen las consultas del código con el AST y se cruzan con
 * `firestore.indexes.json`. No cubre todos los tipos de índice compuesto, solo
 * el caso que ya nos ha mordido: array-contains + orderBy.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const SRC = new URL('.', import.meta.url).pathname;
const REPO = join(SRC, '..');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/** Primer argumento string de una llamada, si lo tiene. */
const primerTexto = (node) => {
  const arg = node.arguments?.[0];
  return arg && ts.isStringLiteral(arg) ? arg.text : null;
};

/**
 * Consultas `query(collection(db,'X'), …)` que mezclan array-contains y orderBy.
 * @returns {Array<{ file: string, line: number, coleccion: string, campo: string, orden: string }>}
 */
export function consultasConArrayContainsYOrden(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
  const encontradas = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'query') {
      let coleccion = null;
      let campo = null;
      let orden = null;
      for (const arg of node.arguments) {
        if (!ts.isCallExpression(arg)) continue;
        const fn = arg.expression.getText(source);
        if (fn === 'collection') {
          // collection(db, 'retros') → el nombre es el segundo argumento
          const segundo = arg.arguments[1];
          if (segundo && ts.isStringLiteral(segundo)) coleccion = segundo.text;
        }
        if (fn === 'where' && arg.arguments[1] && ts.isStringLiteral(arg.arguments[1])
          && arg.arguments[1].text === 'array-contains') campo = primerTexto(arg);
        if (fn === 'orderBy') orden = primerTexto(arg);
      }
      if (coleccion && campo && orden) {
        encontradas.push({
          file: file.replace(REPO + '/', ''),
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          coleccion, campo, orden,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return encontradas;
}

/** ¿Está declarado el índice que necesita esa consulta? */
function hayIndice(indices, { coleccion, campo, orden }) {
  return (indices ?? []).some((idx) => idx.collectionGroup === coleccion
    && (idx.fields ?? []).some((f) => f.fieldPath === campo && f.arrayConfig === 'CONTAINS')
    && (idx.fields ?? []).some((f) => f.fieldPath === orden && f.order));
}

describe('índices compuestos de Firestore', () => {
  it('cada consulta con array-contains + orderBy tiene su índice declarado', () => {
    const { indexes } = JSON.parse(readFileSync(join(REPO, 'firestore.indexes.json'), 'utf8'));
    const consultas = sourceFiles(SRC).flatMap(consultasConArrayContainsYOrden);
    // Si esto se queda a cero, el guard ha dejado de mirar donde debía.
    expect(consultas.length, 'no se ha encontrado ninguna consulta que revisar').toBeGreaterThan(0);

    const sinIndice = consultas
      .filter((c) => !hayIndice(indexes, c))
      .map((c) => `${c.file}:${c.line} — ${c.coleccion}: array-contains(${c.campo}) + orderBy(${c.orden}) sin índice en firestore.indexes.json`);
    expect(sinIndice).toEqual([]);
  }, 60_000);
});
