/**
 * Estado de carrera de una persona, resumido para el Mapa del equipo
 * (RMR-TSK-0506): su nivel y cómo va frente a las expectativas de ese nivel.
 *
 * La ficha ya muestra esto dimensión a dimensión; aquí se reduce a una línea
 * para que quepa en la foto del equipo, junto a las cuatro dimensiones de
 * GREBLA. Las dos familias se miran juntas o no se miran.
 *
 * CUIDADO CON EL DATO: `assessmentRows` da por cumplida toda dimensión que
 * nadie haya marcado —es lo correcto en la ficha, donde el líder va marcando
 * los rojos—, así que contar rojos sobre una valoración vacía daría cero y el
 * Mapa diría que la persona cumple sin que nadie la haya mirado. Por eso «sin
 * valorar» es un estado propio y no se mezcla con «cumple».
 *
 * Función PURA: no toca Firebase. La lectura vive en src/lib/careerAssessment.js.
 *
 * @typedef {import('../data/framework.js').CareerFramework} CareerFramework
 * @typedef {import('../data/assessment.js').CareerAssessment} CareerAssessment
 *
 * @typedef {Object} CareerStatus
 * @property {'external'|'no-level'|'unknown-level'|'no-expectations'|'unassessed'|'meets'|'gaps'} kind
 * @property {string} levelName  nombre del nivel ('' si no hay ninguno)
 * @property {number} reds       expectativas que no llega (0 si no aplica)
 * @property {number} total      expectativas valorables del nivel (0 si no aplica)
 */
import { getLevel } from '../data/framework.js';
import { assessmentRows, improvementPoints } from '../data/assessment.js';

/**
 * Nombre visible de un nivel: código y título, como en la ficha de la persona.
 * @param {{ code?: string, title?: string }} level
 * @returns {string}
 */
function levelTitle(level) {
  const code = String(level?.code ?? '').trim();
  const title = String(level?.title ?? '').trim();
  if (code && title) return `${code} · ${title}`;
  return code || title;
}

/**
 * @param {CareerFramework|null|undefined} framework
 * @param {{ levelId?: string|null, external?: boolean }|null|undefined} person
 * @param {CareerAssessment|null|undefined} assessment
 * @returns {CareerStatus}
 */
export function careerStatus(framework, person, assessment) {
  const base = { levelName: '', reds: 0, total: 0 };
  // Los externos se clasifican por nivel para saber la composición del equipo,
  // pero no tienen plan de carrera: valorarles expectativas no significa nada.
  if (person?.external) return { ...base, kind: 'external' };

  const levelId = person?.levelId ?? '';
  if (!levelId) return { ...base, kind: 'no-level' };

  const level = getLevel(framework, levelId);
  // Nivel que el framework ya no conoce (se renombró o se borró): decirlo, no
  // presentarlo como «sin nivel», que es un caso distinto y se arregla distinto.
  if (!level) return { ...base, kind: 'unknown-level', levelName: levelId };

  // El nivel se nombra como en la ficha: «L2 · Senior Engineer». El código solo
  // no dice nada a quien no se lo sabe, y el título solo se repite entre tracks.
  const levelName = levelTitle(level);
  // Solo cuentan las dimensiones con expectativa ESCRITA para ese nivel: una
  // celda vacía del framework no es algo que la persona cumpla o deje de
  // cumplir, y meterla en el total diluiría los rojos («1 de 7» cuando solo 3
  // están definidas dice menos de lo que parece).
  const rows = assessmentRows(framework, levelId, assessment).filter((row) => row.hasExpectation);
  if (rows.length === 0) return { ...base, kind: 'no-expectations', levelName };

  // «Valorada» se mide SOBRE LAS FILAS QUE CUENTAN, no sobre el documento
  // entero: una marca que quedó de otro nivel (una dimensión que aquí no tiene
  // expectativa) la daría por mirada, y como lo no marcado se asume cumplido,
  // saldría «cumple» sin que nadie haya valorado nada de este nivel.
  const byDimension = assessment?.byDimension ?? {};
  const marcadas = rows.filter((row) => byDimension[row.dimension.id] !== undefined);
  if (marcadas.length === 0) return { ...base, kind: 'unassessed', levelName, total: rows.length };

  const reds = improvementPoints(rows).length;
  return {
    kind: reds === 0 ? 'meets' : 'gaps',
    levelName,
    reds,
    total: rows.length,
  };
}
