/**
 * Tests de las rutas de los documentos (RMR-PCS-0041).
 *
 * Una ruta es un permiso: las reglas de Storage protegen `docs/**`, así que lo
 * que se salga de ahí se queda sin protección. Por eso lo que más se defiende
 * aquí no es el formato bonito del nombre, sino que NADA pueda escaparse de la
 * raíz ni colarse en una carpeta inventada.
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeFolder, sanitizeFileName, storagePathOf, groupByFolder, isHtmlFile, DOCS_ROOT,
} from './paths.js';

describe('sanitizeFolder', () => {
  it('acepta una carpeta normal, en minúsculas', () => {
    expect(sanitizeFolder('tech')).toBe('tech');
    expect(sanitizeFolder('  Tech  ')).toBe('tech');
    expect(sanitizeFolder('plan-2027')).toBe('plan-2027');
  });

  it('la raíz es la ausencia de carpeta', () => {
    expect(sanitizeFolder('')).toBe('');
    expect(sanitizeFolder(null)).toBe('');
    expect(sanitizeFolder(undefined)).toBe('');
  });

  it('NADA de subir de nivel ni de meter barras', () => {
    for (const malo of ['..', '../otro', 'tech/sub', '/tech', 'tech/', '.', './x']) {
      expect(sanitizeFolder(malo)).toBe('');
    }
  });

  it('ni caracteres raros que luego signifiquen algo en una ruta', () => {
    for (const malo of ['te ch', 'tech%2f', 'té', '-tech', 'a'.repeat(41)]) {
      expect(sanitizeFolder(malo)).toBe('');
    }
  });
});

describe('sanitizeFileName', () => {
  it('convierte el nombre en algo seguro y legible', () => {
    expect(sanitizeFileName('Plan Tech 2026Q4.html')).toBe('plan-tech-2026q4.html');
    expect(sanitizeFileName('GREBLA.html')).toBe('grebla.html');
  });

  it('se queda con el fichero, nunca con la ruta que lo acompañe', () => {
    expect(sanitizeFileName('/etc/passwd')).toBe('passwd.html');
    expect(sanitizeFileName('../../secreto.html')).toBe('secreto.html');
    expect(sanitizeFileName('C:\\docs\\plan.html')).toBe('plan.html');
  });

  it('quita acentos en vez de dejarlos pasar a la ruta', () => {
    expect(sanitizeFileName('Organización.html')).toBe('organizacion.html');
  });

  it('sin nombre utilizable no hay fichero', () => {
    for (const malo of ['', '   ', '.html', '---', null]) expect(sanitizeFileName(malo)).toBe('');
  });
});

describe('storagePathOf', () => {
  it('la raíz para lo de primer nivel', () => {
    expect(storagePathOf({ fileName: 'grebla.html' })).toBe(`${DOCS_ROOT}/grebla.html`);
  });

  it('y su carpeta para lo demás', () => {
    expect(storagePathOf({ folder: 'Tech', fileName: 'Plan Tech.html' })).toBe(`${DOCS_ROOT}/tech/plan-tech.html`);
  });

  it('una carpeta inválida NO saca el documento de la raíz protegida', () => {
    // Si esto cede, el documento acaba fuera de `docs/` y sin reglas que lo cubran.
    expect(storagePathOf({ folder: '../../public', fileName: 'x.html' })).toBe(`${DOCS_ROOT}/x.html`);
  });

  it('sin nombre no hay ruta que construir', () => {
    expect(storagePathOf({ folder: 'tech' })).toBe('');
    expect(storagePathOf({})).toBe('');
  });
});

describe('groupByFolder', () => {
  const docs = [
    { name: 'Plan de Tecnología', folder: 'tech' },
    { name: 'GREBLA' },
    { name: 'Arquitectura', folder: 'tech' },
    { name: 'Bienvenida', folder: '' },
  ];

  it('la raíz primero, y cada carpeta con lo suyo', () => {
    const { root, folders } = groupByFolder(docs);
    expect(root.map((d) => d.name)).toEqual(['Bienvenida', 'GREBLA']);
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('tech');
    expect(folders[0].docs.map((d) => d.name)).toEqual(['Arquitectura', 'Plan de Tecnología']);
  });

  it('una carpeta inventada no crea carpeta: su documento va a la raíz', () => {
    const { root, folders } = groupByFolder([{ name: 'Suelto', folder: '../x' }]);
    expect(root.map((d) => d.name)).toEqual(['Suelto']);
    expect(folders).toEqual([]);
  });

  it('sin documentos no hay nada que agrupar', () => {
    expect(groupByFolder([])).toEqual({ root: [], folders: [] });
    expect(groupByFolder()).toEqual({ root: [], folders: [] });
  });
});

describe('isHtmlFile', () => {
  it('por extensión o por tipo', () => {
    expect(isHtmlFile({ name: 'a.html' })).toBe(true);
    expect(isHtmlFile({ name: 'a.htm' })).toBe(true);
    expect(isHtmlFile({ name: 'sin-extension', type: 'text/html' })).toBe(true);
  });

  it('lo demás no se publica', () => {
    for (const malo of [{ name: 'a.pdf' }, { name: 'a.js', type: 'text/javascript' }, {}, null]) {
      expect(isHtmlFile(malo)).toBe(false);
    }
  });
});
