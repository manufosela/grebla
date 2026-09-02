/**
 * Guard: ninguna plantilla `css` de Lit se corta a mitad de un comentario
 * (RMR-BUG-0108, y antes RMR-TSK-0262).
 *
 * Escribir «usa `auto` en vez de `scroll`» dentro de un comentario CSS parece
 * inofensivo, pero ese backtick CIERRA el template literal. Lo tramposo es que
 * el fichero puede seguir siendo JavaScript válido —así que `astro check` pasa
 * sin decir nada— mientras el componente se queda sin la mitad de sus estilos, o
 * directamente deja de montar. La primera señal suele ser un E2E que no
 * encuentra nada en la página: un camino larguísimo para un error de una tecla.
 *
 * Cómo se detecta sin falsos positivos: se recorta el contenido del template
 * (desde `css` hasta el primer backtick sin escapar) y se cuenta la apertura y
 * el cierre de comentarios. Si queda un `/*` sin su cierre, es que el template
 * terminó DENTRO de un comentario — o sea, que un backtick lo cortó antes.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname;

function ficheros(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return ficheros(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/**
 * Plantillas css`…` que terminan con un comentario a medio cerrar.
 * @param {string} codigo
 * @returns {Array<{ linea: number, resto: string }>}
 */
export function plantillasCortadas(codigo) {
  const out = [];
  for (const m of codigo.matchAll(/\bcss`/g)) {
    let i = m.index + m[0].length;
    // Fin del template: el primer backtick que no venga escapado.
    while (i < codigo.length && !(codigo[i] === '`' && codigo[i - 1] !== '\\')) i += 1;
    const cuerpo = codigo.slice(m.index + m[0].length, i);
    const aperturas = (cuerpo.match(/\/\*/g) ?? []).length;
    const cierres = (cuerpo.match(/\*\//g) ?? []).length;
    if (aperturas > cierres) {
      out.push({
        linea: codigo.slice(0, i).split('\n').length,
        resto: cuerpo.slice(cuerpo.lastIndexOf('/*'), cuerpo.lastIndexOf('/*') + 80).replace(/\s+/g, ' '),
      });
    }
  }
  return out;
}

describe('las plantillas de estilos no se cortan a mitad de un comentario', () => {
  const modulos = ficheros(join(SRC, 'components')).map((file) => ({
    rel: `src/${file.replace(SRC, '')}`,
    texto: readFileSync(file, 'utf8'),
  }));

  it('hay componentes con estilos que revisar', () => {
    expect(modulos.filter(({ texto }) => texto.includes('css`')).length).toBeGreaterThan(30);
  });

  it('ninguna plantilla termina dentro de un comentario', () => {
    const cortadas = modulos.flatMap(({ rel, texto }) => plantillasCortadas(texto)
      .map((c) => `${rel}:${c.linea} — el css termina dentro de un comentario (¿un backtick suelto?): ${c.resto}`));
    expect(cortadas).toEqual([]);
  });
});
