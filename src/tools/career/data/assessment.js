/**
 * Valoración de una persona frente a las expectativas de su nivel asignado.
 *
 * Por cada dimensión del framework en el nivel de la persona se marca si
 * «cumple» (verde) o «no llega» (rojo). Los rojos son los «puntos de mejora».
 * A partir del recuento de rojos y del total de dimensiones se deriva una
 * sugerencia de rol (progresar, mantenerse o replantear el nivel).
 *
 * Estas funciones son PURAS (sin Firebase): trabajan sobre el framework ya
 * cargado y sobre el documento de valoración. La IO vive en
 * src/lib/careerAssessment.js.
 *
 * @typedef {import('./framework.js').CareerFramework} CareerFramework
 *
 * @typedef {Object} DimensionMark   Marca de una dimensión en la valoración
 * @property {boolean} meets         true = cumple la expectativa, false = no llega
 * @property {string} [note]         nota opcional del líder para esa dimensión
 *
 * @typedef {Object} CareerAssessment            Documento de valoración de la persona
 * @property {Record<string, DimensionMark>} byDimension  marca por id de dimensión
 *
 * @typedef {Object} AssessmentRow   Fila de valoración ya resuelta (una por dimensión)
 * @property {{ id: string, name: string }} dimension
 * @property {string} text           texto de la expectativa del nivel ('' si no definida)
 * @property {boolean} hasExpectation  false si la celda del framework está vacía
 * @property {boolean} meets         valoración efectiva (por defecto true si no está marcada)
 * @property {string} note           nota del líder para la dimensión ('' si no hay)
 */
import { expectationsForLevel } from './framework.js';

/**
 * Filas de valoración de un nivel: UNA por cada dimensión existente (mismo orden
 * que `expectationsForLevel`), combinando la expectativa del framework con la
 * marca de la valoración. Si una dimensión no está marcada, `meets` es true por
 * defecto (se asume que cumple hasta que el líder indique lo contrario).
 * Función PURA.
 * @param {CareerFramework|null|undefined} framework
 * @param {string|null|undefined} levelId
 * @param {CareerAssessment|null|undefined} assessment
 * @returns {AssessmentRow[]}
 */
export function assessmentRows(framework, levelId, assessment) {
  const byDimension = assessment?.byDimension ?? {};
  return expectationsForLevel(framework, levelId).map((row) => {
    const mark = byDimension[row.dimension.id];
    return {
      dimension: { id: row.dimension.id, name: row.dimension.name },
      text: row.text,
      hasExpectation: row.text !== '',
      meets: mark?.meets ?? true,
      note: String(mark?.note ?? '').trim(),
    };
  });
}

/**
 * Puntos de mejora: las filas marcadas como «no llega» (`meets === false`).
 * Preservan dimensión, texto de la expectativa y nota para poder listarlos.
 * Función PURA.
 * @param {AssessmentRow[]} rows
 * @returns {AssessmentRow[]}
 */
export function improvementPoints(rows) {
  return (rows ?? []).filter((row) => row.meets === false);
}

/**
 * Sugerencia de rol a partir del recuento de rojos. Función PURA (devuelve
 * siempre una cadena; '' cuando no hay nivel que valorar).
 *  - `total === 0` (sin nivel asignado): ''.
 *  - `reds === 0`: cumple; propone aspirar a `aspirationalCodes` (o indica que
 *    está en el tope del itinerario si no hay).
 *  - `reds === 1`: cerca del nivel, foco en el único punto de mejora.
 *  - `reds >= 2`: varias expectativas sin cumplir, replantear el nivel.
 * @param {{ reds: number, total: number, aspirationalCodes?: string[] }} params
 * @returns {string}
 */
export function careerSuggestion({ reds, total, aspirationalCodes }) {
  if (total === 0) return '';
  if (reds === 0) {
    const codes = aspirationalCodes ?? [];
    return codes.length > 0
      ? `Cumple las expectativas de su nivel. Podría aspirar a: ${codes.join(', ')}.`
      : 'Cumple las expectativas de su nivel. — tope de itinerario.';
  }
  if (reds === 1) {
    return 'Cerca de su nivel: foco en el punto de mejora.';
  }
  return 'Varias expectativas sin cumplir: valora si el nivel es adecuado (mover lateral o bajar).';
}
