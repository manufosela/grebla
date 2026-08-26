/**
 * Guard: los avisos usan el estilo compartido y no se quedan en gris
 * (RMR-TSK-0457).
 *
 * Un aviso en gris se lee como mobiliario y la gente no lo ve. Pasaba con el de
 * «quién puede ver esta retro», que es justo lo que hay que leer antes de
 * escribir dentro, y con los del panel.
 *
 * Dos cosas se comprueban aquí, porque cada una falla de una forma:
 *  1. Si un componente pinta un aviso y NO importa `note-styles.js`, la caja no
 *     aparece: queda un párrafo suelto sin fondo ni borde.
 *  2. Si además declara su propia regla para esa clase, esa regla GANA (va
 *     después en el array de estilos) y devuelve el aviso al gris sin que nadie
 *     se entere.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname;
const COMPONENTES = join(SRC, 'components');

function ficheros(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return ficheros(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/** Clases que pinta el sistema de avisos. */
const USA_AVISO = /class="(?:[^"]*\s)?(?:ro-note|info-note)(?:\s[^"]*)?"/;
/** Una regla propia para esas clases pisaría el estilo compartido. Ojo: `.note`
 *  a secas NO entra — en el tablero de retro es el post-it, no un aviso. */
const REGLA_PROPIA = /^\s*\.(?:ro-note|info-note)\s*\{/m;

describe('avisos con el estilo compartido', () => {
  const conAviso = ficheros(COMPONENTES)
    .map((file) => ({ file, texto: readFileSync(file, 'utf8') }))
    .filter(({ texto }) => USA_AVISO.test(texto));

  it('hay componentes con avisos que revisar', () => {
    // Si esto se queda a cero, el guard ha dejado de mirar donde debía.
    expect(conAviso.length).toBeGreaterThan(0);
  });

  it('todos importan note-styles.js, o el aviso sale sin caja', () => {
    const sinImportar = conAviso
      .filter(({ texto }) => !texto.includes('note-styles.js'))
      .map(({ file }) => `${file.replace(SRC, 'src/')} pinta un aviso pero no importa note-styles.js`);
    expect(sinImportar).toEqual([]);
  });

  it('ninguno redefine la clase por su cuenta: su regla ganaría y lo devolvería al gris', () => {
    const conReglaPropia = conAviso
      .filter(({ texto }) => REGLA_PROPIA.test(texto))
      .map(({ file }) => `${file.replace(SRC, 'src/')} declara su propia regla para .note/.ro-note`);
    expect(conReglaPropia).toEqual([]);
  });
});
