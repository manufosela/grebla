/**
 * Lo que se le pide a la IA al interpretar métricas de equipo (RMR-TSK-0610).
 *
 * Vive fuera de `index.js` para poder probarlo: un prompt es código, y este en
 * concreto decide qué NO puede decir la IA. Eso merece un test, no confianza.
 *
 * Dos límites, y los dos vienen de errores caros de cometer:
 *
 * 1. **Nunca personas.** Estas métricas son del sistema. Una lectura individual
 *    las convierte en una herramienta de vigilancia, que es exactamente lo que
 *    GREBLA no es.
 * 2. **Lo que no se mide no se interpreta.** El resumen de Entrega distingue lo
 *    que vale de lo que falta y del motivo por el que falta. Si la IA rellena
 *    ese hueco con una conjetura, deshace el trabajo de haberlo dicho: una
 *    ausencia comentada se acaba leyendo como un dato.
 */

/** Forma de la respuesta. La IA no escribe prosa libre: rellena estos campos. */
export const INTERPRET_TOOL = Object.freeze({
  name: 'emit_interpretation',
  description: 'Devuelve la interpretación de las métricas del equipo.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['bien', 'regular', 'mal'], description: 'Veredicto general.' },
      summary: { type: 'string', description: 'Resumen claro de 2-3 frases, en español.' },
      causes: { type: 'array', items: { type: 'string' }, description: 'Causas probables (correlacionando métricas).' },
      recommendations: { type: 'array', items: { type: 'string' }, description: 'Acciones recomendadas.' },
    },
    required: ['verdict', 'summary'],
  },
});

/** Herramientas que se pueden interpretar. Cualquier otra cosa no se inventa. */
export const INTERPRET_TOOLS = Object.freeze(['entrega']);

/** @param {unknown} tool */
export function isInterpretableTool(tool) {
  return typeof tool === 'string' && INTERPRET_TOOLS.includes(tool);
}

const CONTEXTO = [
  'Son las métricas de ENTREGA de la organización, de las últimas 12 semanas y leídas del portal:',
  'despliegues por semana, fallo de despliegue, fallo en producción, tiempo de restauración,',
  'trabajo en curso y entregado por semana.',
].join(' ');

const REFERENCIAS = [
  'Referencias útiles: desplegar a diario con lead time por debajo de una hora es excelente;',
  'por encima de una semana, flojo. Un trabajo en curso que crece sin que crezca lo entregado es un atasco.',
  'El throughput y el WIP dependen del tamaño del equipo: no los juzgues en absoluto.',
].join(' ');

/**
 * El aviso que hace este prompt distinto: las filas traen su estado, y dos de
 * ellos significan «aquí no hay número».
 */
const HUECOS = [
  'ATENCIÓN a los estados de cada fila:',
  '«sinFuente» significa que esta organización NO PUEDE medir eso todavía (falta la fuente, y el motivo viene escrito);',
  '«sinDato» significa que se puede medir pero esta semana no hay medida;',
  '«recuento» significa que hay tan pocos casos que dar un porcentaje engañaría.',
  'De lo que esté en «sinFuente» o «sinDato» NO saques conclusiones, ni buenas ni malas, ni lo estimes a partir de otra métrica:',
  'dilo como lo que es, algo que aún no se sabe. Si falta lo esencial, el veredicto puede ser que todavía no se puede juzgar.',
].join(' ');

/**
 * El encargo completo para un resumen ya calculado.
 * @param {string} tool  herramienta a interpretar (hoy solo «entrega»)
 * @param {unknown} summary  resumen que manda el cliente, tal cual
 * @returns {string}
 */
export function buildInterpretPrompt(tool, summary) {
  if (!isInterpretableTool(tool)) {
    throw new Error(`No sé interpretar «${tool}».`);
  }
  return `Eres experto en rendimiento de equipos de ingeniería. ${CONTEXTO} Interprétalas EN CONJUNTO, correlacionando unas con otras, SIEMPRE a nivel de equipo y sistema, NUNCA de personas.

Datos (JSON):
${JSON.stringify(summary)}

${HUECOS}

${REFERENCIAS}

Llama a emit_interpretation con: un veredicto (bien/regular/mal), un resumen de 2-3 frases, las causas PROBABLES de lo que ves y recomendaciones accionables. Todo en español. No menciones ni evalúes a personas concretas.`;
}
