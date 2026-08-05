/**
 * Pulido IA de los requisitos de una JD (RMR-TSK-0418) — parte PURA.
 *
 * El generador determinista (src/tools/career/domain/requirementPhrasing.js)
 * convierte expectativas en ítems; su límite conocido es la segunda cláusula
 * conjugada («…identificar patrones y lidera su adopción»). Aquí vive el
 * corrector: prompt conservador para un modelo barato (Haiku) que corrige
 * SOLO gramática/concordancia, y las BARANDILLAS que garantizan que la IA no
 * pueda inventar: mismo número de ítems, ninguno vacío y longitud acotada —
 * el ítem que no cumpla conserva su versión determinista.
 */

/** Modelo del pulido: barato y de sobra para corrección gramatical. */
export const JD_POLISH_MODEL = 'claude-haiku-4-5-20251001';

/** Cota de longitud del ítem pulido respecto al original. */
const LENGTH_RATIO = Object.freeze({ min: 0.5, max: 1.7 });

/** Tool-use de salida estructurada del corrector. */
export const JD_POLISH_TOOL = Object.freeze({
  name: 'emit_polished_jd',
  description: 'Devuelve los ítems corregidos, en el mismo orden y cantidad que los recibidos.',
  input_schema: {
    type: 'object',
    properties: {
      responsibilities: { type: 'array', items: { type: 'string' }, description: 'Ítems de responsabilidades corregidos (mismo orden y cantidad).' },
      niceToHave: { type: 'array', items: { type: 'string' }, description: 'Ítems valorables corregidos (mismo orden y cantidad; vacío si no se recibieron).' },
      month3: { type: 'string', description: 'La frase de los 3 meses corregida.' },
    },
    required: ['responsibilities', 'niceToHave', 'month3'],
  },
});

/**
 * Prompt del corrector: conservador a propósito — corrige solo lo roto.
 * @param {{ responsibilities: string[], niceToHave: string[], month3: string }} input
 * @returns {string}
 */
export function buildPolishPrompt({ responsibilities, niceToHave, month3 }) {
  return `Eres corrector de estilo de una oferta de empleo en español. Recibes ítems generados automáticamente: la transformación convirtió el primer verbo a infinitivo, pero a veces deja una segunda cláusula sin concordar (p. ej. «Capacidad para identificar patrones y lidera su adopción» debería ser «…y liderar su adopción»).

REGLAS ESTRICTAS:
- Si un ítem es gramaticalmente correcto y suena natural, devuélvelo EXACTAMENTE igual, carácter a carácter.
- Si tiene una concordancia rota o suena raro, corrígelo tocando lo MÍNIMO imprescindible.
- NO añadas contenido, NO quites contenido, NO cambies el significado, NO reordenes, NO fusiones ni dividas ítems.
- Devuelve el MISMO número de ítems, en el MISMO orden.

Responsabilidades:
${responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Valorables:
${(niceToHave ?? []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '(ninguno)'}

Frase de los 3 meses:
${month3}

Llama a la herramienta emit_polished_jd con el resultado.`;
}

/**
 * BARANDILLA: mezcla lo pulido con lo original. Si el array no cuadra en
 * tamaño, se descarta entero; ítem a ítem, uno vacío o con longitud fuera de
 * cota conserva su original. Devuelve también cuántos cambiaron de verdad.
 * @param {string[]} original
 * @param {unknown} polished
 * @returns {{ items: string[], changed: number }}
 */
export function sanitizePolishedItems(original, polished) {
  if (!Array.isArray(polished) || polished.length !== original.length) {
    return { items: [...original], changed: 0 };
  }
  let changed = 0;
  const items = original.map((base, i) => {
    const candidate = typeof polished[i] === 'string' ? polished[i].trim() : '';
    if (!candidate) return base;
    const ratio = candidate.length / Math.max(1, base.length);
    if (ratio < LENGTH_RATIO.min || ratio > LENGTH_RATIO.max) return base;
    if (candidate !== base) changed += 1;
    return candidate;
  });
  return { items, changed };
}
