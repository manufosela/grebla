/**
 * PROPUESTA de roles de contribución a partir del cuestionario (RMR-TSK-0494).
 *
 * El manager marcaba las siglas a ojo, y ese dato alimenta la cobertura de roles
 * y el bus factor: el diagnóstico del equipo se apoyaba en una corazonada. Esto
 * le da un apoyo, no un veredicto — propone, enseña el porqué, y lo que se
 * guarda es lo que él confirme.
 *
 * Tres decisiones que sostienen que la propuesta sea DISCUTIBLE:
 *
 *  - Solo se propone lo que se ha visto. Rellenar los nueve roles porque el
 *    formulario tiene nueve casillas es inventarse media plantilla.
 *  - Los empates salen todos, sin desempatar por dentro. Un desempate
 *    automático es una decisión disfrazada de cálculo.
 *  - Cada propuesta viene con las conductas que la sostienen, para poder
 *    discutirla frase a frase.
 *
 * Puro: sin Firestore ni DOM.
 *
 * @typedef {Record<string, number>} Answers   id de ítem → valor de la escala
 */
import { BELBIN_SIGLAS, BELBIN_BY_SIGLA } from './belbin.js';
import { BELBIN_ITEMS, BELBIN_SCALE } from '../data/belbinItems.js';

const VALORES = new Set(BELBIN_SCALE.map((s) => s.value));
/** Un rol marcado a tope en sus dos ítems: el máximo por rol. */
const MAX_POR_ROL = 4;
/** A partir de aquí se propone como primario; por debajo, secundario. */
const UMBRAL_PRIMARIO = 3;
const UMBRAL_SECUNDARIO = 1;

/**
 * Puntuación por rol. Todos aparecen, aunque sea con cero: un rol ausente del
 * resultado se leería como «no se preguntó», y sí se preguntó — la respuesta
 * fue que no se ha visto.
 * @param {Answers|null|undefined} answers
 * @returns {Record<string, number>}
 */
export function scoreBelbin(answers) {
  const total = Object.fromEntries(BELBIN_SIGLAS.map((s) => [s, 0]));
  for (const item of BELBIN_ITEMS) {
    const valor = answers?.[item.id];
    // Fuera de la escala no cuenta: un valor inventado no es una observación.
    if (!VALORES.has(valor)) continue;
    total[item.sigla] += valor;
  }
  return total;
}

/**
 * Roles propuestos, ordenados de más a menos marcado. No se desempata por
 * dentro: si dos roles empatan, salen los dos y elige quien mira.
 * @param {Answers|null|undefined} answers
 * @returns {{ primary: string[], secondary: string[] }}
 */
export function proposeRoles(answers) {
  const total = scoreBelbin(answers);
  const porPuntuacion = (a, b) => total[b] - total[a];
  const conAlMenos = (min, max) => BELBIN_SIGLAS
    .filter((s) => total[s] >= min && total[s] <= max)
    .toSorted(porPuntuacion);
  return {
    primary: conAlMenos(UMBRAL_PRIMARIO, MAX_POR_ROL),
    secondary: conAlMenos(UMBRAL_SECUNDARIO, UMBRAL_PRIMARIO - 1),
  };
}

/**
 * Las conductas marcadas que sostienen un rol. Es lo que convierte la propuesta
 * en algo que se puede discutir en vez de en un oráculo: «esto sale de aquí».
 * @param {string} sigla
 * @param {Answers|null|undefined} answers
 * @returns {Array<{ id: string, text: string, value: number }>}
 */
export function evidenceFor(sigla, answers) {
  if (!BELBIN_BY_SIGLA[sigla]) return [];
  return BELBIN_ITEMS
    .filter((item) => item.sigla === sigla)
    .map((item) => ({ id: item.id, text: item.text, value: answers?.[item.id] ?? 0 }))
    .filter((e) => VALORES.has(e.value) && e.value > 0);
}
