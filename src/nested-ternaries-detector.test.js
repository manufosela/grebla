/**
 * Tests del detector que usa el guard de ternarios (RMR-TSK-0450). Se prueba
 * sobre ficheros de ejemplo, no sobre el repo: lo que importa es que distinga
 * las formas, y sobre todo que NO marque las que sí se leen bien — un detector
 * que avisa de más enseña a ignorar los avisos.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nestedInConsequent } from './nested-ternaries.test.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ternarios-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Escribe un fichero de ejemplo y devuelve lo que encuentra el detector. */
const analiza = (code) => {
  const file = join(dir, 'ejemplo.js');
  writeFileSync(file, code);
  return nestedInConsequent(file);
};

describe('lo que SÍ marca', () => {
  it('el segundo ternario colgando de la rama «?»', () => {
    expect(analiza('const x = c1 ? c2 ? a : b : c;')).toHaveLength(1);
  });

  it('lo mismo aunque lleve paréntesis, que no cambian la lectura', () => {
    expect(analiza('const x = c1 ? (c2 ? a : b) : c;')).toHaveLength(1);
  });

  it('dice el fichero, la línea y qué hacer', () => {
    const [aviso] = analiza('const a = 1;\nconst x = c1 ? c2 ? a : b : c;');
    expect(aviso).toContain(':2');
    expect(aviso).toMatch(/rama «:»|variable/);
  });
});

describe('lo que NO marca', () => {
  it('la cadena en la rama «:» — se lee como if / else if', () => {
    expect(analiza('const x = c1 ? a : c2 ? b : c3 ? c : d;')).toEqual([]);
  });

  it('un ternario dentro de un template: los ${} ya lo aíslan', () => {
    expect(analiza('const x = c1 ? `hay ${n === 1 ? "uno" : "varios"}` : "nada";')).toEqual([]);
  });

  it('un ternario dentro de un array o de un objeto en la rama «?»', () => {
    expect(analiza('const x = c1 ? [c2 ? a : b] : [];')).toEqual([]);
    expect(analiza('const x = c1 ? { k: c2 ? a : b } : {};')).toEqual([]);
  });

  it('un ternario dentro de una llamada o de una función', () => {
    expect(analiza('const x = c1 ? f(c2 ? a : b) : c;')).toEqual([]);
    expect(analiza('const x = c1 ? list.map((i) => (i.ok ? a : b)) : c;')).toEqual([]);
  });

  it('un ternario suelto, que no molesta a nadie', () => {
    expect(analiza('const x = c1 ? a : b;')).toEqual([]);
  });
});
