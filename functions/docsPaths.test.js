/**
 * Test de EQUIVALENCIA de las rutas de documentos (RMR-TSK-0503).
 *
 * El saneado vive en dos copias físicas —el dominio del cliente y este módulo—
 * porque functions/ se despliega solo y no puede importar de ../src. La copia es
 * inevitable; la divergencia no, y aquí divergir significa que el servidor
 * escriba en un sitio distinto del que el cliente anunció, o que sanee más
 * flojo y deje una ruta salir de `docs/`.
 */
import { describe, it, expect } from 'vitest';
import { storagePathOf as cf, sanitizeFolder as cfFolder, sanitizeFileName as cfFile, DOCS_ROOT as CF_ROOT } from './docsPaths.js';
import { storagePathOf, sanitizeFolder, sanitizeFileName, DOCS_ROOT } from '../src/tools/docs/domain/paths.js';

const CARPETAS = ['tech', 'Tech', '  TECH  ', '', null, undefined, '..', '../otro', 'tech/sub', '/tech', 'te ch', 'té', '-tech', 'a'.repeat(41)];
const FICHEROS = ['Plan Tech 2026Q4.html', 'GREBLA.html', '/etc/passwd', '../../secreto.html', 'C:\\docs\\plan.html', 'Organización.html', '', '   ', '.html', '---', null];

describe('el saneado de rutas no diverge entre cliente y Cloud Function', () => {
  it('misma raíz', () => {
    expect(CF_ROOT).toBe(DOCS_ROOT);
  });

  it('mismas carpetas, incluida toda forma de intentar escaparse', () => {
    for (const v of CARPETAS) expect(cfFolder(v)).toBe(sanitizeFolder(v));
  });

  it('mismos nombres de fichero', () => {
    for (const v of FICHEROS) expect(cfFile(v)).toBe(sanitizeFileName(v));
  });

  it('misma ruta final para cada combinación', () => {
    for (const folder of CARPETAS) {
      for (const fileName of FICHEROS) {
        expect(cf({ folder, fileName })).toBe(storagePathOf({ folder, fileName }));
      }
    }
  });

  it('y ninguna se sale de la raíz protegida', () => {
    for (const folder of CARPETAS) {
      for (const fileName of FICHEROS) {
        const path = cf({ folder, fileName });
        if (path) expect(path.startsWith(`${DOCS_ROOT}/`)).toBe(true);
      }
    }
  });
});
