/**
 * Guard: los colores de reserva de los tokens también cumplen contraste
 * (RMR-TSK-0457).
 *
 * `var(--rm-muted, #9ca3af)` parece inofensivo porque el token siempre está
 * definido en el layout… hasta que el componente se monta fuera de él (un arnés,
 * un test, una página nueva que olvida el layout). Entonces manda la reserva, y
 * #9ca3af da **2,54** sobre blanco: por debajo incluso del mínimo de elementos
 * gráficos. Un texto secundario sigue siendo texto: AA pide 4,5.
 *
 * Se comprueba contra el fondo más exigente de cada modo (blanco en claro), que
 * es el caso peor.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname;
const BLANCO = '#ffffff';
const AA_TEXTO = 4.5;

/** Luminancia relativa (WCAG 2.1). */
function luminancia(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const canales = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

/** Ratio de contraste entre dos colores. */
export function contraste(a, b) {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alta + 0.05) / (baja + 0.05);
}

function ficheros(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return ficheros(full);
    const ok = (entry.name.endsWith('.js') || entry.name.endsWith('.astro')) && !entry.name.endsWith('.test.js');
    return ok ? [full] : [];
  });
}

/** Tokens de TEXTO cuyo color de reserva debe ser legible sobre fondo claro. */
const TOKENS_DE_TEXTO = ['--rm-muted', '--rm-text'];
const RESERVA = /var\(\s*(--rm-[a-z-]+)\s*,\s*(#[0-9a-fA-F]{3,6})\s*\)/g;

describe('los colores de reserva cumplen contraste', () => {
  const usos = ficheros(SRC).flatMap((file) => {
    const texto = readFileSync(file, 'utf8');
    return [...texto.matchAll(RESERVA)]
      .filter(([, token]) => TOKENS_DE_TEXTO.includes(token))
      .map(([, token, color]) => ({ file: file.replace(SRC, 'src/'), token, color }));
  });

  it('hay reservas que revisar', () => {
    expect(usos.length).toBeGreaterThan(0);
  });

  it('ninguna reserva de texto baja de AA sobre fondo blanco', () => {
    const flojas = [...new Set(usos
      .filter(({ color }) => contraste(color, BLANCO) < AA_TEXTO)
      .map(({ token, color }) => `var(${token}, ${color}) da ${contraste(color, BLANCO).toFixed(2)} sobre blanco (AA pide ${AA_TEXTO})`))];
    expect(flojas).toEqual([]);
  });
});
