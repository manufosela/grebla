/**
 * Guard: ninguna tabla ancha se queda sin caja que la contenga (RMR-BUG-0106).
 *
 * Una `<table>` suelta con muchas columnas no se recorta: se sale del panel y lo
 * que queda a la derecha es INALCANZABLE — ni cabe, ni se puede arrastrar. Con
 * `.table-wrap` alrededor, si no cabe al menos se llega.
 *
 * El umbral son 5 columnas: por debajo, una tabla cabe de sobra en cualquier
 * pantalla razonable y envolverla solo añadiría ruido.
 *
 * Ojo: esto NO dice que la tabla quepa —eso se mide en los E2E, contra el
 * navegador—, solo que si no cabe hay manera de llegar al resto.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname;
const COMPONENTES = join(SRC, 'components');
/** A partir de aquí una tabla puede no caber en una pantalla normal. */
const COLUMNAS_ANCHA = 5;

function ficheros(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return ficheros(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/** Tablas de un módulo, con sus columnas y si están dentro de una caja. */
export function tablasDe(texto) {
  const out = [];
  for (const m of texto.matchAll(/<table[^>]*>/g)) {
    const antes = texto.slice(Math.max(0, m.index - 160), m.index);
    const cierre = texto.indexOf('</table>', m.index);
    const cuerpo = cierre === -1 ? '' : texto.slice(m.index, cierre);
    out.push({
      linea: texto.slice(0, m.index).split('\n').length,
      columnas: (cuerpo.match(/<th/g) ?? []).length,
      envuelta: antes.includes('table-wrap'),
    });
  }
  return out;
}

describe('las tablas anchas se pueden alcanzar enteras', () => {
  const modulos = ficheros(COMPONENTES).map((file) => ({
    rel: `src/${file.replace(SRC, '')}`,
    texto: readFileSync(file, 'utf8'),
  }));

  it('hay tablas que revisar', () => {
    const total = modulos.flatMap(({ texto }) => tablasDe(texto)).length;
    expect(total).toBeGreaterThan(10);
  });

  it('toda tabla de 5 columnas o más vive dentro de .table-wrap', () => {
    const sueltas = modulos.flatMap(({ rel, texto }) => tablasDe(texto)
      .filter((t) => t.columnas >= COLUMNAS_ANCHA && !t.envuelta)
      .map((t) => `${rel}:${t.linea} — tabla de ${t.columnas} columnas sin .table-wrap: lo que no quepa quedará fuera de alcance`));
    expect(sueltas).toEqual([]);
  });

  it('quien envuelve una tabla trae el estilo que hace funcionar la caja', () => {
    // Sin `tableStyles`, `.table-wrap` es un div cualquiera: no desplaza nada.
    const sinEstilo = modulos
      .filter(({ texto }) => texto.includes('class="table-wrap"') && !texto.includes('table-styles.js')
        && !/\.table-wrap\s*\{/.test(texto))
      .map(({ rel }) => `${rel} usa .table-wrap pero no importa table-styles.js ni define la clase`);
    expect(sinEstilo).toEqual([]);
  });
});
